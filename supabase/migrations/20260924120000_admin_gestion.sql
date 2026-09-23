-- Gestión de cuentas desde el panel /admin.
--
-- Suma lo que hoy hay que hacer a mano en el SQL Editor:
--   1. `tipo_cuenta`, para que las cuentas internas y de testing dejen de
--      ensuciar las métricas del panel.
--   2. `evento_relacionado_id`, para poder anular un pago sin borrarlo.
--   3. Cuatro RPC de gestión: marcar el tipo de cuenta, anular un pago,
--      extender un trial y suspender una cuenta.
--
-- Todas las funciones siguen el molde de `admin_registrar_pago_manual`
-- (migración 20260923120000): SECURITY DEFINER, `search_path` fijo, chequeo de
-- `private.my_es_superadmin()` antes de tocar nada, `SELECT ... FOR UPDATE` de
-- la fila, evento en `eventos_facturacion` y grants acotados.
--
-- No toca ninguna policy ni RLS existente.
--
-- Idempotente.

-- ---------------------------------------------------------------------------
-- 1. Tipo de cuenta
-- ---------------------------------------------------------------------------
-- CLIENTE es el default porque es lo que son casi todas y lo que tienen que
-- seguir siendo las filas que ya existen. INTERNA es LeadEra usándose a sí
-- misma; TESTING son las cuentas de prueba. Las dos últimas quedan fuera de
-- los ingresos, los conteos y los gráficos del panel: son plata que no entró
-- y clientes que no existen.
alter table public.inmobiliarias
  add column if not exists tipo_cuenta text not null default 'CLIENTE';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.inmobiliarias'::regclass
      and conname = 'inmobiliarias_tipo_cuenta_check'
  ) then
    alter table public.inmobiliarias
      add constraint inmobiliarias_tipo_cuenta_check
      check (tipo_cuenta in ('CLIENTE', 'INTERNA', 'TESTING'));
  end if;
end
$$;

comment on column public.inmobiliarias.tipo_cuenta is
  'CLIENTE (cuenta real), INTERNA (de LeadEra) o TESTING (de prueba). Las dos últimas se excluyen de las métricas del panel.';

-- ---------------------------------------------------------------------------
-- 2. Eventos que se refieren a otro evento
-- ---------------------------------------------------------------------------
-- Un pago no se borra: se anula con otro evento que lo apunta. Así el
-- historial sigue contando lo que pasó —se cobró y después se dio de baja— en
-- vez de dejar un hueco sin explicación.
--
-- `on delete set null` y no cascade: si alguna vez se borra un pago, la
-- anulación tiene que quedar igual, huérfana pero visible.
alter table public.eventos_facturacion
  add column if not exists evento_relacionado_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.eventos_facturacion'::regclass
      and conname = 'eventos_facturacion_evento_relacionado_id_fkey'
  ) then
    alter table public.eventos_facturacion
      add constraint eventos_facturacion_evento_relacionado_id_fkey
      foreign key (evento_relacionado_id)
      references public.eventos_facturacion(id)
      on delete set null;
  end if;
end
$$;

-- El panel pregunta "¿este pago está anulado?" una vez por fila del historial.
create index if not exists eventos_facturacion_evento_relacionado_idx
  on public.eventos_facturacion (evento_relacionado_id)
  where evento_relacionado_id is not null;

comment on column public.eventos_facturacion.evento_relacionado_id is
  'El evento al que este se refiere. Hoy lo usa pago_anulado para apuntar al pago_manual que anula.';

-- El grant de SELECT de `eventos_facturacion` es POR COLUMNA desde la
-- migración 20260922120000, que dejó afuera `raw_payload`. Una columna nueva
-- no entra sola en ese grant, y el panel necesita leerla.
grant select (evento_relacionado_id) on public.eventos_facturacion to authenticated;

-- ---------------------------------------------------------------------------
-- 3a. Marcar el tipo de cuenta
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_tipo_cuenta(
  p_inmobiliaria_id uuid,
  p_tipo text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cuenta public.inmobiliarias%rowtype;
begin
  if not coalesce(private.my_es_superadmin(), false) then
    raise exception 'permiso denegado' using errcode = '42501';
  end if;

  if p_tipo is null or p_tipo not in ('CLIENTE', 'INTERNA', 'TESTING') then
    raise exception 'El tipo de cuenta tiene que ser CLIENTE, INTERNA o TESTING.';
  end if;

  select * into v_cuenta
  from public.inmobiliarias
  where id = p_inmobiliaria_id
  for update;

  if not found then
    raise exception 'No existe la inmobiliaria %.', p_inmobiliaria_id;
  end if;

  -- Sin cambio real no se escribe ni se anota: el historial de cobros es para
  -- leerlo, y una fila que dice "pasó de CLIENTE a CLIENTE" es ruido.
  if v_cuenta.tipo_cuenta = p_tipo then
    return;
  end if;

  update public.inmobiliarias
     set tipo_cuenta = p_tipo
   where id = p_inmobiliaria_id;

  insert into public.eventos_facturacion (inmobiliaria_id, tipo, monto, moneda, detalle, raw_payload)
  values (
    p_inmobiliaria_id,
    'tipo_cuenta_cambiado',
    null,
    'ARS',
    'Tipo de cuenta: de ' || v_cuenta.tipo_cuenta || ' a ' || p_tipo || '.',
    jsonb_build_object(
      'tipo_anterior', v_cuenta.tipo_cuenta,
      'tipo_nuevo', p_tipo,
      'registrado_por', auth.uid()
    )
  );
end;
$$;

revoke execute on function public.admin_set_tipo_cuenta(uuid, text) from public, anon;
grant execute on function public.admin_set_tipo_cuenta(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3b. Anular un pago manual
-- ---------------------------------------------------------------------------
-- Para el pago que se cargó mal, o el que se cargó y después no entró. El pago
-- original NO se borra ni se edita: queda con su anulación al lado, y el panel
-- lo muestra tachado.
--
-- Los meses salen del `raw_payload` del pago, que es donde los dejó
-- `admin_registrar_pago_manual`. Si ese dato faltara, la función corta: es
-- preferible a adivinar cuánto acceso hay que descontar.
--
-- El estado NO se toca a propósito. Si la cuenta queda con el acceso vencido,
-- la pasa a GRACIA el cron de la noche con la misma regla que a todas, y
-- mientras tanto el panel ya la muestra vencida, porque el badge se calcula
-- contra `acceso_pagado_hasta`. Cambiar el estado acá sería adelantarse a una
-- regla que no vive en esta función.
create or replace function public.admin_anular_pago(
  p_evento_id uuid,
  p_nota text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pago     public.eventos_facturacion%rowtype;
  v_cuenta   public.inmobiliarias%rowtype;
  v_meses    int;
  v_anterior timestamptz;
  v_nuevo    timestamptz;
  v_nota     text;
  v_zona     text := 'America/Argentina/Buenos_Aires';
begin
  if not coalesce(private.my_es_superadmin(), false) then
    raise exception 'permiso denegado' using errcode = '42501';
  end if;

  v_nota := nullif(btrim(p_nota), '');
  if v_nota is null then
    raise exception 'La nota es obligatoria: dejá escrito por qué se anula el pago.';
  end if;

  -- FOR UPDATE sobre el evento y no sólo sobre la cuenta: es lo que impide que
  -- dos anulaciones simultáneas del mismo pago descuenten los meses dos veces.
  select * into v_pago
  from public.eventos_facturacion
  where id = p_evento_id
  for update;

  if not found then
    raise exception 'No existe ese movimiento de cobro.';
  end if;

  if v_pago.tipo <> 'pago_manual' then
    raise exception 'Sólo se pueden anular pagos manuales.';
  end if;

  if exists (
    select 1 from public.eventos_facturacion
    where evento_relacionado_id = p_evento_id
      and tipo = 'pago_anulado'
  ) then
    raise exception 'Ese pago ya estaba anulado.';
  end if;

  v_meses := nullif(v_pago.raw_payload ->> 'meses', '')::int;
  if v_meses is null or v_meses < 1 then
    raise exception 'El pago no registró cuántos meses cubría, así que no se puede anular automáticamente. Ajustá el vencimiento a mano.';
  end if;

  select * into v_cuenta
  from public.inmobiliarias
  where id = v_pago.inmobiliaria_id
  for update;

  if not found then
    raise exception 'No existe la inmobiliaria del pago.';
  end if;

  v_anterior := v_cuenta.acceso_pagado_hasta;
  -- Sin fecha de acceso no hay nada que descontar: el pago se anula igual y el
  -- vencimiento queda como está.
  v_nuevo := case
               when v_anterior is null then null
               else v_anterior - make_interval(months => v_meses)
             end;

  update public.inmobiliarias
     set acceso_pagado_hasta = v_nuevo
   where id = v_cuenta.id;

  insert into public.eventos_facturacion (
    inmobiliaria_id, tipo, monto, moneda, detalle, raw_payload, evento_relacionado_id
  )
  values (
    v_cuenta.id,
    'pago_anulado',
    v_pago.monto,
    coalesce(v_pago.moneda, 'ARS'),
    'Pago anulado · ' || v_meses || (case when v_meses = 1 then ' mes' else ' meses' end)
      || ' descontados · acceso hasta '
      || coalesce(to_char(v_nuevo at time zone v_zona, 'DD/MM/YYYY'), 'sin fecha')
      || ' (antes ' || coalesce(to_char(v_anterior at time zone v_zona, 'DD/MM/YYYY'), 'sin fecha') || ')'
      || ' · Nota: ' || v_nota,
    jsonb_build_object(
      'evento_anulado', p_evento_id,
      'meses_descontados', v_meses,
      'monto_anulado', v_pago.monto,
      'acceso_hasta_anterior', v_anterior,
      'acceso_hasta_nuevo', v_nuevo,
      'nota', v_nota,
      'registrado_por', auth.uid()
    ),
    p_evento_id
  );
end;
$$;

revoke execute on function public.admin_anular_pago(uuid, text) from public, anon;
grant execute on function public.admin_anular_pago(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3c. Extender un trial
-- ---------------------------------------------------------------------------
-- Para el que pidió unos días más antes de decidir. Sólo cuentas de Mercado
-- Pago: una cuenta manual se extiende registrando un pago o ajustando el
-- vencimiento, que es lo que su estado mira.
--
-- `greatest(fecha_fin_trial, now())` para que extender un trial ya vencido dé
-- días desde hoy y no desde una fecha que quedó atrás.
create or replace function public.admin_extender_trial(
  p_inmobiliaria_id uuid,
  p_dias int,
  p_nota text
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cuenta   public.inmobiliarias%rowtype;
  v_anterior timestamptz;
  v_nuevo    timestamptz;
  v_nota     text;
  v_zona     text := 'America/Argentina/Buenos_Aires';
begin
  if not coalesce(private.my_es_superadmin(), false) then
    raise exception 'permiso denegado' using errcode = '42501';
  end if;

  v_nota := nullif(btrim(p_nota), '');
  if v_nota is null then
    raise exception 'La nota es obligatoria: dejá escrito por qué se extiende el trial.';
  end if;

  if p_dias is null or p_dias < 1 or p_dias > 60 then
    raise exception 'Los días tienen que estar entre 1 y 60.';
  end if;

  select * into v_cuenta
  from public.inmobiliarias
  where id = p_inmobiliaria_id
  for update;

  if not found then
    raise exception 'No existe la inmobiliaria %.', p_inmobiliaria_id;
  end if;

  if v_cuenta.metodo_cobro <> 'MERCADO_PAGO' then
    raise exception 'Esta cuenta cobra de forma manual: extendé su acceso registrando un pago o ajustando el vencimiento.';
  end if;

  if v_cuenta.estado_suscripcion not in ('TRIAL', 'VENCIDA') then
    raise exception 'Sólo se puede extender el trial de una cuenta en prueba o vencida. Esta está en %.', v_cuenta.estado_suscripcion;
  end if;

  -- El mismo chequeo que `admin_registrar_pago_manual`. Con el filtro de
  -- estado de arriba no debería poder dispararse nunca; se deja igual para que
  -- las tres funciones digan lo mismo si mañana ese filtro cambia.
  if v_cuenta.metodo_cobro = 'MERCADO_PAGO'
     and v_cuenta.estado_suscripcion = 'ACTIVA'
     and v_cuenta.mp_preapproval_id is not null
     and v_cuenta.cancelacion_solicitada = false then
    raise exception 'La cuenta tiene una suscripción activa de Mercado Pago. Cancelala antes de tocarle el trial.';
  end if;

  v_anterior := v_cuenta.fecha_fin_trial;
  v_nuevo := greatest(v_cuenta.fecha_fin_trial, now()) + make_interval(days => p_dias);

  update public.inmobiliarias
     set estado_suscripcion = 'TRIAL',
         fecha_fin_trial    = v_nuevo
   where id = p_inmobiliaria_id;

  insert into public.eventos_facturacion (inmobiliaria_id, tipo, monto, moneda, detalle, raw_payload)
  values (
    p_inmobiliaria_id,
    'trial_extendido',
    null,
    'ARS',
    'Trial extendido ' || p_dias || (case when p_dias = 1 then ' día' else ' días' end)
      || ' · vence el ' || to_char(v_nuevo at time zone v_zona, 'DD/MM/YYYY')
      || ' (antes ' || to_char(v_anterior at time zone v_zona, 'DD/MM/YYYY') || ')'
      || ' · Nota: ' || v_nota,
    jsonb_build_object(
      'dias', p_dias,
      'fin_trial_anterior', v_anterior,
      'fin_trial_nuevo', v_nuevo,
      'estado_anterior', v_cuenta.estado_suscripcion,
      'nota', v_nota,
      'registrado_por', auth.uid()
    )
  );

  return v_nuevo;
end;
$$;

revoke execute on function public.admin_extender_trial(uuid, int, text) from public, anon;
grant execute on function public.admin_extender_trial(uuid, int, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3d. Suspender una cuenta
-- ---------------------------------------------------------------------------
-- Corta el acceso ya: VENCIDA es uno de los `ESTADOS_BLOQUEANTES` que mira
-- `SuscripcionGuard`, así que el dueño queda en la pantalla de cuenta vencida
-- y el resto del equipo, afuera.
--
-- No hay RPC para reactivar y no hace falta: se vuelve con registrar un pago,
-- ajustar el vencimiento o extender el trial, según cómo cobre la cuenta. Cada
-- uno de esos deja su propio evento, así que el historial cuenta la vuelta.
--
-- Rechaza si hay una suscripción viva en Mercado Pago: suspender sin cancelar
-- allá le cortaría el acceso a alguien a quien se le sigue cobrando.
create or replace function public.admin_suspender_cuenta(
  p_inmobiliaria_id uuid,
  p_nota text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cuenta public.inmobiliarias%rowtype;
  v_nota   text;
begin
  if not coalesce(private.my_es_superadmin(), false) then
    raise exception 'permiso denegado' using errcode = '42501';
  end if;

  v_nota := nullif(btrim(p_nota), '');
  if v_nota is null then
    raise exception 'La nota es obligatoria: dejá escrito por qué se suspende la cuenta.';
  end if;

  select * into v_cuenta
  from public.inmobiliarias
  where id = p_inmobiliaria_id
  for update;

  if not found then
    raise exception 'No existe la inmobiliaria %.', p_inmobiliaria_id;
  end if;

  if v_cuenta.metodo_cobro = 'MERCADO_PAGO'
     and v_cuenta.estado_suscripcion = 'ACTIVA'
     and v_cuenta.mp_preapproval_id is not null
     and v_cuenta.cancelacion_solicitada = false then
    raise exception 'La cuenta tiene una suscripción activa de Mercado Pago. Cancelala antes de suspenderla.';
  end if;

  if v_cuenta.estado_suscripcion = 'VENCIDA' then
    raise exception 'La cuenta ya está vencida.';
  end if;

  update public.inmobiliarias
     set estado_suscripcion = 'VENCIDA'
   where id = p_inmobiliaria_id;

  insert into public.eventos_facturacion (inmobiliaria_id, tipo, monto, moneda, detalle, raw_payload)
  values (
    p_inmobiliaria_id,
    'cuenta_suspendida',
    null,
    'ARS',
    'Cuenta suspendida (estaba en ' || v_cuenta.estado_suscripcion || ') · Nota: ' || v_nota,
    jsonb_build_object(
      'estado_anterior', v_cuenta.estado_suscripcion,
      'estado_nuevo', 'VENCIDA',
      'metodo_cobro', v_cuenta.metodo_cobro,
      'nota', v_nota,
      'registrado_por', auth.uid()
    )
  );
end;
$$;

revoke execute on function public.admin_suspender_cuenta(uuid, text) from public, anon;
grant execute on function public.admin_suspender_cuenta(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Clasificación de las cuentas que se quedan
-- ---------------------------------------------------------------------------
-- Se marcan a mano y no desde el panel porque son las de la casa y tienen que
-- quedar bien desde la primera corrida, antes de que alguien mire una métrica.
-- El resto queda en CLIENTE por el default.
update public.inmobiliarias
   set tipo_cuenta = 'INTERNA'
 where id in (
   '0c9b16c9-dcc4-434c-a76e-d4fd62e8f696',
   '5ff5a5a4-5dd4-4a42-9b4d-481a30c1518b'
 );

update public.inmobiliarias
   set tipo_cuenta = 'TESTING'
 where id = '5f74a60b-3783-4a71-87d9-ab6ec774739e';
