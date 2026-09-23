-- ===========================================================================
-- Limpieza de 10 cuentas basura — septiembre 2026
-- ===========================================================================
--
-- Borra 10 inmobiliarias de prueba o abandonadas y todo lo que cuelga de
-- ellas, incluidos sus perfiles y sus usuarios de auth.
--
-- NO es una migración: es de una sola vez, y por eso vive en `scripts/`.
--
-- ESCRITO PARA EL SQL EDITOR DE SUPABASE, que tiene tres limitaciones:
--   - sólo muestra el resultado de la ÚLTIMA consulta de cada ejecución;
--   - cada ejecución puede ir por otra conexión, así que una tabla temporal
--     no sobrevive de una corrida a la otra;
--   - no se puede dejar una transacción abierta y commitear después.
-- Por eso cada consulta de acá es autocontenida —la lista de ids va inline en
-- todas— y el borrado entero, con sus chequeos, entra en una sola ejecución.
--
-- CÓMO SE USA
--   1. Correr las consultas del bloque 1, de a una, y leer los resultados.
--   2. Guardar el resultado de la 1.5 (keys de Storage): después del borrado
--      ya no hay de dónde sacarlo.
--   3. Correr el bloque 2 (ENSAYO). Termina en ROLLBACK: no borra nada. Si no
--      tira error, el borrado es seguro.
--   4. Correr el bloque 3 (REAL). Es idéntico al ensayo, pero termina en
--      COMMIT.
--   5. Con lo guardado en el paso 2, borrar los archivos de Storage (bloque 4).
--
-- LAS FK (relevadas el 2026-09-24): ninguna de las que apuntan a
-- `inmobiliarias` es CASCADE, así que hay que borrar a mano y en orden. Sí
-- cascadean `profiles → auth.users` y `google_calendar_tokens → profiles`.


-- ===========================================================================
-- BLOQUE 1 · VERIFICACIÓN — sólo lecturas. Una consulta por ejecución.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1.1 · Identidad y salvaguardas, una fila por cuenta.
--       Mirar las cuatro últimas columnas: si alguna dice true, PARAR.
-- ---------------------------------------------------------------------------
with cuentas (id, nombre_esperado) as (values
  ('006c2d72-00bb-4d9c-9ff2-64a09a6a8ce2'::uuid, 'Spina bienes y Raices'),
  ('da15a248-ee4b-4056-a54c-86e105a00e49'::uuid, 'Aka'),
  ('c0334dec-20f7-4784-a27e-5ddd5b8ea357'::uuid, 'Akalestos'),
  ('5098b9d4-6b26-411a-be6b-98a003e499d9'::uuid, 'aaaa'),
  ('647a3c9c-a190-475f-9487-8ceeadc839b2'::uuid, 'Century 21 (marcospe)'),
  ('585b9ba6-7581-4957-bb30-926b9c86d44d'::uuid, 'pasaltoprop'),
  ('66a7f37e-c16d-4ad6-b225-eb2f1c8b6e00'::uuid, 'Varela Props'),
  ('66fc279e-a152-4381-b2ae-576bca8718cb'::uuid, 'Poido Corp'),
  ('946a9805-706c-438c-a051-a9973ef6d82b'::uuid, 'QA Visitas'),
  ('f1071aac-fadd-4ade-b73a-37e4d100864c'::uuid, 'QA Dueno Tareas')
)
select c.nombre_esperado,
       i.nombre                             as nombre_en_la_base,
       i.tipo_cuenta,
       i.estado_suscripcion,
       i.metodo_cobro,
       i.mp_preapproval_id,
       i.cancelacion_solicitada,
       i.created_at::date                   as alta,
       (i.id is null)                                    as alerta_no_existe,
       (i.id is not null and i.nombre is distinct from c.nombre_esperado)
                                                         as alerta_otro_nombre,
       (i.tipo_cuenta is distinct from 'CLIENTE')        as alerta_no_cliente,
       (i.mp_preapproval_id is not null
        and i.estado_suscripcion = 'ACTIVA'
        and i.cancelacion_solicitada = false)            as alerta_mp_activa
from cuentas c
left join public.inmobiliarias i on i.id = c.id
order by c.nombre_esperado;

-- ---------------------------------------------------------------------------
-- 1.2 · Cuántas filas caen en cada tabla, por cuenta, con una fila de TOTAL
--       al final. `interacciones` se cuenta por el lead, que es lo que la ata
--       a la inmobiliaria.
-- ---------------------------------------------------------------------------
with cuentas (id, nombre_esperado) as (values
  ('006c2d72-00bb-4d9c-9ff2-64a09a6a8ce2'::uuid, 'Spina bienes y Raices'),
  ('da15a248-ee4b-4056-a54c-86e105a00e49'::uuid, 'Aka'),
  ('c0334dec-20f7-4784-a27e-5ddd5b8ea357'::uuid, 'Akalestos'),
  ('5098b9d4-6b26-411a-be6b-98a003e499d9'::uuid, 'aaaa'),
  ('647a3c9c-a190-475f-9487-8ceeadc839b2'::uuid, 'Century 21 (marcospe)'),
  ('585b9ba6-7581-4957-bb30-926b9c86d44d'::uuid, 'pasaltoprop'),
  ('66a7f37e-c16d-4ad6-b225-eb2f1c8b6e00'::uuid, 'Varela Props'),
  ('66fc279e-a152-4381-b2ae-576bca8718cb'::uuid, 'Poido Corp'),
  ('946a9805-706c-438c-a051-a9973ef6d82b'::uuid, 'QA Visitas'),
  ('f1071aac-fadd-4ade-b73a-37e4d100864c'::uuid, 'QA Dueno Tareas')
),
detalle as (
  select c.nombre_esperado as cuenta,
         (select count(*) from public.profiles            t where t.inmobiliaria_id = c.id) as profiles,
         (select count(*) from public.leads               t where t.inmobiliaria_id = c.id) as leads,
         (select count(*) from public.propiedades         t where t.inmobiliaria_id = c.id) as propiedades,
         (select count(*) from public.operaciones         t where t.inmobiliaria_id = c.id) as operaciones,
         (select count(*) from public.busquedas           t where t.inmobiliaria_id = c.id) as busquedas,
         (select count(*) from public.tareas              t where t.inmobiliaria_id = c.id) as tareas,
         (select count(*) from public.tareas_series       t where t.inmobiliaria_id = c.id) as tareas_series,
         (select count(*) from public.visitas             t where t.inmobiliaria_id = c.id) as visitas,
         (select count(*) from public.invitaciones        t where t.inmobiliaria_id = c.id) as invitaciones,
         (select count(*) from public.eventos_facturacion t where t.inmobiliaria_id = c.id) as eventos_fact,
         (select count(*) from public.interacciones it
            join public.leads l on l.id = it.lead_id
           where l.inmobiliaria_id = c.id)                                                  as interacciones,
         (select count(*) from public.google_calendar_tokens g
            join public.profiles p on p.id = g.agente_id
           where p.inmobiliaria_id = c.id)                                                  as google_tokens
  from cuentas c
)
select cuenta, profiles, leads, propiedades, operaciones, busquedas, tareas,
       tareas_series, visitas, invitaciones, eventos_fact, interacciones, google_tokens
from detalle
union all
select 'TOTAL (' || count(*) || ' cuentas)',
       sum(profiles), sum(leads), sum(propiedades), sum(operaciones), sum(busquedas),
       sum(tareas), sum(tareas_series), sum(visitas), sum(invitaciones),
       sum(eventos_fact), sum(interacciones), sum(google_tokens)
from detalle
-- La fila de TOTAL siempre al final, sin depender de cómo ordene el alfabeto.
order by (cuenta like 'TOTAL%'), cuenta;

-- ---------------------------------------------------------------------------
-- 1.3 · Los usuarios de auth que se van. Conviene guardar esta lista.
-- ---------------------------------------------------------------------------
select i.nombre as inmobiliaria, p.id as user_id, p.email, p.rol, p.activo, p.es_superadmin
from public.profiles p
join public.inmobiliarias i on i.id = p.inmobiliaria_id
where p.inmobiliaria_id = any(array[
      '006c2d72-00bb-4d9c-9ff2-64a09a6a8ce2', 'da15a248-ee4b-4056-a54c-86e105a00e49',
      'c0334dec-20f7-4784-a27e-5ddd5b8ea357', '5098b9d4-6b26-411a-be6b-98a003e499d9',
      '647a3c9c-a190-475f-9487-8ceeadc839b2', '585b9ba6-7581-4957-bb30-926b9c86d44d',
      '66a7f37e-c16d-4ad6-b225-eb2f1c8b6e00', '66fc279e-a152-4381-b2ae-576bca8718cb',
      '946a9805-706c-438c-a051-a9973ef6d82b', 'f1071aac-fadd-4ade-b73a-37e4d100864c'
    ]::uuid[])
order by i.nombre, p.email;

-- ---------------------------------------------------------------------------
-- 1.4 · ¿Alguna tabla apunta a lo que vamos a borrar y el script no la toca?
--       Si aparece una tabla que no está en el bloque 2, PARAR y agregarla.
-- ---------------------------------------------------------------------------
select con.conrelid::regclass  as tabla_hija,
       con.confrelid::regclass as tabla_padre,
       con.conname,
       case con.confdeltype when 'a' then 'NO ACTION' when 'r' then 'RESTRICT'
                            when 'c' then 'CASCADE'   when 'n' then 'SET NULL'
                            when 'd' then 'SET DEFAULT' end as on_delete
from pg_constraint con
where con.contype = 'f'
  and con.confrelid in (
    'public.inmobiliarias'::regclass, 'public.profiles'::regclass,
    'public.leads'::regclass, 'public.propiedades'::regclass,
    'public.operaciones'::regclass, 'public.busquedas'::regclass,
    'public.tareas_series'::regclass, 'public.eventos_facturacion'::regclass
  )
order by con.confrelid::regclass::text, tabla_hija::text;

-- ---------------------------------------------------------------------------
-- 1.5 · Keys de Storage a borrar. GUARDAR ESTE RESULTADO antes del bloque 3:
--       después del borrado, las propiedades ya no existen.
-- ---------------------------------------------------------------------------
select p.inmobiliaria_id,
       p.id                                        as propiedad_id,
       coalesce(array_length(p.fotos_urls, 1), 0)  as fotos,
       p.id || '/'                                 as prefijo_en_el_bucket
from public.propiedades p
where p.inmobiliaria_id = any(array[
      '006c2d72-00bb-4d9c-9ff2-64a09a6a8ce2', 'da15a248-ee4b-4056-a54c-86e105a00e49',
      'c0334dec-20f7-4784-a27e-5ddd5b8ea357', '5098b9d4-6b26-411a-be6b-98a003e499d9',
      '647a3c9c-a190-475f-9487-8ceeadc839b2', '585b9ba6-7581-4957-bb30-926b9c86d44d',
      '66a7f37e-c16d-4ad6-b225-eb2f1c8b6e00', '66fc279e-a152-4381-b2ae-576bca8718cb',
      '946a9805-706c-438c-a051-a9973ef6d82b', 'f1071aac-fadd-4ade-b73a-37e4d100864c'
    ]::uuid[])
  and coalesce(array_length(p.fotos_urls, 1), 0) > 0
order by p.inmobiliaria_id, p.id;


-- ===========================================================================
-- BLOQUE 2 · ENSAYO — correr TODO de una vez. Termina en ROLLBACK.
-- ===========================================================================
-- No borra nada: hace el borrado completo, corre los chequeos y deshace todo.
-- Si termina sin error, el borrado real es seguro. Si algo falla, el mensaje
-- dice qué, y tampoco se tocó nada.

begin;

-- --- Salvaguardas. Cualquiera que salte aborta toda la transacción. -------
do $$
declare
  v_ids uuid[] := array[
    '006c2d72-00bb-4d9c-9ff2-64a09a6a8ce2', 'da15a248-ee4b-4056-a54c-86e105a00e49',
    'c0334dec-20f7-4784-a27e-5ddd5b8ea357', '5098b9d4-6b26-411a-be6b-98a003e499d9',
    '647a3c9c-a190-475f-9487-8ceeadc839b2', '585b9ba6-7581-4957-bb30-926b9c86d44d',
    '66a7f37e-c16d-4ad6-b225-eb2f1c8b6e00', '66fc279e-a152-4381-b2ae-576bca8718cb',
    '946a9805-706c-438c-a051-a9973ef6d82b', 'f1071aac-fadd-4ade-b73a-37e4d100864c'
  ]::uuid[];
  v_msg text;
begin
  -- 1. Los 10 ids tienen que existir.
  select string_agg(x.id::text, ', ') into v_msg
  from unnest(v_ids) as x(id)
  where not exists (select 1 from public.inmobiliarias i where i.id = x.id);
  if v_msg is not null then
    raise exception 'ABORTADO: estos ids no existen: %', v_msg;
  end if;

  -- 2. Ninguna puede estar marcada como INTERNA o TESTING.
  select string_agg(i.nombre || ' (' || i.tipo_cuenta || ')', ', ') into v_msg
  from public.inmobiliarias i
  where i.id = any(v_ids) and i.tipo_cuenta <> 'CLIENTE';
  if v_msg is not null then
    raise exception 'ABORTADO: estas cuentas no son CLIENTE: %', v_msg;
  end if;

  -- 3. Más de 50 leads no es una cuenta basura: es alguien que la usó.
  select string_agg(x.nombre || ' (' || x.leads || ' leads)', ', ') into v_msg
  from (
    select i.nombre, count(l.id) as leads
    from public.inmobiliarias i
    left join public.leads l on l.inmobiliaria_id = i.id
    where i.id = any(v_ids)
    group by i.id, i.nombre
    having count(l.id) > 50
  ) x;
  if v_msg is not null then
    raise exception 'ABORTADO: estas cuentas tienen más de 50 leads: %', v_msg;
  end if;

  -- 4. Una suscripción viva en Mercado Pago le sigue cobrando al cliente
  --    aunque acá no quede rastro. Se cancela en MP primero.
  select string_agg(i.nombre || ' (' || i.mp_preapproval_id || ')', ', ') into v_msg
  from public.inmobiliarias i
  where i.id = any(v_ids)
    and i.mp_preapproval_id is not null
    and i.estado_suscripcion = 'ACTIVA'
    and i.cancelacion_solicitada = false;
  if v_msg is not null then
    raise exception 'ABORTADO: suscripción activa en Mercado Pago, cancelala allá primero: %', v_msg;
  end if;
end
$$;

-- --- 1. Lo que cuelga de leads y propiedades ------------------------------
-- `interacciones` no tiene inmobiliaria_id. Se borra por las dos vías que la
-- atan a estas cuentas —su lead y su agente—, porque las dos son NO ACTION y
-- cualquiera bloquearía los borrados de abajo.
delete from public.interacciones it
 where it.lead_id in (
         select l.id from public.leads l
          where l.inmobiliaria_id = any(array[
    '006c2d72-00bb-4d9c-9ff2-64a09a6a8ce2', 'da15a248-ee4b-4056-a54c-86e105a00e49',
    'c0334dec-20f7-4784-a27e-5ddd5b8ea357', '5098b9d4-6b26-411a-be6b-98a003e499d9',
    '647a3c9c-a190-475f-9487-8ceeadc839b2', '585b9ba6-7581-4957-bb30-926b9c86d44d',
    '66a7f37e-c16d-4ad6-b225-eb2f1c8b6e00', '66fc279e-a152-4381-b2ae-576bca8718cb',
    '946a9805-706c-438c-a051-a9973ef6d82b', 'f1071aac-fadd-4ade-b73a-37e4d100864c'
  ]::uuid[])
       )
    or it.agente_id in (
         select p.id from public.profiles p
          where p.inmobiliaria_id = any(array[
    '006c2d72-00bb-4d9c-9ff2-64a09a6a8ce2', 'da15a248-ee4b-4056-a54c-86e105a00e49',
    'c0334dec-20f7-4784-a27e-5ddd5b8ea357', '5098b9d4-6b26-411a-be6b-98a003e499d9',
    '647a3c9c-a190-475f-9487-8ceeadc839b2', '585b9ba6-7581-4957-bb30-926b9c86d44d',
    '66a7f37e-c16d-4ad6-b225-eb2f1c8b6e00', '66fc279e-a152-4381-b2ae-576bca8718cb',
    '946a9805-706c-438c-a051-a9973ef6d82b', 'f1071aac-fadd-4ade-b73a-37e4d100864c'
  ]::uuid[])
       );

-- Visitas y tareas apuntan a leads, propiedades y operaciones: van antes.
delete from public.visitas       where inmobiliaria_id = any(array[
    '006c2d72-00bb-4d9c-9ff2-64a09a6a8ce2', 'da15a248-ee4b-4056-a54c-86e105a00e49',
    'c0334dec-20f7-4784-a27e-5ddd5b8ea357', '5098b9d4-6b26-411a-be6b-98a003e499d9',
    '647a3c9c-a190-475f-9487-8ceeadc839b2', '585b9ba6-7581-4957-bb30-926b9c86d44d',
    '66a7f37e-c16d-4ad6-b225-eb2f1c8b6e00', '66fc279e-a152-4381-b2ae-576bca8718cb',
    '946a9805-706c-438c-a051-a9973ef6d82b', 'f1071aac-fadd-4ade-b73a-37e4d100864c'
  ]::uuid[]);
delete from public.tareas        where inmobiliaria_id = any(array[
    '006c2d72-00bb-4d9c-9ff2-64a09a6a8ce2', 'da15a248-ee4b-4056-a54c-86e105a00e49',
    'c0334dec-20f7-4784-a27e-5ddd5b8ea357', '5098b9d4-6b26-411a-be6b-98a003e499d9',
    '647a3c9c-a190-475f-9487-8ceeadc839b2', '585b9ba6-7581-4957-bb30-926b9c86d44d',
    '66a7f37e-c16d-4ad6-b225-eb2f1c8b6e00', '66fc279e-a152-4381-b2ae-576bca8718cb',
    '946a9805-706c-438c-a051-a9973ef6d82b', 'f1071aac-fadd-4ade-b73a-37e4d100864c'
  ]::uuid[]);
delete from public.tareas_series where inmobiliaria_id = any(array[
    '006c2d72-00bb-4d9c-9ff2-64a09a6a8ce2', 'da15a248-ee4b-4056-a54c-86e105a00e49',
    'c0334dec-20f7-4784-a27e-5ddd5b8ea357', '5098b9d4-6b26-411a-be6b-98a003e499d9',
    '647a3c9c-a190-475f-9487-8ceeadc839b2', '585b9ba6-7581-4957-bb30-926b9c86d44d',
    '66a7f37e-c16d-4ad6-b225-eb2f1c8b6e00', '66fc279e-a152-4381-b2ae-576bca8718cb',
    '946a9805-706c-438c-a051-a9973ef6d82b', 'f1071aac-fadd-4ade-b73a-37e4d100864c'
  ]::uuid[]);

-- --- 2. Operaciones antes que aquello a lo que apuntan --------------------
delete from public.operaciones where inmobiliaria_id = any(array[
    '006c2d72-00bb-4d9c-9ff2-64a09a6a8ce2', 'da15a248-ee4b-4056-a54c-86e105a00e49',
    'c0334dec-20f7-4784-a27e-5ddd5b8ea357', '5098b9d4-6b26-411a-be6b-98a003e499d9',
    '647a3c9c-a190-475f-9487-8ceeadc839b2', '585b9ba6-7581-4957-bb30-926b9c86d44d',
    '66a7f37e-c16d-4ad6-b225-eb2f1c8b6e00', '66fc279e-a152-4381-b2ae-576bca8718cb',
    '946a9805-706c-438c-a051-a9973ef6d82b', 'f1071aac-fadd-4ade-b73a-37e4d100864c'
  ]::uuid[]);
delete from public.busquedas   where inmobiliaria_id = any(array[
    '006c2d72-00bb-4d9c-9ff2-64a09a6a8ce2', 'da15a248-ee4b-4056-a54c-86e105a00e49',
    'c0334dec-20f7-4784-a27e-5ddd5b8ea357', '5098b9d4-6b26-411a-be6b-98a003e499d9',
    '647a3c9c-a190-475f-9487-8ceeadc839b2', '585b9ba6-7581-4957-bb30-926b9c86d44d',
    '66a7f37e-c16d-4ad6-b225-eb2f1c8b6e00', '66fc279e-a152-4381-b2ae-576bca8718cb',
    '946a9805-706c-438c-a051-a9973ef6d82b', 'f1071aac-fadd-4ade-b73a-37e4d100864c'
  ]::uuid[]);
delete from public.propiedades where inmobiliaria_id = any(array[
    '006c2d72-00bb-4d9c-9ff2-64a09a6a8ce2', 'da15a248-ee4b-4056-a54c-86e105a00e49',
    'c0334dec-20f7-4784-a27e-5ddd5b8ea357', '5098b9d4-6b26-411a-be6b-98a003e499d9',
    '647a3c9c-a190-475f-9487-8ceeadc839b2', '585b9ba6-7581-4957-bb30-926b9c86d44d',
    '66a7f37e-c16d-4ad6-b225-eb2f1c8b6e00', '66fc279e-a152-4381-b2ae-576bca8718cb',
    '946a9805-706c-438c-a051-a9973ef6d82b', 'f1071aac-fadd-4ade-b73a-37e4d100864c'
  ]::uuid[]);

-- --- 3. Leads -------------------------------------------------------------
delete from public.leads where inmobiliaria_id = any(array[
    '006c2d72-00bb-4d9c-9ff2-64a09a6a8ce2', 'da15a248-ee4b-4056-a54c-86e105a00e49',
    'c0334dec-20f7-4784-a27e-5ddd5b8ea357', '5098b9d4-6b26-411a-be6b-98a003e499d9',
    '647a3c9c-a190-475f-9487-8ceeadc839b2', '585b9ba6-7581-4957-bb30-926b9c86d44d',
    '66a7f37e-c16d-4ad6-b225-eb2f1c8b6e00', '66fc279e-a152-4381-b2ae-576bca8718cb',
    '946a9805-706c-438c-a051-a9973ef6d82b', 'f1071aac-fadd-4ade-b73a-37e4d100864c'
  ]::uuid[]);

-- --- 4. Lo que apunta a los perfiles --------------------------------------
-- `invitaciones` referencia profiles por creado_por, usado_por y asiste_a.
delete from public.invitaciones where inmobiliaria_id = any(array[
    '006c2d72-00bb-4d9c-9ff2-64a09a6a8ce2', 'da15a248-ee4b-4056-a54c-86e105a00e49',
    'c0334dec-20f7-4784-a27e-5ddd5b8ea357', '5098b9d4-6b26-411a-be6b-98a003e499d9',
    '647a3c9c-a190-475f-9487-8ceeadc839b2', '585b9ba6-7581-4957-bb30-926b9c86d44d',
    '66a7f37e-c16d-4ad6-b225-eb2f1c8b6e00', '66fc279e-a152-4381-b2ae-576bca8718cb',
    '946a9805-706c-438c-a051-a9973ef6d82b', 'f1071aac-fadd-4ade-b73a-37e4d100864c'
  ]::uuid[]);

delete from public.google_calendar_tokens g
 where g.agente_id in (
   select p.id from public.profiles p where p.inmobiliaria_id = any(array[
    '006c2d72-00bb-4d9c-9ff2-64a09a6a8ce2', 'da15a248-ee4b-4056-a54c-86e105a00e49',
    'c0334dec-20f7-4784-a27e-5ddd5b8ea357', '5098b9d4-6b26-411a-be6b-98a003e499d9',
    '647a3c9c-a190-475f-9487-8ceeadc839b2', '585b9ba6-7581-4957-bb30-926b9c86d44d',
    '66a7f37e-c16d-4ad6-b225-eb2f1c8b6e00', '66fc279e-a152-4381-b2ae-576bca8718cb',
    '946a9805-706c-438c-a051-a9973ef6d82b', 'f1071aac-fadd-4ade-b73a-37e4d100864c'
  ]::uuid[])
 );

-- --- 5. Facturación -------------------------------------------------------
-- `evento_relacionado_id` apunta a esta misma tabla con ON DELETE SET NULL,
-- así que el orden interno no importa.
delete from public.eventos_facturacion where inmobiliaria_id = any(array[
    '006c2d72-00bb-4d9c-9ff2-64a09a6a8ce2', 'da15a248-ee4b-4056-a54c-86e105a00e49',
    'c0334dec-20f7-4784-a27e-5ddd5b8ea357', '5098b9d4-6b26-411a-be6b-98a003e499d9',
    '647a3c9c-a190-475f-9487-8ceeadc839b2', '585b9ba6-7581-4957-bb30-926b9c86d44d',
    '66a7f37e-c16d-4ad6-b225-eb2f1c8b6e00', '66fc279e-a152-4381-b2ae-576bca8718cb',
    '946a9805-706c-438c-a051-a9973ef6d82b', 'f1071aac-fadd-4ade-b73a-37e4d100864c'
  ]::uuid[]);

-- --- 6. Usuarios ----------------------------------------------------------
-- Se borra `auth.users` y NO `profiles`: `profiles.id → auth.users` es
-- CASCADE, así que el perfil se va solo, y con él sus tokens de Google (otra
-- CASCADE). Hacerlo en este orden evita tener que guardar los ids de usuario
-- en algún lado después de borrar los perfiles.
delete from auth.users u
 where u.id in (
   select p.id from public.profiles p where p.inmobiliaria_id = any(array[
    '006c2d72-00bb-4d9c-9ff2-64a09a6a8ce2', 'da15a248-ee4b-4056-a54c-86e105a00e49',
    'c0334dec-20f7-4784-a27e-5ddd5b8ea357', '5098b9d4-6b26-411a-be6b-98a003e499d9',
    '647a3c9c-a190-475f-9487-8ceeadc839b2', '585b9ba6-7581-4957-bb30-926b9c86d44d',
    '66a7f37e-c16d-4ad6-b225-eb2f1c8b6e00', '66fc279e-a152-4381-b2ae-576bca8718cb',
    '946a9805-706c-438c-a051-a9973ef6d82b', 'f1071aac-fadd-4ade-b73a-37e4d100864c'
  ]::uuid[])
 );

-- --- 7. Las cuentas -------------------------------------------------------
delete from public.inmobiliarias where id = any(array[
    '006c2d72-00bb-4d9c-9ff2-64a09a6a8ce2', 'da15a248-ee4b-4056-a54c-86e105a00e49',
    'c0334dec-20f7-4784-a27e-5ddd5b8ea357', '5098b9d4-6b26-411a-be6b-98a003e499d9',
    '647a3c9c-a190-475f-9487-8ceeadc839b2', '585b9ba6-7581-4957-bb30-926b9c86d44d',
    '66a7f37e-c16d-4ad6-b225-eb2f1c8b6e00', '66fc279e-a152-4381-b2ae-576bca8718cb',
    '946a9805-706c-438c-a051-a9973ef6d82b', 'f1071aac-fadd-4ade-b73a-37e4d100864c'
  ]::uuid[]);

-- --- 8. Confirmación: si algo quedó, esto aborta la transacción -----------
-- No imprime nada para mirar: o pasa en silencio, o rompe. Así no depende de
-- que alguien lea un resultado antes de commitear.
do $$
declare
  v_ids        uuid[] := array[
    '006c2d72-00bb-4d9c-9ff2-64a09a6a8ce2', 'da15a248-ee4b-4056-a54c-86e105a00e49',
    'c0334dec-20f7-4784-a27e-5ddd5b8ea357', '5098b9d4-6b26-411a-be6b-98a003e499d9',
    '647a3c9c-a190-475f-9487-8ceeadc839b2', '585b9ba6-7581-4957-bb30-926b9c86d44d',
    '66a7f37e-c16d-4ad6-b225-eb2f1c8b6e00', '66fc279e-a152-4381-b2ae-576bca8718cb',
    '946a9805-706c-438c-a051-a9973ef6d82b', 'f1071aac-fadd-4ade-b73a-37e4d100864c'
  ]::uuid[];
  v_restantes  int;
  v_sobrantes  text := '';
  v_n          int;
begin
  -- Las 11 tablas con inmobiliaria_id.
  select count(*) into v_n from public.inmobiliarias where id = any(v_ids);
  if v_n > 0 then v_sobrantes := v_sobrantes || format('inmobiliarias=%s ', v_n); end if;

  select count(*) into v_n from public.profiles where inmobiliaria_id = any(v_ids);
  if v_n > 0 then v_sobrantes := v_sobrantes || format('profiles=%s ', v_n); end if;

  select count(*) into v_n from public.leads where inmobiliaria_id = any(v_ids);
  if v_n > 0 then v_sobrantes := v_sobrantes || format('leads=%s ', v_n); end if;

  select count(*) into v_n from public.propiedades where inmobiliaria_id = any(v_ids);
  if v_n > 0 then v_sobrantes := v_sobrantes || format('propiedades=%s ', v_n); end if;

  select count(*) into v_n from public.operaciones where inmobiliaria_id = any(v_ids);
  if v_n > 0 then v_sobrantes := v_sobrantes || format('operaciones=%s ', v_n); end if;

  select count(*) into v_n from public.busquedas where inmobiliaria_id = any(v_ids);
  if v_n > 0 then v_sobrantes := v_sobrantes || format('busquedas=%s ', v_n); end if;

  select count(*) into v_n from public.tareas where inmobiliaria_id = any(v_ids);
  if v_n > 0 then v_sobrantes := v_sobrantes || format('tareas=%s ', v_n); end if;

  select count(*) into v_n from public.tareas_series where inmobiliaria_id = any(v_ids);
  if v_n > 0 then v_sobrantes := v_sobrantes || format('tareas_series=%s ', v_n); end if;

  select count(*) into v_n from public.visitas where inmobiliaria_id = any(v_ids);
  if v_n > 0 then v_sobrantes := v_sobrantes || format('visitas=%s ', v_n); end if;

  select count(*) into v_n from public.invitaciones where inmobiliaria_id = any(v_ids);
  if v_n > 0 then v_sobrantes := v_sobrantes || format('invitaciones=%s ', v_n); end if;

  select count(*) into v_n from public.eventos_facturacion where inmobiliaria_id = any(v_ids);
  if v_n > 0 then v_sobrantes := v_sobrantes || format('eventos_facturacion=%s ', v_n); end if;

  -- Las dos tablas sin inmobiliaria_id se controlan por orfandad: si quedó una
  -- interacción o un token apuntando a algo que ya no existe, algo salió mal.
  -- Con las FK puestas no debería pasar nunca; es el cinturón, no el tirante.
  select count(*) into v_n
  from public.interacciones it
  left join public.leads l on l.id = it.lead_id
  where l.id is null;
  if v_n > 0 then v_sobrantes := v_sobrantes || format('interacciones_huerfanas=%s ', v_n); end if;

  select count(*) into v_n
  from public.google_calendar_tokens g
  left join public.profiles p on p.id = g.agente_id
  where p.id is null;
  if v_n > 0 then v_sobrantes := v_sobrantes || format('tokens_huerfanos=%s ', v_n); end if;

  if v_sobrantes <> '' then
    raise exception 'ABORTADO: quedaron filas sin borrar → %', v_sobrantes;
  end if;

  -- El número redondo: hoy hay 17 inmobiliarias y tienen que quedar 7.
  select count(*) into v_restantes from public.inmobiliarias;
  if v_restantes <> 7 then
    raise exception 'ABORTADO: quedaron % inmobiliarias y se esperaban 7. Se borró de más o de menos.', v_restantes;
  end if;
end
$$;


rollback;


-- ===========================================================================
-- BLOQUE 3 · REAL — idéntico al ensayo, pero termina en COMMIT.
-- ===========================================================================
-- Correr SÓLO después de que el ensayo haya terminado sin errores y de haber
-- guardado el resultado de la consulta 1.5.

begin;

-- --- Salvaguardas. Cualquiera que salte aborta toda la transacción. -------
do $$
declare
  v_ids uuid[] := array[
    '006c2d72-00bb-4d9c-9ff2-64a09a6a8ce2', 'da15a248-ee4b-4056-a54c-86e105a00e49',
    'c0334dec-20f7-4784-a27e-5ddd5b8ea357', '5098b9d4-6b26-411a-be6b-98a003e499d9',
    '647a3c9c-a190-475f-9487-8ceeadc839b2', '585b9ba6-7581-4957-bb30-926b9c86d44d',
    '66a7f37e-c16d-4ad6-b225-eb2f1c8b6e00', '66fc279e-a152-4381-b2ae-576bca8718cb',
    '946a9805-706c-438c-a051-a9973ef6d82b', 'f1071aac-fadd-4ade-b73a-37e4d100864c'
  ]::uuid[];
  v_msg text;
begin
  -- 1. Los 10 ids tienen que existir.
  select string_agg(x.id::text, ', ') into v_msg
  from unnest(v_ids) as x(id)
  where not exists (select 1 from public.inmobiliarias i where i.id = x.id);
  if v_msg is not null then
    raise exception 'ABORTADO: estos ids no existen: %', v_msg;
  end if;

  -- 2. Ninguna puede estar marcada como INTERNA o TESTING.
  select string_agg(i.nombre || ' (' || i.tipo_cuenta || ')', ', ') into v_msg
  from public.inmobiliarias i
  where i.id = any(v_ids) and i.tipo_cuenta <> 'CLIENTE';
  if v_msg is not null then
    raise exception 'ABORTADO: estas cuentas no son CLIENTE: %', v_msg;
  end if;

  -- 3. Más de 50 leads no es una cuenta basura: es alguien que la usó.
  select string_agg(x.nombre || ' (' || x.leads || ' leads)', ', ') into v_msg
  from (
    select i.nombre, count(l.id) as leads
    from public.inmobiliarias i
    left join public.leads l on l.inmobiliaria_id = i.id
    where i.id = any(v_ids)
    group by i.id, i.nombre
    having count(l.id) > 50
  ) x;
  if v_msg is not null then
    raise exception 'ABORTADO: estas cuentas tienen más de 50 leads: %', v_msg;
  end if;

  -- 4. Una suscripción viva en Mercado Pago le sigue cobrando al cliente
  --    aunque acá no quede rastro. Se cancela en MP primero.
  select string_agg(i.nombre || ' (' || i.mp_preapproval_id || ')', ', ') into v_msg
  from public.inmobiliarias i
  where i.id = any(v_ids)
    and i.mp_preapproval_id is not null
    and i.estado_suscripcion = 'ACTIVA'
    and i.cancelacion_solicitada = false;
  if v_msg is not null then
    raise exception 'ABORTADO: suscripción activa en Mercado Pago, cancelala allá primero: %', v_msg;
  end if;
end
$$;

-- --- 1. Lo que cuelga de leads y propiedades ------------------------------
-- `interacciones` no tiene inmobiliaria_id. Se borra por las dos vías que la
-- atan a estas cuentas —su lead y su agente—, porque las dos son NO ACTION y
-- cualquiera bloquearía los borrados de abajo.
delete from public.interacciones it
 where it.lead_id in (
         select l.id from public.leads l
          where l.inmobiliaria_id = any(array[
    '006c2d72-00bb-4d9c-9ff2-64a09a6a8ce2', 'da15a248-ee4b-4056-a54c-86e105a00e49',
    'c0334dec-20f7-4784-a27e-5ddd5b8ea357', '5098b9d4-6b26-411a-be6b-98a003e499d9',
    '647a3c9c-a190-475f-9487-8ceeadc839b2', '585b9ba6-7581-4957-bb30-926b9c86d44d',
    '66a7f37e-c16d-4ad6-b225-eb2f1c8b6e00', '66fc279e-a152-4381-b2ae-576bca8718cb',
    '946a9805-706c-438c-a051-a9973ef6d82b', 'f1071aac-fadd-4ade-b73a-37e4d100864c'
  ]::uuid[])
       )
    or it.agente_id in (
         select p.id from public.profiles p
          where p.inmobiliaria_id = any(array[
    '006c2d72-00bb-4d9c-9ff2-64a09a6a8ce2', 'da15a248-ee4b-4056-a54c-86e105a00e49',
    'c0334dec-20f7-4784-a27e-5ddd5b8ea357', '5098b9d4-6b26-411a-be6b-98a003e499d9',
    '647a3c9c-a190-475f-9487-8ceeadc839b2', '585b9ba6-7581-4957-bb30-926b9c86d44d',
    '66a7f37e-c16d-4ad6-b225-eb2f1c8b6e00', '66fc279e-a152-4381-b2ae-576bca8718cb',
    '946a9805-706c-438c-a051-a9973ef6d82b', 'f1071aac-fadd-4ade-b73a-37e4d100864c'
  ]::uuid[])
       );

-- Visitas y tareas apuntan a leads, propiedades y operaciones: van antes.
delete from public.visitas       where inmobiliaria_id = any(array[
    '006c2d72-00bb-4d9c-9ff2-64a09a6a8ce2', 'da15a248-ee4b-4056-a54c-86e105a00e49',
    'c0334dec-20f7-4784-a27e-5ddd5b8ea357', '5098b9d4-6b26-411a-be6b-98a003e499d9',
    '647a3c9c-a190-475f-9487-8ceeadc839b2', '585b9ba6-7581-4957-bb30-926b9c86d44d',
    '66a7f37e-c16d-4ad6-b225-eb2f1c8b6e00', '66fc279e-a152-4381-b2ae-576bca8718cb',
    '946a9805-706c-438c-a051-a9973ef6d82b', 'f1071aac-fadd-4ade-b73a-37e4d100864c'
  ]::uuid[]);
delete from public.tareas        where inmobiliaria_id = any(array[
    '006c2d72-00bb-4d9c-9ff2-64a09a6a8ce2', 'da15a248-ee4b-4056-a54c-86e105a00e49',
    'c0334dec-20f7-4784-a27e-5ddd5b8ea357', '5098b9d4-6b26-411a-be6b-98a003e499d9',
    '647a3c9c-a190-475f-9487-8ceeadc839b2', '585b9ba6-7581-4957-bb30-926b9c86d44d',
    '66a7f37e-c16d-4ad6-b225-eb2f1c8b6e00', '66fc279e-a152-4381-b2ae-576bca8718cb',
    '946a9805-706c-438c-a051-a9973ef6d82b', 'f1071aac-fadd-4ade-b73a-37e4d100864c'
  ]::uuid[]);
delete from public.tareas_series where inmobiliaria_id = any(array[
    '006c2d72-00bb-4d9c-9ff2-64a09a6a8ce2', 'da15a248-ee4b-4056-a54c-86e105a00e49',
    'c0334dec-20f7-4784-a27e-5ddd5b8ea357', '5098b9d4-6b26-411a-be6b-98a003e499d9',
    '647a3c9c-a190-475f-9487-8ceeadc839b2', '585b9ba6-7581-4957-bb30-926b9c86d44d',
    '66a7f37e-c16d-4ad6-b225-eb2f1c8b6e00', '66fc279e-a152-4381-b2ae-576bca8718cb',
    '946a9805-706c-438c-a051-a9973ef6d82b', 'f1071aac-fadd-4ade-b73a-37e4d100864c'
  ]::uuid[]);

-- --- 2. Operaciones antes que aquello a lo que apuntan --------------------
delete from public.operaciones where inmobiliaria_id = any(array[
    '006c2d72-00bb-4d9c-9ff2-64a09a6a8ce2', 'da15a248-ee4b-4056-a54c-86e105a00e49',
    'c0334dec-20f7-4784-a27e-5ddd5b8ea357', '5098b9d4-6b26-411a-be6b-98a003e499d9',
    '647a3c9c-a190-475f-9487-8ceeadc839b2', '585b9ba6-7581-4957-bb30-926b9c86d44d',
    '66a7f37e-c16d-4ad6-b225-eb2f1c8b6e00', '66fc279e-a152-4381-b2ae-576bca8718cb',
    '946a9805-706c-438c-a051-a9973ef6d82b', 'f1071aac-fadd-4ade-b73a-37e4d100864c'
  ]::uuid[]);
delete from public.busquedas   where inmobiliaria_id = any(array[
    '006c2d72-00bb-4d9c-9ff2-64a09a6a8ce2', 'da15a248-ee4b-4056-a54c-86e105a00e49',
    'c0334dec-20f7-4784-a27e-5ddd5b8ea357', '5098b9d4-6b26-411a-be6b-98a003e499d9',
    '647a3c9c-a190-475f-9487-8ceeadc839b2', '585b9ba6-7581-4957-bb30-926b9c86d44d',
    '66a7f37e-c16d-4ad6-b225-eb2f1c8b6e00', '66fc279e-a152-4381-b2ae-576bca8718cb',
    '946a9805-706c-438c-a051-a9973ef6d82b', 'f1071aac-fadd-4ade-b73a-37e4d100864c'
  ]::uuid[]);
delete from public.propiedades where inmobiliaria_id = any(array[
    '006c2d72-00bb-4d9c-9ff2-64a09a6a8ce2', 'da15a248-ee4b-4056-a54c-86e105a00e49',
    'c0334dec-20f7-4784-a27e-5ddd5b8ea357', '5098b9d4-6b26-411a-be6b-98a003e499d9',
    '647a3c9c-a190-475f-9487-8ceeadc839b2', '585b9ba6-7581-4957-bb30-926b9c86d44d',
    '66a7f37e-c16d-4ad6-b225-eb2f1c8b6e00', '66fc279e-a152-4381-b2ae-576bca8718cb',
    '946a9805-706c-438c-a051-a9973ef6d82b', 'f1071aac-fadd-4ade-b73a-37e4d100864c'
  ]::uuid[]);

-- --- 3. Leads -------------------------------------------------------------
delete from public.leads where inmobiliaria_id = any(array[
    '006c2d72-00bb-4d9c-9ff2-64a09a6a8ce2', 'da15a248-ee4b-4056-a54c-86e105a00e49',
    'c0334dec-20f7-4784-a27e-5ddd5b8ea357', '5098b9d4-6b26-411a-be6b-98a003e499d9',
    '647a3c9c-a190-475f-9487-8ceeadc839b2', '585b9ba6-7581-4957-bb30-926b9c86d44d',
    '66a7f37e-c16d-4ad6-b225-eb2f1c8b6e00', '66fc279e-a152-4381-b2ae-576bca8718cb',
    '946a9805-706c-438c-a051-a9973ef6d82b', 'f1071aac-fadd-4ade-b73a-37e4d100864c'
  ]::uuid[]);

-- --- 4. Lo que apunta a los perfiles --------------------------------------
-- `invitaciones` referencia profiles por creado_por, usado_por y asiste_a.
delete from public.invitaciones where inmobiliaria_id = any(array[
    '006c2d72-00bb-4d9c-9ff2-64a09a6a8ce2', 'da15a248-ee4b-4056-a54c-86e105a00e49',
    'c0334dec-20f7-4784-a27e-5ddd5b8ea357', '5098b9d4-6b26-411a-be6b-98a003e499d9',
    '647a3c9c-a190-475f-9487-8ceeadc839b2', '585b9ba6-7581-4957-bb30-926b9c86d44d',
    '66a7f37e-c16d-4ad6-b225-eb2f1c8b6e00', '66fc279e-a152-4381-b2ae-576bca8718cb',
    '946a9805-706c-438c-a051-a9973ef6d82b', 'f1071aac-fadd-4ade-b73a-37e4d100864c'
  ]::uuid[]);

delete from public.google_calendar_tokens g
 where g.agente_id in (
   select p.id from public.profiles p where p.inmobiliaria_id = any(array[
    '006c2d72-00bb-4d9c-9ff2-64a09a6a8ce2', 'da15a248-ee4b-4056-a54c-86e105a00e49',
    'c0334dec-20f7-4784-a27e-5ddd5b8ea357', '5098b9d4-6b26-411a-be6b-98a003e499d9',
    '647a3c9c-a190-475f-9487-8ceeadc839b2', '585b9ba6-7581-4957-bb30-926b9c86d44d',
    '66a7f37e-c16d-4ad6-b225-eb2f1c8b6e00', '66fc279e-a152-4381-b2ae-576bca8718cb',
    '946a9805-706c-438c-a051-a9973ef6d82b', 'f1071aac-fadd-4ade-b73a-37e4d100864c'
  ]::uuid[])
 );

-- --- 5. Facturación -------------------------------------------------------
-- `evento_relacionado_id` apunta a esta misma tabla con ON DELETE SET NULL,
-- así que el orden interno no importa.
delete from public.eventos_facturacion where inmobiliaria_id = any(array[
    '006c2d72-00bb-4d9c-9ff2-64a09a6a8ce2', 'da15a248-ee4b-4056-a54c-86e105a00e49',
    'c0334dec-20f7-4784-a27e-5ddd5b8ea357', '5098b9d4-6b26-411a-be6b-98a003e499d9',
    '647a3c9c-a190-475f-9487-8ceeadc839b2', '585b9ba6-7581-4957-bb30-926b9c86d44d',
    '66a7f37e-c16d-4ad6-b225-eb2f1c8b6e00', '66fc279e-a152-4381-b2ae-576bca8718cb',
    '946a9805-706c-438c-a051-a9973ef6d82b', 'f1071aac-fadd-4ade-b73a-37e4d100864c'
  ]::uuid[]);

-- --- 6. Usuarios ----------------------------------------------------------
-- Se borra `auth.users` y NO `profiles`: `profiles.id → auth.users` es
-- CASCADE, así que el perfil se va solo, y con él sus tokens de Google (otra
-- CASCADE). Hacerlo en este orden evita tener que guardar los ids de usuario
-- en algún lado después de borrar los perfiles.
delete from auth.users u
 where u.id in (
   select p.id from public.profiles p where p.inmobiliaria_id = any(array[
    '006c2d72-00bb-4d9c-9ff2-64a09a6a8ce2', 'da15a248-ee4b-4056-a54c-86e105a00e49',
    'c0334dec-20f7-4784-a27e-5ddd5b8ea357', '5098b9d4-6b26-411a-be6b-98a003e499d9',
    '647a3c9c-a190-475f-9487-8ceeadc839b2', '585b9ba6-7581-4957-bb30-926b9c86d44d',
    '66a7f37e-c16d-4ad6-b225-eb2f1c8b6e00', '66fc279e-a152-4381-b2ae-576bca8718cb',
    '946a9805-706c-438c-a051-a9973ef6d82b', 'f1071aac-fadd-4ade-b73a-37e4d100864c'
  ]::uuid[])
 );

-- --- 7. Las cuentas -------------------------------------------------------
delete from public.inmobiliarias where id = any(array[
    '006c2d72-00bb-4d9c-9ff2-64a09a6a8ce2', 'da15a248-ee4b-4056-a54c-86e105a00e49',
    'c0334dec-20f7-4784-a27e-5ddd5b8ea357', '5098b9d4-6b26-411a-be6b-98a003e499d9',
    '647a3c9c-a190-475f-9487-8ceeadc839b2', '585b9ba6-7581-4957-bb30-926b9c86d44d',
    '66a7f37e-c16d-4ad6-b225-eb2f1c8b6e00', '66fc279e-a152-4381-b2ae-576bca8718cb',
    '946a9805-706c-438c-a051-a9973ef6d82b', 'f1071aac-fadd-4ade-b73a-37e4d100864c'
  ]::uuid[]);

-- --- 8. Confirmación: si algo quedó, esto aborta la transacción -----------
-- No imprime nada para mirar: o pasa en silencio, o rompe. Así no depende de
-- que alguien lea un resultado antes de commitear.
do $$
declare
  v_ids        uuid[] := array[
    '006c2d72-00bb-4d9c-9ff2-64a09a6a8ce2', 'da15a248-ee4b-4056-a54c-86e105a00e49',
    'c0334dec-20f7-4784-a27e-5ddd5b8ea357', '5098b9d4-6b26-411a-be6b-98a003e499d9',
    '647a3c9c-a190-475f-9487-8ceeadc839b2', '585b9ba6-7581-4957-bb30-926b9c86d44d',
    '66a7f37e-c16d-4ad6-b225-eb2f1c8b6e00', '66fc279e-a152-4381-b2ae-576bca8718cb',
    '946a9805-706c-438c-a051-a9973ef6d82b', 'f1071aac-fadd-4ade-b73a-37e4d100864c'
  ]::uuid[];
  v_restantes  int;
  v_sobrantes  text := '';
  v_n          int;
begin
  -- Las 11 tablas con inmobiliaria_id.
  select count(*) into v_n from public.inmobiliarias where id = any(v_ids);
  if v_n > 0 then v_sobrantes := v_sobrantes || format('inmobiliarias=%s ', v_n); end if;

  select count(*) into v_n from public.profiles where inmobiliaria_id = any(v_ids);
  if v_n > 0 then v_sobrantes := v_sobrantes || format('profiles=%s ', v_n); end if;

  select count(*) into v_n from public.leads where inmobiliaria_id = any(v_ids);
  if v_n > 0 then v_sobrantes := v_sobrantes || format('leads=%s ', v_n); end if;

  select count(*) into v_n from public.propiedades where inmobiliaria_id = any(v_ids);
  if v_n > 0 then v_sobrantes := v_sobrantes || format('propiedades=%s ', v_n); end if;

  select count(*) into v_n from public.operaciones where inmobiliaria_id = any(v_ids);
  if v_n > 0 then v_sobrantes := v_sobrantes || format('operaciones=%s ', v_n); end if;

  select count(*) into v_n from public.busquedas where inmobiliaria_id = any(v_ids);
  if v_n > 0 then v_sobrantes := v_sobrantes || format('busquedas=%s ', v_n); end if;

  select count(*) into v_n from public.tareas where inmobiliaria_id = any(v_ids);
  if v_n > 0 then v_sobrantes := v_sobrantes || format('tareas=%s ', v_n); end if;

  select count(*) into v_n from public.tareas_series where inmobiliaria_id = any(v_ids);
  if v_n > 0 then v_sobrantes := v_sobrantes || format('tareas_series=%s ', v_n); end if;

  select count(*) into v_n from public.visitas where inmobiliaria_id = any(v_ids);
  if v_n > 0 then v_sobrantes := v_sobrantes || format('visitas=%s ', v_n); end if;

  select count(*) into v_n from public.invitaciones where inmobiliaria_id = any(v_ids);
  if v_n > 0 then v_sobrantes := v_sobrantes || format('invitaciones=%s ', v_n); end if;

  select count(*) into v_n from public.eventos_facturacion where inmobiliaria_id = any(v_ids);
  if v_n > 0 then v_sobrantes := v_sobrantes || format('eventos_facturacion=%s ', v_n); end if;

  -- Las dos tablas sin inmobiliaria_id se controlan por orfandad: si quedó una
  -- interacción o un token apuntando a algo que ya no existe, algo salió mal.
  -- Con las FK puestas no debería pasar nunca; es el cinturón, no el tirante.
  select count(*) into v_n
  from public.interacciones it
  left join public.leads l on l.id = it.lead_id
  where l.id is null;
  if v_n > 0 then v_sobrantes := v_sobrantes || format('interacciones_huerfanas=%s ', v_n); end if;

  select count(*) into v_n
  from public.google_calendar_tokens g
  left join public.profiles p on p.id = g.agente_id
  where p.id is null;
  if v_n > 0 then v_sobrantes := v_sobrantes || format('tokens_huerfanos=%s ', v_n); end if;

  if v_sobrantes <> '' then
    raise exception 'ABORTADO: quedaron filas sin borrar → %', v_sobrantes;
  end if;

  -- El número redondo: hoy hay 17 inmobiliarias y tienen que quedar 7.
  select count(*) into v_restantes from public.inmobiliarias;
  if v_restantes <> 7 then
    raise exception 'ABORTADO: quedaron % inmobiliarias y se esperaban 7. Se borró de más o de menos.', v_restantes;
  end if;
end
$$;


commit;


-- ===========================================================================
-- BLOQUE 4 · STORAGE — después del COMMIT
-- ===========================================================================
-- Las fotos viven en el bucket `propiedades-fotos`, con la key
-- `{propiedad_id}/{timestamp}-{nombre}`. Storage no tiene FK contra la base:
-- borrar las filas NO borra los archivos.
--
-- Con los `propiedad_id` guardados de la consulta 1.5, la forma recomendada es
-- el dashboard (Storage → propiedades-fotos → la carpeta con ese id → Delete)
-- o la API de Storage: las dos borran el archivo de verdad.
--
-- Para ver qué hay antes de borrar, reemplazando los ids:
--
--   select o.name, o.created_at, (o.metadata ->> 'size')::bigint as bytes
--   from storage.objects o
--   where o.bucket_id = 'propiedades-fotos'
--     and split_part(o.name, '/', 1) = any(array['<propiedad_id_1>','<propiedad_id_2>']);
--
-- Borrar las filas por SQL saca la referencia, pero puede dejar el archivo
-- ocupando espacio en el backend. Usalo sólo si no tenés a mano el dashboard:
--
--   delete from storage.objects
--   where bucket_id = 'propiedades-fotos'
--     and split_part(name, '/', 1) = any(array['<propiedad_id_1>','<propiedad_id_2>']);
--
-- Las fotos huérfanas viejas —de propiedades que siguen existiendo, borradas
-- desde la ficha— quedan fuera de esta limpieza a propósito.
