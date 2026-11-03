-- Bloqueo de cuentas con motivo: datos existentes.
--
-- Corre DESPUÉS de 20261103120000_bloqueo_cuenta.sql. Reconstruye, desde los
-- eventos `cuenta_suspendida` que ya están en `eventos_facturacion`, las
-- suspensiones que hoy siguen vigentes: crea su fila en `bloqueos_cuenta` (con la
-- fecha, el autor, la nota y el estado anterior que quedaron en el evento) y les
-- pone `inmobiliarias.bloqueo_motivo = 'SUSPENSION_ADMIN'`.
--
-- QUÉ CUENTAS SE CONSIDERAN SUSPENDIDAS
--   Las que hoy están VENCIDA, tienen un evento `cuenta_suspendida`, y después
--   del último de esos no registraron ningún `pago_manual`, `ajuste_vencimiento`,
--   `trial_extendido` ni `pago_aprobado`: cualquiera de esos las habría
--   reactivado, y su VENCIDA de hoy sería un vencimiento natural. Las que ya
--   tienen un bloqueo abierto se saltean.
--
-- QUÉ QUEDA SIN MOTIVO
--   - Las cuentas VENCIDA sin ningún evento `cuenta_suspendida`: vencimientos
--     naturales, o suspensiones hechas a mano desde el SQL Editor (no dejan
--     rastro y no se pueden distinguir). Quedan con `bloqueo_motivo` NULL.
--   - Si un evento no trae el estado anterior, o trae uno que no existe, el
--     bloqueo queda con estado anterior VENCIDA: al reactivar, la cuenta vuelve
--     a VENCIDA sin bloqueo en lugar de adivinar.
--   - Si un evento no trae autor, o el perfil ya no existe, `bloqueado_por` queda
--     en NULL. Si no trae nota, se usa un texto que lo aclara.
--
-- NO limpia `eventos_facturacion.detalle`: las notas viejas siguen ahí, legibles
-- para el dueño, hasta que se decida qué hacer con ellas.
--
-- ANTES DE CORRERLA: ejecutá esta consulta. Es de solo lectura y lista las
-- cuentas que la migración va a tocar.
--
--   with ultima as (
--     select distinct on (e.inmobiliaria_id)
--            e.inmobiliaria_id, e.created_at, e.detalle, e.raw_payload
--     from public.eventos_facturacion e
--     where e.tipo = 'cuenta_suspendida'
--     order by e.inmobiliaria_id, e.created_at desc
--   )
--   select i.id,
--          i.nombre,
--          i.metodo_cobro,
--          i.bloqueo_motivo,
--          u.created_at                                  as suspendida_el,
--          u.raw_payload ->> 'estado_anterior'           as estado_anterior,
--          u.raw_payload ->> 'registrado_por'            as autor,
--          coalesce(nullif(btrim(u.raw_payload ->> 'nota'), ''), u.detalle) as nota_o_detalle
--   from public.inmobiliarias i
--   join ultima u on u.inmobiliaria_id = i.id
--   where i.estado_suscripcion = 'VENCIDA'
--     and not exists (
--       select 1
--       from public.eventos_facturacion p
--       where p.inmobiliaria_id = i.id
--         and p.tipo in ('pago_manual', 'ajuste_vencimiento', 'trial_extendido', 'pago_aprobado')
--         and p.created_at > u.created_at
--     )
--     and not exists (
--       select 1 from public.bloqueos_cuenta b
--       where b.inmobiliaria_id = i.id and b.levantado_at is null
--     )
--   order by u.created_at;
--
--   Y esta otra, para ver las VENCIDA que quedan SIN motivo (no se tocan):
--
--   select i.id, i.nombre, i.metodo_cobro, i.acceso_pagado_hasta, i.fecha_fin_trial
--   from public.inmobiliarias i
--   where i.estado_suscripcion = 'VENCIDA'
--     and not exists (
--       select 1 from public.eventos_facturacion e
--       where e.inmobiliaria_id = i.id and e.tipo = 'cuenta_suspendida'
--     );
--
-- Idempotente: una segunda corrida no crea nada, porque las cuentas ya tienen su
-- bloqueo abierto. Todo en una transacción.

begin;

do $$
begin
  if to_regclass('public.bloqueos_cuenta') is null
     or not exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'inmobiliarias' and column_name = 'bloqueo_motivo'
     ) then
    raise exception 'ABORTADO: falta aplicar antes 20261103120000_bloqueo_cuenta.sql.';
  end if;
end
$$;

do $$
declare
  v_creados int;
  v_marcadas int;
begin
  with ultima as (
    -- El último `cuenta_suspendida` de cada cuenta.
    select distinct on (e.inmobiliaria_id)
           e.inmobiliaria_id, e.created_at, e.detalle, e.raw_payload
    from public.eventos_facturacion e
    where e.tipo = 'cuenta_suspendida'
    order by e.inmobiliaria_id, e.created_at desc
  ),
  vigentes as (
    -- Siguen suspendidas: VENCIDA hoy, nada que las haya reactivado después, y
    -- sin un bloqueo abierto que ya las represente.
    select i.id as inmobiliaria_id, u.created_at, u.detalle, u.raw_payload
    from public.inmobiliarias i
    join ultima u on u.inmobiliaria_id = i.id
    where i.estado_suscripcion = 'VENCIDA'
      and not exists (
        select 1
        from public.eventos_facturacion p
        where p.inmobiliaria_id = i.id
          and p.tipo in ('pago_manual', 'ajuste_vencimiento', 'trial_extendido', 'pago_aprobado')
          and p.created_at > u.created_at
      )
      and not exists (
        select 1 from public.bloqueos_cuenta b
        where b.inmobiliaria_id = i.id and b.levantado_at is null
      )
  ),
  creados as (
    insert into public.bloqueos_cuenta (
      inmobiliaria_id, motivo, nota, estado_anterior, bloqueado_por, bloqueado_at
    )
    select
      v.inmobiliaria_id,
      'SUSPENSION_ADMIN',
      -- La nota: del raw_payload (donde la dejan las dos versiones de la RPC); si
      -- no está, de lo que sigue a "Nota: " en el detalle; si tampoco, un aviso.
      coalesce(
        nullif(btrim(v.raw_payload ->> 'nota'), ''),
        nullif(btrim(substring(v.detalle from ' · Nota: (.*)$')), ''),
        'Sin nota registrada (suspensión anterior al registro de motivos)'
      ),
      -- El estado anterior, sólo si es un estado que existe. Cualquier otra cosa
      -- cae en VENCIDA, que al reactivar da una cuenta vencida sin bloqueo.
      case
        when v.raw_payload ->> 'estado_anterior'
             in ('TRIAL', 'ACTIVA', 'GRACIA', 'VENCIDA', 'CANCELADA')
          then (v.raw_payload ->> 'estado_anterior')::public.estado_suscripcion
        else 'VENCIDA'::public.estado_suscripcion
      end,
      -- El autor, sólo si el perfil todavía existe (la FK lo exige).
      (select p.id from public.profiles p where p.id::text = v.raw_payload ->> 'registrado_por'),
      v.created_at
    from vigentes v
    on conflict (inmobiliaria_id) where levantado_at is null do nothing
    returning 1
  )
  select count(*) into v_creados from creados;

  -- Las cuentas con un bloqueo abierto y VENCIDA quedan marcadas. Incluye las
  -- que ya tenían bloqueo de antes de esta corrida, por si alguna quedó sin
  -- marcar.
  update public.inmobiliarias i
     set bloqueo_motivo = 'SUSPENSION_ADMIN'
   where i.estado_suscripcion = 'VENCIDA'
     and i.bloqueo_motivo is distinct from 'SUSPENSION_ADMIN'
     and exists (
       select 1 from public.bloqueos_cuenta b
       where b.inmobiliaria_id = i.id and b.levantado_at is null
     );
  get diagnostics v_marcadas = row_count;

  raise notice 'Bloqueos creados: %. Cuentas marcadas con bloqueo_motivo: %.', v_creados, v_marcadas;
end
$$;

-- ---------------------------------------------------------------------------
-- Verificación: si algo no da, se aborta y no se aplica nada.
-- ---------------------------------------------------------------------------
do $$
begin
  -- Toda cuenta con motivo tiene un bloqueo abierto, y está VENCIDA.
  if exists (
    select 1 from public.inmobiliarias i
    where i.bloqueo_motivo is not null
      and (
        i.estado_suscripcion <> 'VENCIDA'
        or not exists (
          select 1 from public.bloqueos_cuenta b
          where b.inmobiliaria_id = i.id and b.levantado_at is null
        )
      )
  ) then
    raise exception 'ABORTADO: hay cuentas con bloqueo_motivo que no están VENCIDA o no tienen un bloqueo abierto.';
  end if;

  -- Todo bloqueo abierto tiene su cuenta marcada.
  if exists (
    select 1 from public.bloqueos_cuenta b
    join public.inmobiliarias i on i.id = b.inmobiliaria_id
    where b.levantado_at is null
      and i.bloqueo_motivo is distinct from 'SUSPENSION_ADMIN'
      and i.estado_suscripcion = 'VENCIDA'
  ) then
    raise exception 'ABORTADO: hay bloqueos abiertos cuya cuenta no quedó marcada.';
  end if;

  -- Nunca más de un bloqueo abierto por cuenta (lo garantiza el índice único;
  -- se comprueba igual).
  if exists (
    select 1 from public.bloqueos_cuenta b
    where b.levantado_at is null
    group by b.inmobiliaria_id
    having count(*) > 1
  ) then
    raise exception 'ABORTADO: una cuenta tiene más de un bloqueo abierto.';
  end if;
end
$$;

commit;

-- ---------------------------------------------------------------------------
-- Para revisar el resultado (NO forma parte de la migración, es de solo lectura):
--
--   select i.nombre, i.estado_suscripcion, i.bloqueo_motivo,
--          b.bloqueado_at, b.estado_anterior, b.bloqueado_por, b.nota
--   from public.bloqueos_cuenta b
--   join public.inmobiliarias i on i.id = b.inmobiliaria_id
--   where b.levantado_at is null
--   order by b.bloqueado_at;
-- ---------------------------------------------------------------------------
