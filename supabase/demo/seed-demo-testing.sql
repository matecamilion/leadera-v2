-- ---------------------------------------------------------------------------
-- Datos de demo para la inmobiliaria de testing (test@leadera.com)
--
-- NO es una migración: vive fuera de supabase/migrations/ a propósito, para que
-- `supabase db push` nunca lo aplique solo. Se corre a mano desde el SQL Editor.
--
-- Todo pasa dentro de un único bloque DO, o sea una sola transacción: si algo
-- falla —por ejemplo un trigger de cuota— no queda media demo cargada.
--
-- La inmobiliaria y el dueño se resuelven por el email del DUENO y se abortan
-- si no resuelven a exactamente una fila. Ningún id está hardcodeado: es lo que
-- garantiza que esto no pueda tocar otra inmobiliaria.
--
-- Idempotente: todos los ids son fijos y cada INSERT lleva ON CONFLICT DO
-- NOTHING, así que se puede correr dos veces sin duplicar nada.
-- ---------------------------------------------------------------------------

do $$
declare
  v_inmo  uuid;
  v_owner uuid;
  v_hoy   date := current_date;

  -- Ids fijos de las piezas que participan del matching, para poder
  -- consultarlas después sin tener que buscarlas por nombre.
  b_depto uuid := 'de1c0003-0000-4000-8000-000000000001';
  b_casa  uuid := 'de1c0003-0000-4000-8000-000000000002';
  b_local uuid := 'de1c0003-0000-4000-8000-000000000003';

  p_depto uuid := 'de1b0002-0000-4000-8000-000000000001';
  p_casa  uuid := 'de1b0002-0000-4000-8000-000000000002';
  p_local uuid := 'de1b0002-0000-4000-8000-000000000003';
begin
  -- --- 0. Resolver el inquilino, o abortar --------------------------------
  select i.id, p.id
    into v_inmo, v_owner
  from inmobiliarias i
  join profiles p on p.inmobiliaria_id = i.id and p.rol = 'DUENO'
  where p.email = 'test@leadera.com';

  if v_inmo is null then
    raise exception 'No se encontró la inmobiliaria de test@leadera.com. Abortado sin escribir nada.';
  end if;

  -- --- 1. Que no se bloquee durante la demo -------------------------------
  -- TRIAL y no ACTIVA: la cuenta no tiene plan contratado ni preapproval en
  -- Mercado Pago, y marcarla ACTIVA sin nada de eso es un estado inventado que
  -- después confunde. TRIAL tampoco está en ESTADOS_BLOQUEANTES, así que
  -- alcanza para que SuscripcionGuard la deje pasar.
  update inmobiliarias
     set estado_suscripcion        = 'TRIAL',
         fecha_fin_trial           = now() + interval '60 days',
         fecha_ultimo_pago_fallido = null
   where id = v_inmo;

  -- --- 2. Leads -----------------------------------------------------------
  -- Fechas de ingreso escalonadas hacia atrás para que no parezca una carga
  -- masiva de hoy. `fecha_ultimo_contacto_real` NO se setea acá: la escribe el
  -- trigger de interacciones en el paso 5.
  insert into leads (id, inmobiliaria_id, agente_id, nombre, apellido, telefono, email, origen, estado, descripcion_inicial, fecha_ingreso) values
    ('de1a0001-0000-4000-8000-000000000001', v_inmo, v_owner, 'Martina',  'Beltrán',   '223 545-1180', 'martina.beltran@mail.com',  'META_ADS',  'CALIENTE', 'Busca 2 ambientes en Centro para mudarse antes de fin de año.', v_hoy - 34),
    ('de1a0001-0000-4000-8000-000000000002', v_inmo, v_owner, 'Ignacio',  'Sosa',      '223 512-4477', 'nacho.sosa@mail.com',       'WHATSAPP',  'CALIENTE', 'Quiere comprar casa en Los Troncos, tiene el dinero disponible.', v_hoy - 28),
    ('de1a0001-0000-4000-8000-000000000003', v_inmo, v_owner, 'Carolina', 'Vega',      '223 566-9021', 'caro.vega@mail.com',        'REFERIDO',  'CALIENTE', 'Inversora, busca local comercial sobre Güemes para renta.', v_hoy - 21),
    ('de1a0001-0000-4000-8000-000000000004', v_inmo, v_owner, 'Federico', 'Ibarra',    '223 503-3312', 'fede.ibarra@mail.com',      'LANDING',   'TIBIO',    'Consultó por departamentos en La Perla, sin apuro.', v_hoy - 40),
    ('de1a0001-0000-4000-8000-000000000005', v_inmo, v_owner, 'Lucía',    'Ferrari',   '223 578-6654', 'lucia.ferrari@mail.com',    'META_ADS',  'TIBIO',    'Pareja joven, primer departamento, todavía averiguando crédito.', v_hoy - 37),
    ('de1a0001-0000-4000-8000-000000000006', v_inmo, v_owner, 'Rodrigo',  'Peralta',   '223 534-2087', 'rodrigo.peralta@mail.com',  'WHATSAPP',  'TIBIO',    'Quiere alquilar monoambiente cerca de la universidad.', v_hoy - 26),
    ('de1a0001-0000-4000-8000-000000000007', v_inmo, v_owner, 'Valeria',  'Quiroga',   '223 590-7743', 'vale.quiroga@mail.com',     'REFERIDO',  'TIBIO',    'Le interesó Playa Grande, pide fotos y planos.', v_hoy - 18),
    ('de1a0001-0000-4000-8000-000000000008', v_inmo, v_owner, 'Sebastián','Aguirre',   '223 521-1194', 'seba.aguirre@mail.com',     'LANDING',   'FRIO',     'Consultó una vez y no volvió a responder mensajes.', v_hoy - 52),
    ('de1a0001-0000-4000-8000-000000000009', v_inmo, v_owner, 'Camila',   'Rossi',     '223 587-3360', 'camila.rossi@mail.com',     'META_ADS',  'FRIO',     'Pidió precios de PH en Constitución, dijo que lo iba a pensar.', v_hoy - 46),
    ('de1a0001-0000-4000-8000-000000000010', v_inmo, v_owner, 'Tomás',    'Maidana',   '223 549-8825', 'tomas.maidana@mail.com',    'WHATSAPP',  'FRIO',     'Presupuesto por debajo de lo que hay en cartera hoy.', v_hoy - 44),
    ('de1a0001-0000-4000-8000-000000000011', v_inmo, v_owner, 'Agustina', 'Lopresti',  '223 573-5518', 'agus.lopresti@mail.com',    'REFERIDO',  'GANADO',   'Compró el PH de Chauvin. Cliente cerrada, pidió seguir en contacto.', v_hoy - 75),
    ('de1a0001-0000-4000-8000-000000000012', v_inmo, v_owner, 'Nicolás',  'Ferreyra',  '223 515-6602', 'nico.ferreyra@mail.com',    'LANDING',   'GANADO',   'Alquiló el depto de San Carlos, contrato firmado.', v_hoy - 63),
    ('de1a0001-0000-4000-8000-000000000013', v_inmo, v_owner, 'Mariana',  'Godoy',     '223 556-4471', 'mariana.godoy@mail.com',    'META_ADS',  'INACTIVO', 'No responde hace más de un mes, se marcó inactiva.', v_hoy - 88),
    ('de1a0001-0000-4000-8000-000000000014', v_inmo, v_owner, 'Javier',   'Ocampo',    '223 528-9937', 'javier.ocampo@mail.com',    'WHATSAPP',  'INACTIVO', 'Compró por otra inmobiliaria, avisó que ya no busca.', v_hoy - 70),
    -- Sin estado => la UI los muestra como NUEVO, que es el sexto estado.
    ('de1a0001-0000-4000-8000-000000000015', v_inmo, v_owner, 'Paula',    'Zárate',    '223 561-2249', 'paula.zarate@mail.com',     'META_ADS',  null,       'Entró por la campaña de Instagram, todavía sin contactar.', v_hoy - 3),
    ('de1a0001-0000-4000-8000-000000000016', v_inmo, v_owner, 'Gonzalo',  'Miranda',   '223 539-7714', 'gonza.miranda@mail.com',    'LANDING',   null,       'Dejó los datos en la landing pidiendo tasación.', v_hoy - 2),
    ('de1a0001-0000-4000-8000-000000000017', v_inmo, v_owner, 'Florencia','Cabrera',   '223 582-1136', 'flor.cabrera@mail.com',     'WHATSAPP',  null,       'Escribió por WhatsApp preguntando por alquileres temporarios.', v_hoy - 1),
    ('de1a0001-0000-4000-8000-000000000018', v_inmo, v_owner, 'Emiliano', 'Navarro',   '223 507-4408', 'emi.navarro@mail.com',      'REFERIDO',  null,       'Lo recomendó Agustina Lopresti, busca depto para la hija.', v_hoy)
  on conflict (id) do nothing;

  -- --- 3. Propiedades -----------------------------------------------------
  -- `fotos_urls` es text[]; se cargan placeholders con semilla fija para que
  -- cada propiedad muestre siempre la misma imagen y la demo no parpadee.
  insert into propiedades (id, inmobiliaria_id, agente_id, direccion, zona, tipo, estado, finalidad, precio, moneda, ambientes, banos, cocheras, metros_cuadrados, metros_cubiertos, expensas, disposicion, descripcion, fotos_urls, lead_propietario_id) values
    (p_depto, v_inmo, v_owner, 'Rivadavia 2840, piso 6',  'Centro',        'DEPARTAMENTO',    'DISPONIBLE', 'VENTA',    115000, 'USD', 3, 2, 1,  68,  62, 85000,  'FRENTE',      'Tres ambientes al frente, muy luminoso, a dos cuadras de la peatonal.', array['https://picsum.photos/seed/leadera-depto-centro/1200/800','https://picsum.photos/seed/leadera-depto-centro-2/1200/800'], 'de1a0001-0000-4000-8000-000000000011'),
    (p_casa,  v_inmo, v_owner, 'Alvear 3355',             'Los Troncos',   'CASA',            'DISPONIBLE', 'VENTA',    265000, 'USD', 5, 3, 2, 180, 155, null,   'FRENTE',      'Casa sobre lote propio, jardín y parrilla. Impecable estado.', array['https://picsum.photos/seed/leadera-casa-troncos/1200/800'], null),
    (p_local, v_inmo, v_owner, 'Güemes 2915',             'Güemes',        'LOCAL_COMERCIAL', 'DISPONIBLE', 'VENTA',     98000, 'USD', 1, 1, 0,  75,  75, 42000,  'FRENTE',      'Local a la calle en plena zona comercial, con vidriera amplia.', array['https://picsum.photos/seed/leadera-local-guemes/1200/800'], null),
    ('de1b0002-0000-4000-8000-000000000004', v_inmo, v_owner, 'Falucho 1120, piso 3',    'La Perla',      'DEPARTAMENTO',    'DISPONIBLE', 'ALQUILER',   450, 'USD', 2, 1, 0,  48,  44, 60000, 'CONTRAFRENTE','Dos ambientes a cuatro cuadras de la playa, apto profesional.', array['https://picsum.photos/seed/leadera-perla/1200/800'], null),
    ('de1b0002-0000-4000-8000-000000000005', v_inmo, v_owner, 'Almafuerte 450',          'Playa Grande',  'CASA',            'DISPONIBLE', 'VENTA',    340000, 'USD', 6, 4, 2, 240, 210, null,  'FRENTE',      'Casa de categoría a metros del golf, con dependencia.', array['https://picsum.photos/seed/leadera-playagrande/1200/800'], null),
    ('de1b0002-0000-4000-8000-000000000006', v_inmo, v_owner, 'San Luis 3390, piso 2',   'Centro',        'DEPARTAMENTO',    'DISPONIBLE', 'ALQUILER',   380, 'USD', 1, 1, 0,  35,  32, 48000, 'INTERNO',     'Monoambiente ideal estudiante, edificio con seguridad.', array['https://picsum.photos/seed/leadera-mono-centro/1200/800'], null),
    ('de1b0002-0000-4000-8000-000000000007', v_inmo, v_owner, 'Rawson 2210',             'Chauvin',       'PH',              'RESERVADA',  'VENTA',    132000, 'USD', 4, 2, 1,  95,  88, null,  'FRENTE',      'PH reciclado a nuevo, patio propio, sin expensas.', array['https://picsum.photos/seed/leadera-ph-chauvin/1200/800'], null),
    ('de1b0002-0000-4000-8000-000000000008', v_inmo, v_owner, 'Olavarría 2680, piso 8',  'Constitución',  'DEPARTAMENTO',    'RESERVADA',  'VENTA',    158000, 'USD', 3, 2, 1,  82,  76, 95000, 'FRENTE',      'Piso alto con vista abierta, cochera cubierta incluida.', array['https://picsum.photos/seed/leadera-constitucion/1200/800'], null),
    ('de1b0002-0000-4000-8000-000000000009', v_inmo, v_owner, 'Castelli 1745',           'San Carlos',    'DEPARTAMENTO',    'ALQUILADA',  'ALQUILER',   410, 'USD', 2, 1, 0,  52,  50, 55000, 'CONTRAFRENTE','Dos ambientes alquilado con contrato vigente hasta el año próximo.', array['https://picsum.photos/seed/leadera-sancarlos/1200/800'], null),
    ('de1b0002-0000-4000-8000-000000000010', v_inmo, v_owner, 'Brown 1890',              'Stella Maris',  'PH',              'VENDIDA',    'VENTA',    124000, 'USD', 3, 1, 0,  70,  64, null,  'FRENTE',      'PH vendido el mes pasado, queda en el historial de la cartera.', array['https://picsum.photos/seed/leadera-stellamaris/1200/800'], null)
  on conflict (id) do nothing;

  -- --- 4. Búsquedas (lo que habilita el matching) -------------------------
  -- Cada criterio cargado es un criterio que el RPC evalúa. En las dos primeras
  -- TODOS los criterios los cumple la propiedad apuntada, así que deberían dar
  -- score alto; la tercera falla a propósito en m2_min y ambientes_min para
  -- mostrar cómo se ve un match parcial.
  insert into busquedas (id, inmobiliaria_id, lead_id, agente_id, tipo_propiedad, zona, precio_min, precio_max, ambientes_min, banos_min, cocheras_min, m2_min, activa, notas) values
    (b_depto, v_inmo, 'de1a0001-0000-4000-8000-000000000001', v_owner, 'DEPARTAMENTO',    'Centro',      90000, 130000, 3, 2, 1,  60, true, 'Tres ambientes al frente, Centro, con cochera.'),
    (b_casa,  v_inmo, 'de1a0001-0000-4000-8000-000000000002', v_owner, 'CASA',            'Los Troncos',200000, 300000, 4, 3, 2, 150, true, 'Casa en Los Troncos con jardín, mínimo 4 ambientes.'),
    (b_local, v_inmo, 'de1a0001-0000-4000-8000-000000000003', v_owner, 'LOCAL_COMERCIAL', 'Güemes',      80000, 110000, 2, 2, 1, 120, true, 'Local sobre Güemes para renta. Pide más metros de los que hay.')
  on conflict (id) do nothing;

  -- --- 5. Operaciones -----------------------------------------------------
  -- `agente_id` es NOT NULL en esta tabla (a diferencia de leads/propiedades).
  -- Las COMPRA son las que se cuelgan de una búsqueda y habilitan el matching.
  insert into operaciones (id, inmobiliaria_id, agente_id, lead_id, propiedad_id, busqueda_id, tipo, estado, titulo, monto, moneda, notas, fecha_cierre) values
    ('de1d0004-0000-4000-8000-000000000001', v_inmo, v_owner, 'de1a0001-0000-4000-8000-000000000001', null,    b_depto, 'COMPRA',            'PUBLICADA',      'Compra 3 amb. Centro - Martina Beltrán',  120000, 'USD', 'Busca cerrar antes de fin de año.', null),
    ('de1d0004-0000-4000-8000-000000000002', v_inmo, v_owner, 'de1a0001-0000-4000-8000-000000000002', null,    b_casa,  'COMPRA',            'EN_NEGOCIACION', 'Compra casa Los Troncos - Ignacio Sosa',  265000, 'USD', 'Ofertó 250.000, esperando respuesta del propietario.', null),
    ('de1d0004-0000-4000-8000-000000000003', v_inmo, v_owner, 'de1a0001-0000-4000-8000-000000000003', null,    b_local, 'COMPRA',            'PUBLICADA',      'Compra local Güemes - Carolina Vega',      98000, 'USD', 'Inversión para renta, mira varias opciones.', null),
    ('de1d0004-0000-4000-8000-000000000004', v_inmo, v_owner, 'de1a0001-0000-4000-8000-000000000007', p_casa,  null,    'VENTA',             'PUBLICADA',      'Venta - Alvear 3355',                     265000, 'USD', 'Publicada en portales, con visitas agendadas.', null),
    ('de1d0004-0000-4000-8000-000000000005', v_inmo, v_owner, 'de1a0001-0000-4000-8000-000000000006', 'de1b0002-0000-4000-8000-000000000006', null, 'ALQUILER', 'RESERVADA', 'Alquiler monoambiente - Rodrigo Peralta',    380, 'USD', 'Reservado con seña, falta firmar.', null),
    ('de1d0004-0000-4000-8000-000000000006', v_inmo, v_owner, 'de1a0001-0000-4000-8000-000000000011', 'de1b0002-0000-4000-8000-000000000010', null, 'VENTA',    'CERRADA_GANADA', 'Venta PH Stella Maris - Agustina Lopresti', 124000, 'USD', 'Escritura firmada, operación cerrada.', v_hoy - 30)
  on conflict (id) do nothing;

  -- --- 6. Interacciones ---------------------------------------------------
  -- Se insertan DESPUÉS de los leads a propósito: un trigger de la base escribe
  -- `fecha_primer_contacto_real` y `fecha_ultimo_contacto_real` en el lead a
  -- partir de estas filas. Setear esas columnas a mano antes sería trabajo que
  -- el trigger pisa igual.
  insert into interacciones (id, lead_id, agente_id, tipo, fecha, detalle) values
    ('de1e0005-0000-4000-8000-000000000001', 'de1a0001-0000-4000-8000-000000000001', v_owner, 'WHATSAPP',     now() - interval '9 days',  'Le pasé tres opciones en Centro, le gustó la de Rivadavia.'),
    ('de1e0005-0000-4000-8000-000000000002', 'de1a0001-0000-4000-8000-000000000001', v_owner, 'LLAMADA',      now() - interval '2 days',  'Quiere visitar el departamento esta semana.'),
    ('de1e0005-0000-4000-8000-000000000003', 'de1a0001-0000-4000-8000-000000000002', v_owner, 'REUNION',      now() - interval '6 days',  'Nos juntamos en la oficina, definió zona y presupuesto.'),
    ('de1e0005-0000-4000-8000-000000000004', 'de1a0001-0000-4000-8000-000000000002', v_owner, 'VISITA',       now() - interval '3 days',  'Visitamos Alvear 3355, le gustó mucho.'),
    ('de1e0005-0000-4000-8000-000000000005', 'de1a0001-0000-4000-8000-000000000002', v_owner, 'LLAMADA',      now() - interval '1 day',   'Hizo una oferta de 250.000, la transmití al propietario.'),
    ('de1e0005-0000-4000-8000-000000000006', 'de1a0001-0000-4000-8000-000000000003', v_owner, 'CONSULTA',     now() - interval '7 days',  'Consultó rentabilidad esperada del local de Güemes.'),
    ('de1e0005-0000-4000-8000-000000000007', 'de1a0001-0000-4000-8000-000000000004', v_owner, 'WHATSAPP',     now() - interval '12 days', 'Le mandé el link de La Perla, quedó en mirarlo.'),
    ('de1e0005-0000-4000-8000-000000000008', 'de1a0001-0000-4000-8000-000000000005', v_owner, 'LLAMADA',      now() - interval '15 days', 'Todavía esperando la aprobación del crédito hipotecario.'),
    ('de1e0005-0000-4000-8000-000000000009', 'de1a0001-0000-4000-8000-000000000006', v_owner, 'VISITA',       now() - interval '4 days',  'Vio el monoambiente de San Luis, quiere reservarlo.'),
    ('de1e0005-0000-4000-8000-000000000010', 'de1a0001-0000-4000-8000-000000000007', v_owner, 'EMAIL',        now() - interval '5 days',  'Le mandé fotos y plano de Playa Grande.'),
    ('de1e0005-0000-4000-8000-000000000011', 'de1a0001-0000-4000-8000-000000000008', v_owner, 'NOTA_INTERNA', now() - interval '25 days', 'Tres intentos de contacto sin respuesta. Pasa a frío.'),
    ('de1e0005-0000-4000-8000-000000000012', 'de1a0001-0000-4000-8000-000000000013', v_owner, 'NOTA_INTERNA', now() - interval '35 days', 'Sin respuesta hace más de un mes. Se marca inactiva.'),
    ('de1e0005-0000-4000-8000-000000000013', 'de1a0001-0000-4000-8000-000000000011', v_owner, 'SEGUIMIENTO',  now() - interval '20 days', 'Post-venta: quedó conforme, pidió que le avise de inversiones.')
  on conflict (id) do nothing;

  -- --- 7. Próximos seguimientos -------------------------------------------
  -- Va al final y como UPDATE, no en el INSERT de leads: el trigger del paso 6
  -- no toca esta columna, pero sí toca las otras dos fechas, así que conviene
  -- fijar ésta cuando ya no se va a escribir nada más sobre el lead.
  --
  -- Sin esta fecha el lead NO aparece en los seguimientos de Mi día: la sección
  -- filtra por fecha_proximo_seguimiento entre hoy 00:00 y mañana 00:00.
  update leads set fecha_proximo_seguimiento = v_hoy + time '09:30'
   where id in ('de1a0001-0000-4000-8000-000000000001',
                'de1a0001-0000-4000-8000-000000000004');

  update leads set fecha_proximo_seguimiento = v_hoy + time '11:00'
   where id = 'de1a0001-0000-4000-8000-000000000003';

  update leads set fecha_proximo_seguimiento = v_hoy + time '16:00'
   where id in ('de1a0001-0000-4000-8000-000000000007',
                'de1a0001-0000-4000-8000-000000000015');

  -- Uno vencido: cae en "Prioritarios" en vez de en "Seguimientos de hoy".
  update leads set fecha_proximo_seguimiento = (v_hoy - 2) + time '10:00'
   where id = 'de1a0001-0000-4000-8000-000000000005';

  -- --- 8. Tareas ----------------------------------------------------------
  insert into tareas (id, inmobiliaria_id, asignado_a, creado_por, titulo, descripcion, fecha, hora, estado, lead_id, propiedad_id) values
    ('de1f0006-0000-4000-8000-000000000001', v_inmo, v_owner, v_owner, 'Llamar a Martina Beltrán',        'Coordinar la visita al depto de Rivadavia.', v_hoy,     '09:30', 'PENDIENTE',  'de1a0001-0000-4000-8000-000000000001', null),
    ('de1f0006-0000-4000-8000-000000000002', v_inmo, v_owner, v_owner, 'Responder oferta de Ignacio',     'El propietario contestó por los 250.000.',   v_hoy,     '11:00', 'PENDIENTE',  'de1a0001-0000-4000-8000-000000000002', null),
    ('de1f0006-0000-4000-8000-000000000003', v_inmo, v_owner, v_owner, 'Mandar tasación a Gonzalo',       'Pidió tasación por la landing.',             v_hoy,     '14:00', 'PENDIENTE',  'de1a0001-0000-4000-8000-000000000016', null),
    ('de1f0006-0000-4000-8000-000000000004', v_inmo, v_owner, v_owner, 'Sacar fotos nuevas de Güemes 2915','Las actuales son del verano pasado.',       v_hoy,     '17:00', 'PENDIENTE',  null, p_local),
    ('de1f0006-0000-4000-8000-000000000005', v_inmo, v_owner, v_owner, 'Llamar a Carolina Vega',          'Pasarle la rentabilidad estimada del local.', v_hoy + 1, '10:00', 'PENDIENTE',  'de1a0001-0000-4000-8000-000000000003', null),
    ('de1f0006-0000-4000-8000-000000000006', v_inmo, v_owner, v_owner, 'Preparar contrato de alquiler',   'Monoambiente de San Luis, falta firmar.',     v_hoy + 1, '12:30', 'PENDIENTE',  'de1a0001-0000-4000-8000-000000000006', null),
    ('de1f0006-0000-4000-8000-000000000007', v_inmo, v_owner, v_owner, 'Publicar Alvear 3355 en portales','Subir a los tres portales habituales.',       v_hoy + 1, '15:00', 'PENDIENTE',  null, p_casa),
    ('de1f0006-0000-4000-8000-000000000008', v_inmo, v_owner, v_owner, 'Contactar a Paula Zárate',        'Entró por Instagram, todavía sin contactar.', v_hoy,     '08:30', 'COMPLETADA', 'de1a0001-0000-4000-8000-000000000015', null)
  on conflict (id) do nothing;

  -- --- 9. Visitas ---------------------------------------------------------
  insert into visitas (id, inmobiliaria_id, asignado_a, creado_por, propiedad_id, lead_id, fecha, hora, estado, notas) values
    ('de200007-0000-4000-8000-000000000001', v_inmo, v_owner, v_owner, p_depto, 'de1a0001-0000-4000-8000-000000000001', v_hoy,     '16:00', 'AGENDADA',  'Primera visita, va con la hermana.'),
    ('de200007-0000-4000-8000-000000000002', v_inmo, v_owner, v_owner, p_casa,  'de1a0001-0000-4000-8000-000000000002', v_hoy,     '18:30', 'AGENDADA',  'Segunda visita, quiere ver el fondo con luz.'),
    ('de200007-0000-4000-8000-000000000003', v_inmo, v_owner, v_owner, p_local, 'de1a0001-0000-4000-8000-000000000003', v_hoy + 1, '10:30', 'AGENDADA',  'Va con su contador.'),
    ('de200007-0000-4000-8000-000000000004', v_inmo, v_owner, v_owner, 'de1b0002-0000-4000-8000-000000000004', 'de1a0001-0000-4000-8000-000000000004', v_hoy + 1, '17:00', 'AGENDADA', 'Le interesa la zona, primera visita.'),
    ('de200007-0000-4000-8000-000000000005', v_inmo, v_owner, v_owner, 'de1b0002-0000-4000-8000-000000000006', 'de1a0001-0000-4000-8000-000000000006', v_hoy - 4, '11:00', 'REALIZADA', 'Le gustó, quedó en reservar.')
  on conflict (id) do nothing;

  raise notice 'Seed de demo aplicado sobre la inmobiliaria %', v_inmo;
end $$;
