-- ---------------------------------------------------------------------------
-- Complemento del seed de demo para las capturas del manual
-- (cuenta de testing: test@leadera.com)
--
-- Se corre DESPUÉS de seed-demo-testing.sql. NO es una migración: vive fuera de
-- supabase/migrations/ a propósito, para que `supabase db push` nunca lo aplique
-- solo. Se corre a mano desde el SQL Editor.
--
-- Qué agrega, y por qué:
--   1. "Por enfriarse". Hoy la tarjeta de Mi día sale vacía: la RPC
--      leads_por_enfriarse pide un contacto REAL de hace 21 días o más y que el
--      lead no tenga seguimiento agendado, y ningún lead del seed lo cumple.
--      Se convierten dos leads existentes:
--        - Sebastián Aguirre (FRIO): un WhatsApp de hace 38 días. Encaja con su
--          historia: la nota interna de hace 25 días ya dice "tres intentos sin
--          respuesta".
--        - Camila Rossi (de FRIO a TIBIO): una llamada de hace 27 días, donde
--          quedó en pensarlo. Reclasificarla a mano es lo que haría el agente.
--   2. Checklist de trámite. La única operación RESERVADA del seed es un
--      ALQUILER, y el trámite solo existe para VENTA/COMPRA (llevaEscritura en
--      src/lib/api/operaciones.ts), así que ahí no se vería nada. Se agrega una
--      COMPRA RESERVADA sobre Almafuerte 450 (casa en Playa Grande, la única
--      propiedad en venta DISPONIBLE del seed que no tiene ninguna operación),
--      con un comprador nuevo CALIENTE, Ramiro Castellano, y la historia de la
--      operación en sus interacciones (visita, oferta, oferta aceptada, reserva,
--      y el trámite avanzando). Trámite: 4 pasos hechos, el de la escribanía con
--      nombre y presupuesto, y la escritura prevista.
--        Por qué COMPRA y no VENTA: en la app el lead de una VENTA es el
--        propietario que vende ("Propietario (vendedor)", ETIQUETA_LEAD); el
--        comprador va en una COMPRA, y las dos llevan checklist.
--        Por qué un lead nuevo: los tres CALIENTE del seed tienen su historia
--        viva en los últimos 9 días (primera visita hoy, oferta de ayer, visita
--        mañana), y de ellas dependen las capturas de Mi día, Coincidencias y
--        el tablero. Cualquiera de ellos con una reserva de hace 30 días la
--        contradiría.
--   3. Fechas de contacto. El trigger actualizar_fechas_contacto escribe
--      fecha_primer/ultimo_contacto_real con CUALQUIER interacción (también las
--      notas internas y las consultas), contra la regla es_contacto_real. Al
--      final se recalculan esas dos columnas solo con contactos reales para
--      todos los leads del seed.
--
-- Estado de la propiedad: la app NO deriva el estado de la propiedad de sus
-- operaciones (ni el cliente ni ninguna migración del repo lo hace): se cambia
-- a mano desde el menú de estado de la ficha. Acá se hace igual, porque es lo
-- que haría el agente al reservar, y porque una ficha "Disponible" junto a una
-- compra reservada se vería incoherente. Solo si todavía está DISPONIBLE.
--
-- Marco de fechas: todo es relativo al "hoy" del seed original, que es la fecha
-- de la tarea de1f0006-…01 (el seed la crea con v_hoy), y NO a current_date. Si
-- el seed está atrasado, estas filas quedan alineadas con el resto, y
-- refrescar-fechas-demo.sql las corre todas juntas.
--
-- Todo pasa dentro de una única transacción: si algo falla no queda nada a
-- medias. La inmobiliaria se resuelve por el email del DUENO y se aborta si no
-- resuelve a exactamente una fila: ningún id de inmobiliaria está hardcodeado, y
-- cada INSERT/UPDATE de abajo está acotado por esa inmobiliaria y por ids del
-- seed. Idempotente: ids fijos y ON CONFLICT DO NOTHING; los UPDATE solo actúan
-- si el dato todavía no está como se quiere.
--
-- No siembra fotos (se suben a mano). No toca esquema, RLS ni policies.
-- ---------------------------------------------------------------------------

begin;

do $$
declare
  v_inmo   uuid;
  v_owner  uuid;
  v_hoy    date;

  l_seba   uuid := 'de1a0001-0000-4000-8000-000000000008';  -- Sebastián Aguirre (FRIO)
  l_cami   uuid := 'de1a0001-0000-4000-8000-000000000009';  -- Camila Rossi
  l_ramiro uuid := 'de1a0001-0000-4000-8000-000000000019';  -- Ramiro Castellano (nuevo, CALIENTE)
  p_playa  uuid := 'de1b0002-0000-4000-8000-000000000005';  -- Almafuerte 450 (casa, Playa Grande)
  o_compra uuid := 'de1d0004-0000-4000-8000-000000000007';  -- COMPRA reservada (nueva)
begin
  -- --- 0. Resolver el inquilino y el marco de fechas, o abortar -----------
  select i.id, p.id
    into v_inmo, v_owner
  from inmobiliarias i
  join profiles p on p.inmobiliaria_id = i.id and p.rol = 'DUENO'
  where p.email = 'test@leadera.com';

  if v_inmo is null then
    raise exception 'No se encontró la inmobiliaria de test@leadera.com. Abortado sin escribir nada.';
  end if;

  -- El "hoy" del seed: la tarea ancla se creó con v_hoy.
  select t.fecha
    into v_hoy
  from tareas t
  where t.id = 'de1f0006-0000-4000-8000-000000000001'
    and t.inmobiliaria_id = v_inmo;

  if v_hoy is null then
    raise exception 'Falta el seed base (tarea de1f0006-…01). Corré primero seed-demo-testing.sql. Abortado sin escribir nada.';
  end if;

  -- Los leads y la propiedad del seed base tienen que existir.
  if (select count(*) from leads
       where inmobiliaria_id = v_inmo and id in (l_seba, l_cami)) <> 2 then
    raise exception 'Faltan leads del seed base (8 o 9). Abortado sin escribir nada.';
  end if;

  if not exists (select 1 from propiedades where id = p_playa and inmobiliaria_id = v_inmo) then
    raise exception 'Falta la propiedad de1b0002-…05 (Almafuerte 450) del seed base. Abortado sin escribir nada.';
  end if;

  -- La propiedad no puede tener ya una operación activa de otro tipo: una
  -- propiedad no puede estar en dos operaciones en curso a la vez.
  if exists (
    select 1 from operaciones
     where propiedad_id = p_playa
       and inmobiliaria_id = v_inmo
       and id <> o_compra
       and estado not in ('CERRADA_GANADA', 'CANCELADA')
  ) then
    raise exception 'Almafuerte 450 ya tiene una operación activa. Abortado sin escribir nada.';
  end if;

  if to_regclass('public.operacion_tramite_pasos') is null
     or not exists (
       select 1
         from information_schema.columns
        where table_schema = 'public'
          and table_name = 'operacion_tramite_pasos'
          and column_name = 'escribania_nombre'
     ) then
    raise exception 'Falta operacion_tramite_pasos o sus columnas de escribanía (migración 20261101160000). Abortado sin escribir nada.';
  end if;

  -- --- 1. Por enfriarse ----------------------------------------------------
  -- Camila pasa de FRIO a TIBIO. Solo si todavía es FRIO: si ya se tocó a mano,
  -- no se pisa.
  update leads
     set estado = 'TIBIO'
   where id = l_cami
     and inmobiliaria_id = v_inmo
     and estado = 'FRIO';

  -- Un contacto real de hace entre 24 y 40 días cada uno, y ningún seguimiento
  -- agendado (el seed base no les puso uno; se deja así a propósito).
  insert into interacciones (id, lead_id, agente_id, tipo, fecha, detalle) values
    ('de1e0005-0000-4000-8000-000000000014', l_seba, v_owner, 'WHATSAPP',
       (v_hoy - 38) + time '11:20',
       'Tercer mensaje por WhatsApp con opciones de la zona. Sin respuesta.'),
    ('de1e0005-0000-4000-8000-000000000015', l_cami, v_owner, 'LLAMADA',
       (v_hoy - 27) + time '16:40',
       'Le pasé precios de PH en Constitución. Dijo que lo iba a pensar y que me avisaba.')
  on conflict (id) do nothing;

  -- --- 2. Comprador, compra reservada y trámite avanzado -------------------
  -- El lead va antes que sus interacciones (FK) y la operación antes que sus
  -- pasos. No tiene fecha_proximo_seguimiento: su último contacto es de hace 4
  -- días, así que no entra a "Por enfriarse".
  insert into leads (id, inmobiliaria_id, agente_id, asignado_a, nombre, apellido, telefono, email, origen, estado, descripcion_inicial, fecha_ingreso) values
    (l_ramiro, v_inmo, v_owner, v_owner, 'Ramiro', 'Castellano', '223 541-7709', 'ramiro.castellano@mail.com', 'REFERIDO', 'CALIENTE',
       'Busca casa en Playa Grande para mudarse con la familia. Vende su departamento del Centro y compra con ese dinero.',
       v_hoy - 48)
  on conflict (id) do nothing;

  -- La historia, de la primera consulta al trámite. Cada contacto real cae en
  -- la fecha de lo que cuenta: la reserva y los pasos de abajo usan las mismas.
  insert into interacciones (id, lead_id, agente_id, tipo, fecha, detalle) values
    ('de1e0005-0000-4000-8000-000000000016', l_ramiro, v_owner, 'WHATSAPP',      (v_hoy - 46) + time '10:15',
       'Le pasé fotos y la ficha de Almafuerte 450. Quiere verla con su esposa.'),
    ('de1e0005-0000-4000-8000-000000000017', l_ramiro, v_owner, 'VISITA',        (v_hoy - 41) + time '17:00',
       'Visitamos Almafuerte 450 con su esposa. Les encantó el jardín y la dependencia.'),
    ('de1e0005-0000-4000-8000-000000000018', l_ramiro, v_owner, 'REUNION',       (v_hoy - 33) + time '12:30',
       'Nos juntamos en la oficina. Ofertó USD 310.000 y lo transmití al propietario.'),
    ('de1e0005-0000-4000-8000-000000000019', l_ramiro, v_owner, 'LLAMADA',       (v_hoy - 31) + time '18:10',
       'El propietario aceptó USD 320.000. Quedamos en firmar la reserva.'),
    ('de1e0005-0000-4000-8000-000000000020', l_ramiro, v_owner, 'REUNION',       (v_hoy - 30) + time '11:00',
       'Firmó la reserva y dejó la seña.'),
    ('de1e0005-0000-4000-8000-000000000021', l_ramiro, v_owner, 'NOTA_INTERNA',  (v_hoy - 30) + time '13:00',
       'Reserva firmada por USD 320.000. Falta pedir presupuestos de escribanía.'),
    ('de1e0005-0000-4000-8000-000000000022', l_ramiro, v_owner, 'WHATSAPP',      (v_hoy - 26) + time '09:40',
       'Le pasé tres presupuestos de escribanías para que elija.'),
    ('de1e0005-0000-4000-8000-000000000023', l_ramiro, v_owner, 'LLAMADA',       (v_hoy - 21) + time '15:20',
       'Eligió la escribanía Ríos y Asociados. Le expliqué qué documentación llevar.'),
    ('de1e0005-0000-4000-8000-000000000024', l_ramiro, v_owner, 'EMAIL',         (v_hoy - 14) + time '10:50',
       'Mandé su documentación a la escribanía.'),
    ('de1e0005-0000-4000-8000-000000000025', l_ramiro, v_owner, 'WHATSAPP',      (v_hoy - 4) + time '16:05',
       'Le avisé que los certificados ya están pedidos y que la escribanía confirma fecha de escritura.')
  on conflict (id) do nothing;

  insert into operaciones (id, inmobiliaria_id, agente_id, lead_id, propiedad_id, busqueda_id, tipo, estado, titulo, monto, moneda, notas, fecha_reserva) values
    (o_compra, v_inmo, v_owner, l_ramiro, p_playa, null, 'COMPRA', 'RESERVADA',
       'Compra casa Playa Grande - Ramiro Castellano', 320000, 'USD',
       'Oferta aceptada y reservada con seña. Trámite en la escribanía, faltan los certificados.',
       v_hoy - 30)
  on conflict (id) do nothing;

  -- Cuatro pasos hechos, en orden y con fechas coherentes con la reserva de
  -- hace 30 días (y con las interacciones de arriba). CERTIFICADOS_RECIBIDOS
  -- queda sin fila (= pendiente) y la ESCRITURA tiene fecha prevista pero no
  -- completada. Los datos de la escribanía viven solo en la fila
  -- ESCRIBANIA_ELEGIDA (lo exige un CHECK).
  insert into operacion_tramite_pasos
    (id, inmobiliaria_id, operacion_id, paso, fecha_completado, fecha_prevista,
     escribania_nombre, presupuesto_monto, presupuesto_moneda, completado_por) values
    ('de210008-0000-4000-8000-000000000001', v_inmo, o_compra, 'PRESUPUESTOS_PEDIDOS',
       v_hoy - 26, null, null, null, null, v_owner),
    ('de210008-0000-4000-8000-000000000002', v_inmo, o_compra, 'ESCRIBANIA_ELEGIDA',
       v_hoy - 21, null, 'Escribanía Ríos y Asociados', 2450, 'USD', v_owner),
    ('de210008-0000-4000-8000-000000000003', v_inmo, o_compra, 'DOCUMENTACION_ENVIADA',
       v_hoy - 14, null, null, null, null, v_owner),
    ('de210008-0000-4000-8000-000000000004', v_inmo, o_compra, 'CERTIFICADOS_PEDIDOS',
       v_hoy - 9, null, null, null, null, v_owner),
    ('de210008-0000-4000-8000-000000000005', v_inmo, o_compra, 'ESCRITURA',
       null, v_hoy + 18, null, null, null, null)
  on conflict do nothing;

  -- La propiedad pasa a RESERVADA a mano, como lo haría el agente. Solo si
  -- todavía está DISPONIBLE: si ya se tocó, no se pisa.
  update propiedades
     set estado = 'RESERVADA'
   where id = p_playa
     and inmobiliaria_id = v_inmo
     and estado = 'DISPONIBLE';

  -- --- 3. Fechas de contacto: solo contactos reales ------------------------
  -- El trigger de interacciones las escribe con cualquier tipo. Se recalculan
  -- para TODOS los leads del seed (no solo los nuevos): así también quedan bien
  -- los que tenían una nota interna o una consulta como "último contacto". Un
  -- lead sin contactos reales queda con las dos en null.
  update leads l
     set fecha_primer_contacto_real = r.primero,
         fecha_ultimo_contacto_real = r.ultimo
    from (
      select x.id,
             (select min(i.fecha) from interacciones i
               where i.lead_id = x.id and es_contacto_real(i.tipo)) as primero,
             (select max(i.fecha) from interacciones i
               where i.lead_id = x.id and es_contacto_real(i.tipo)) as ultimo
        from leads x
       where x.inmobiliaria_id = v_inmo
         and x.id::text like 'de1a0001-%'
    ) r
   where l.id = r.id
     and l.inmobiliaria_id = v_inmo
     and (l.fecha_primer_contacto_real is distinct from r.primero
          or l.fecha_ultimo_contacto_real is distinct from r.ultimo);

  raise notice 'Complemento del manual aplicado sobre la inmobiliaria % (hoy del seed: %)', v_inmo, v_hoy;
end $$;

commit;
