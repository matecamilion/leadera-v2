-- ---------------------------------------------------------------------------
-- Refresco de fechas del seed de demo (test@leadera.com)
--
-- NO es una migración: vive fuera de supabase/migrations/ a propósito. Se corre
-- a mano desde el SQL Editor, cada vez que haya que sacar capturas con el seed
-- viejo.
--
-- Qué hace: corre TODAS las fechas relativas del seed (el base y el complemento
-- del manual) la misma cantidad de días hacia adelante, hasta que el "hoy" del
-- seed coincida con la fecha de hoy en Buenos Aires. Así "hoy", "ayer", "vencido"
-- y "hace 24 días" conservan su significado.
--
-- Cómo sabe cuánto correr: el seed base crea la tarea de1f0006-…01 con fecha =
-- v_hoy (una columna `date`, sin hora ni zona). Esa fecha es el ancla. Corrimiento
-- = hoy en Buenos Aires - fecha del ancla. Es el enfoque más simple y seguro
-- porque no necesita guardar estado aparte ni adivinar cuándo se aplicó el seed.
--
-- Idempotente: al terminar, el ancla queda en la fecha de hoy, y una segunda
-- corrida el mismo día ve corrimiento 0 y no toca nada.
--
-- Qué toca (todo acotado por la inmobiliaria de test@leadera.com y por el
-- prefijo de ids del seed):
--   leads (de1a0001):        fecha_ingreso, fecha_proximo_seguimiento
--   interacciones (de1e0005): fecha
--   tareas (de1f0006):       fecha
--   visitas (de200007):      fecha
--   operaciones (de1d0004):  fecha_cierre, fecha_reserva
--   operacion_tramite_pasos (de210008): fecha_completado, fecha_prevista
-- y después recalcula fecha_primer/ultimo_contacto_real de los leads con la
-- misma regla que el complemento (solo contactos reales).
--
-- Lo que NO toca: created_at / updated_at (son las fechas de carga, no del
-- negocio), ni nada fuera de los ids del seed, ni esquema, RLS o policies.
-- Si se corre sin haber aplicado el seed base, aborta sin escribir nada.
-- ---------------------------------------------------------------------------

begin;

do $$
declare
  v_inmo   uuid;
  v_ancla  date;
  v_hoy    date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_delta  int;
  v_dias   interval;
begin
  -- --- 0. Resolver el inquilino y el ancla, o abortar ----------------------
  select i.id
    into v_inmo
  from inmobiliarias i
  join profiles p on p.inmobiliaria_id = i.id and p.rol = 'DUENO'
  where p.email = 'test@leadera.com';

  if v_inmo is null then
    raise exception 'No se encontró la inmobiliaria de test@leadera.com. Abortado sin escribir nada.';
  end if;

  select t.fecha
    into v_ancla
  from tareas t
  where t.id = 'de1f0006-0000-4000-8000-000000000001'
    and t.inmobiliaria_id = v_inmo;

  if v_ancla is null then
    raise exception 'Falta el seed base (tarea de1f0006-…01). Abortado sin escribir nada.';
  end if;

  v_delta := v_hoy - v_ancla;

  if v_delta < 0 then
    raise exception 'El ancla del seed (%) está en el futuro respecto de hoy (%). Revisalo a mano. Abortado sin escribir nada.', v_ancla, v_hoy;
  end if;

  if v_delta = 0 then
    raise notice 'Las fechas del seed ya están al día (hoy = %). No se cambió nada.', v_hoy;
    return;
  end if;

  if v_delta > 730 then
    raise exception 'El seed está atrasado % días: es raro. Revisalo a mano. Abortado sin escribir nada.', v_delta;
  end if;

  v_dias := make_interval(days => v_delta);

  -- --- 1. Leads ------------------------------------------------------------
  update leads
     set fecha_ingreso = fecha_ingreso + v_dias,
         fecha_proximo_seguimiento = fecha_proximo_seguimiento + v_dias
   where inmobiliaria_id = v_inmo
     and id::text like 'de1a0001-%';

  -- --- 2. Interacciones (no tienen inmobiliaria_id: se acotan por sus leads) -
  update interacciones
     set fecha = fecha + v_dias
   where id::text like 'de1e0005-%'
     and lead_id in (select id from leads
                      where inmobiliaria_id = v_inmo
                        and id::text like 'de1a0001-%');

  -- --- 3. Tareas y visitas -------------------------------------------------
  update tareas
     set fecha = fecha + v_dias
   where inmobiliaria_id = v_inmo
     and id::text like 'de1f0006-%';

  update visitas
     set fecha = fecha + v_dias
   where inmobiliaria_id = v_inmo
     and id::text like 'de200007-%';

  -- --- 4. Operaciones y trámite --------------------------------------------
  update operaciones
     set fecha_cierre  = fecha_cierre + v_dias,
         fecha_reserva = fecha_reserva + v_dias
   where inmobiliaria_id = v_inmo
     and id::text like 'de1d0004-%';

  update operacion_tramite_pasos
     set fecha_completado = fecha_completado + v_dias,
         fecha_prevista   = fecha_prevista + v_dias
   where inmobiliaria_id = v_inmo
     and id::text like 'de210008-%';

  -- --- 5. Fechas de contacto: solo contactos reales -------------------------
  -- Mismo cálculo que el complemento. Se hace al final porque las interacciones
  -- ya se corrieron, y por si un trigger tocó estas columnas en el medio.
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

  raise notice 'Fechas del seed corridas % días (de % a %).', v_delta, v_ancla, v_hoy;
end $$;

commit;
