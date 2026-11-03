-- Bloqueo de cuentas con motivo.
--
-- Hasta acá una cuenta suspendida por el administrador y una vencida por falta
-- de pago eran el mismo estado (VENCIDA) y sólo se distinguían por un evento
-- cuyo motivo, autor y fecha vivían en `eventos_facturacion.raw_payload`, que el
-- navegador no puede leer. Esta migración las separa y deja el motivo, el autor
-- y la fecha en un lugar que sólo ve el superadmin.
--
-- DISEÑO (híbrido)
--   - `inmobiliarias.bloqueo_motivo`: lo único que el cliente necesita saber
--     para mostrar el texto correcto. NULL = sin suspensión manual. Un VENCIDA
--     con `bloqueo_motivo` nulo sigue siendo un vencimiento natural (o una
--     cuenta marcada vencida a mano): lo cobran los pagos, no hay nada que
--     "reactivar".
--   - `bloqueos_cuenta`: el historial. Nota interna, autor, fechas y estado
--     anterior. RLS activado y acceso revocado a anon y authenticated, sin
--     policies: ni el dueño ni nadie lo lee desde el navegador. El superadmin lo
--     lee por `admin_bloqueos_cuenta()`.
--
-- POR QUÉ LA NOTA NO VA EN `eventos_facturacion.detalle`
--   La policy `eventos_facturacion_select` deja al DUENO leer todos los eventos
--   de su inmobiliaria, `detalle` incluido (confirmado en producción). Lo que se
--   escriba ahí lo puede leer el cliente. Por eso en `detalle` va un texto
--   genérico y la nota sólo vive en `bloqueos_cuenta` (y en `raw_payload`, que
--   tampoco se puede leer desde el navegador).
--
-- QUÉ HACE
--   1. `inmobiliarias.bloqueo_motivo`.
--   2. Tabla `bloqueos_cuenta`.
--   3. `admin_suspender_cuenta`  (redefinida): ahora deja el bloqueo registrado.
--   4. `admin_marcar_vencida`    (nueva): marca una cuenta vencida a mano.
--   5. `admin_reactivar_cuenta`  (nueva): levanta la suspensión, explícitamente.
--   6. `admin_bloqueos_cuenta`   (nueva): historial, sólo superadmin.
--   7. `admin_registrar_pago_manual`, `admin_ajustar_vencimiento` y
--      `admin_extender_trial` (redefinidas): con una suspensión abierta registran
--      el dato como siempre pero NO tocan el estado ni el motivo. La
--      reactivación es siempre una acción explícita.
--
-- LO QUE ESTA MIGRACIÓN NO HACE (a propósito)
--   - No agrega triggers: nada impide todavía que el webhook de Mercado Pago o
--     una escritura manual pisen una suspensión. Es un paso aparte.
--   - No toca el cron, el webhook, las Edge Functions ni `src/types/database.ts`.
--   - No toca RLS ni policies ni los grants de otras columnas.
--   - No limpia datos existentes: el backfill de las suspensiones anteriores es
--     la migración siguiente (20261103130000).
--
-- Eventos nuevos en `eventos_facturacion.tipo`: `cuenta_vencida_manual` y
-- `cuenta_reactivada`. `cuenta_suspendida` ya existía.
--
-- Idempotente. Todo en una transacción: si la verificación final falla, no
-- queda nada aplicado.

begin;

-- ---------------------------------------------------------------------------
-- 0. Precondiciones
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.inmobiliarias') is null
     or to_regclass('public.eventos_facturacion') is null
     or to_regclass('public.profiles') is null then
    raise exception 'ABORTADO: faltan inmobiliarias, eventos_facturacion o profiles.';
  end if;

  if to_regtype('public.estado_suscripcion') is null then
    raise exception 'ABORTADO: no existe el tipo public.estado_suscripcion.';
  end if;

  if to_regprocedure('private.my_es_superadmin()') is null then
    raise exception 'ABORTADO: no existe private.my_es_superadmin().';
  end if;

  -- Los dos tipos de evento nuevos no pueden chocar con un CHECK sobre `tipo`.
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.eventos_facturacion'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%tipo%'
  ) then
    raise exception
      'ABORTADO: eventos_facturacion tiene un CHECK que menciona "tipo". Revisar que admita cuenta_vencida_manual y cuenta_reactivada.';
  end if;

  -- `bloqueo_motivo` queda a salvo de un dueño que quiera sacársela de encima
  -- sólo si ningún rol del navegador puede actualizar `inmobiliarias`. Hoy no
  -- hay policy de UPDATE (la auditoría lo confirma con una prueba real); si
  -- apareciera una, esta migración no puede garantizar nada.
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'inmobiliarias'
      and cmd in ('UPDATE', 'ALL')
      and roles && array['public', 'anon', 'authenticated']::name[]
  ) then
    raise exception
      'ABORTADO: inmobiliarias tiene una policy de UPDATE para anon/authenticated. Con eso el dueño podría borrar bloqueo_motivo; revisarla antes de aplicar.';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 1. inmobiliarias.bloqueo_motivo
-- ---------------------------------------------------------------------------
-- NULL = sin suspensión manual. Por ahora un único valor posible; el CHECK es
-- una lista para poder sumar motivos sin cambiar de tipo de dato.
--
-- Grants: no hace falta ninguno. `inmobiliarias` no tiene grants por columna en
-- el repo (el SELECT por columna sólo se usa en `eventos_facturacion` y
-- `profiles`), así que una columna nueva hereda el SELECT de la tabla y los
-- miembros de la inmobiliaria la leen con la policy de su propia fila. La
-- verificación del final lo comprueba. No se cambian los grants de ninguna otra
-- columna.
alter table public.inmobiliarias
  add column if not exists bloqueo_motivo text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.inmobiliarias'::regclass
      and conname = 'inmobiliarias_bloqueo_motivo_check'
  ) then
    alter table public.inmobiliarias
      add constraint inmobiliarias_bloqueo_motivo_check
      check (bloqueo_motivo is null or bloqueo_motivo in ('SUSPENSION_ADMIN'));
  end if;
end
$$;

comment on column public.inmobiliarias.bloqueo_motivo is
  'SUSPENSION_ADMIN si el superadmin suspendió la cuenta; NULL si no hay suspensión manual. La nota, el autor y las fechas están en bloqueos_cuenta, que el cliente no lee.';

-- ---------------------------------------------------------------------------
-- 2. bloqueos_cuenta
-- ---------------------------------------------------------------------------
-- Una fila por suspensión, abierta mientras `levantado_at` es NULL. El índice
-- único parcial garantiza una sola abierta por cuenta.
--
-- `bloqueado_por` y `levantado_por` son `on delete set null`: borrar un perfil no
-- tiene que llevarse el historial.
--
-- `estado_anterior` es el estado en que estaba la cuenta al suspenderla;
-- `admin_reactivar_cuenta` lo usa para volver, si todavía es válido.
create table if not exists public.bloqueos_cuenta (
  id               uuid primary key default gen_random_uuid(),
  inmobiliaria_id  uuid not null references public.inmobiliarias(id) on delete cascade,
  motivo           text not null,
  nota             text not null,
  estado_anterior  public.estado_suscripcion not null,
  bloqueado_por    uuid references public.profiles(id) on delete set null,
  bloqueado_at     timestamptz not null default now(),
  levantado_por    uuid references public.profiles(id) on delete set null,
  levantado_at     timestamptz,
  nota_reactivacion text,
  constraint bloqueos_cuenta_motivo_check
    check (motivo in ('SUSPENSION_ADMIN')),
  constraint bloqueos_cuenta_reactivacion_check
    check (nota_reactivacion is null or levantado_at is not null)
);

create unique index if not exists bloqueos_cuenta_abierto_unico
  on public.bloqueos_cuenta (inmobiliaria_id)
  where levantado_at is null;

create index if not exists bloqueos_cuenta_historial_idx
  on public.bloqueos_cuenta (inmobiliaria_id, bloqueado_at desc);

-- Mismo patrón que `avisos_vencimiento`: RLS activado, sin ninguna policy, y el
-- acceso cortado también desde el grant. El default de Supabase le daría
-- privilegios a anon y authenticated apenas alguien agregue una policy sin
-- pensarlo. Sólo la lee `admin_bloqueos_cuenta()` (SECURITY DEFINER) y la
-- escriben las RPC de admin.
alter table public.bloqueos_cuenta enable row level security;
revoke all on table public.bloqueos_cuenta from anon, authenticated;

comment on table public.bloqueos_cuenta is
  'Historial de suspensiones de cuentas hechas por el superadmin: nota interna, autor, fechas y estado anterior. Sin policies: el cliente no lo lee. Se consulta con admin_bloqueos_cuenta().';

-- ---------------------------------------------------------------------------
-- 3. Suspender una cuenta
-- ---------------------------------------------------------------------------
-- Reemplaza la versión de 20260924120000_admin_gestion.sql (3d). Misma firma, mismo
-- retorno, mismas defensas; cambia qué deja escrito y lo que rechaza.
--
-- Rechaza:
--   - una cuenta que ya tiene una suspensión abierta.
--   - una cuenta CANCELADA: ya no tiene acceso, no hay nada que suspender, y
--     pasarla a VENCIDA le borraría esa información.
--   - una cuenta de Mercado Pago con suscripción cargada (`mp_preapproval_id`)
--     en ACTIVA o GRACIA. Antes sólo se frenaba ACTIVA con la baja sin pedir; una
--     en GRACIA o con la baja ya pedida pasaba, y Mercado Pago le seguía
--     cobrando o reintentando a alguien sin acceso. Una prueba (TRIAL) con un
--     preapproval cargado sí se puede suspender: todavía no se le cobra nada.
--
-- Una cuenta VENCIDA sin suspensión abierta (vencimiento natural o marcada
-- vencida a mano) SÍ se puede suspender: pasa a ser una suspensión, y su
-- estado anterior queda en VENCIDA.
--
-- `detalle` es legible por el cliente: va un texto genérico. La nota sólo se
-- guarda en `bloqueos_cuenta` y en `raw_payload`.
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
  v_cuenta     public.inmobiliarias%rowtype;
  v_nota       text;
  v_bloqueo_id uuid;
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

  if exists (
    select 1 from public.bloqueos_cuenta b
    where b.inmobiliaria_id = p_inmobiliaria_id and b.levantado_at is null
  ) then
    raise exception 'La cuenta ya está suspendida. Reactivala antes de volver a suspenderla.';
  end if;

  if v_cuenta.estado_suscripcion = 'CANCELADA' then
    raise exception 'La cuenta está cancelada: ya no tiene acceso, así que no hay nada que suspender.';
  end if;

  if v_cuenta.metodo_cobro = 'MERCADO_PAGO'
     and v_cuenta.mp_preapproval_id is not null
     and v_cuenta.estado_suscripcion in ('ACTIVA', 'GRACIA') then
    raise exception 'La cuenta tiene una suscripción de Mercado Pago cargada y está activa o con un cobro fallido. Hay que cancelarla en Mercado Pago antes de suspenderla.';
  end if;

  insert into public.bloqueos_cuenta (
    inmobiliaria_id, motivo, nota, estado_anterior, bloqueado_por
  )
  values (
    p_inmobiliaria_id, 'SUSPENSION_ADMIN', v_nota, v_cuenta.estado_suscripcion, auth.uid()
  )
  returning id into v_bloqueo_id;

  update public.inmobiliarias
     set estado_suscripcion = 'VENCIDA',
         bloqueo_motivo     = 'SUSPENSION_ADMIN'
   where id = p_inmobiliaria_id;

  insert into public.eventos_facturacion (inmobiliaria_id, tipo, monto, moneda, detalle, raw_payload)
  values (
    p_inmobiliaria_id,
    'cuenta_suspendida',
    null,
    'ARS',
    'Cuenta suspendida por el administrador',
    jsonb_build_object(
      'bloqueo_id', v_bloqueo_id,
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

comment on function public.admin_suspender_cuenta(uuid, text) is
  'Panel /admin: suspende una cuenta (VENCIDA + bloqueo_motivo) y deja la nota, el autor y la fecha en bloqueos_cuenta. Sólo superadmin.';

-- ---------------------------------------------------------------------------
-- 4. Marcar una cuenta como vencida a mano
-- ---------------------------------------------------------------------------
-- Para el cliente que no pagó y hay que cortarle el acceso sin que sea una
-- "suspensión": queda VENCIDA con `bloqueo_motivo` NULL, igual que un
-- vencimiento natural, y se levanta como éste (con un pago, un ajuste de
-- vencimiento o una extensión de prueba). No abre ningún bloqueo.
--
-- Sólo donde tiene sentido:
--   - cuenta MANUAL en ACTIVA o GRACIA.
--   - cuenta en TRIAL sin suscripción de Mercado Pago cargada.
-- Una de Mercado Pago ACTIVA/GRACIA la vence el propio Mercado Pago, y la
-- VENCIDA/CANCELADA ya está cortada.
--
-- La nota es opcional y va en `detalle`, que el cliente puede leer.
create or replace function public.admin_marcar_vencida(
  p_inmobiliaria_id uuid,
  p_nota text default null
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

  select * into v_cuenta
  from public.inmobiliarias
  where id = p_inmobiliaria_id
  for update;

  if not found then
    raise exception 'No existe la inmobiliaria %.', p_inmobiliaria_id;
  end if;

  if exists (
    select 1 from public.bloqueos_cuenta b
    where b.inmobiliaria_id = p_inmobiliaria_id and b.levantado_at is null
  ) then
    raise exception 'La cuenta está suspendida. Reactivala desde su ficha.';
  end if;

  if not (
    (v_cuenta.metodo_cobro = 'MANUAL' and v_cuenta.estado_suscripcion in ('ACTIVA', 'GRACIA'))
    or (v_cuenta.estado_suscripcion = 'TRIAL' and v_cuenta.mp_preapproval_id is null)
  ) then
    raise exception 'Sólo se puede marcar como vencida una cuenta manual activa o en gracia, o una prueba sin suscripción de Mercado Pago. Esta es de % y está en %.',
      v_cuenta.metodo_cobro, v_cuenta.estado_suscripcion;
  end if;

  update public.inmobiliarias
     set estado_suscripcion = 'VENCIDA',
         bloqueo_motivo     = null
   where id = p_inmobiliaria_id;

  insert into public.eventos_facturacion (inmobiliaria_id, tipo, monto, moneda, detalle, raw_payload)
  values (
    p_inmobiliaria_id,
    'cuenta_vencida_manual',
    null,
    'ARS',
    'Cuenta marcada como vencida por el administrador'
      || coalesce(' · Nota: ' || v_nota, ''),
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

revoke execute on function public.admin_marcar_vencida(uuid, text) from public, anon;
grant execute on function public.admin_marcar_vencida(uuid, text) to authenticated;

comment on function public.admin_marcar_vencida(uuid, text) is
  'Panel /admin: marca vencida a mano una cuenta manual activa/en gracia o una prueba sin Mercado Pago. No abre bloqueo. Nota opcional, visible para el cliente. Sólo superadmin.';

-- ---------------------------------------------------------------------------
-- 5. Reactivar una cuenta suspendida
-- ---------------------------------------------------------------------------
-- La única forma de levantar una suspensión. Cierra el bloqueo, limpia
-- `bloqueo_motivo` y devuelve la cuenta al estado que le corresponde HOY, que no
-- siempre es el de antes: pasó tiempo, y mientras estuvo suspendida pudieron
-- registrarse pagos o moverse fechas (esas RPC no tocan el estado).
--
-- Estado destino, en este orden:
--   0. La cuenta ya no está VENCIDA: algo (por ejemplo el webhook de Mercado
--      Pago) la sacó de ahí y pisó la suspensión. Sólo se cierra el bloqueo y
--      se limpia el motivo; el estado se deja como está, no se la baja.
--   1. MANUAL con `acceso_pagado_hasta` vigente (el día, en hora de Argentina, no
--      pasó todavía; la misma regla del cron) -> ACTIVA. Cubre una cuenta que
--      estaba ACTIVA y también una a la que se le registró un pago durante la
--      suspensión: el estado anterior no importa si hoy tiene el acceso pago.
--   2. Estaba en TRIAL y `fecha_fin_trial` no pasó -> TRIAL.
--   3. Era de Mercado Pago, estaba ACTIVA y `fecha_proximo_cobro` es futura
--      (pidió la baja pero tiene el período pago) -> ACTIVA.
--   4. Cualquier otro caso (estaba GRACIA o ya VENCIDA; la prueba terminó; el
--      acceso pago terminó) -> VENCIDA, sin bloqueo. Se levantó la suspensión
--      pero la cuenta sigue sin acceso hasta que pague.
-- Esto último evita lo que más molesta: reactivar y que la cuenta quede ACTIVA
-- con un vencimiento pasado, a la espera de que el cron la corte a la noche.
--
-- Devuelve el estado en que quedó la cuenta, para poder avisarlo.
--
-- La nota es obligatoria, como en el resto de las acciones del panel. Va sólo a
-- `bloqueos_cuenta` y a `raw_payload`; `detalle` es genérico porque el cliente lo
-- puede leer.
create or replace function public.admin_reactivar_cuenta(
  p_inmobiliaria_id uuid,
  p_nota text
)
returns public.estado_suscripcion
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cuenta  public.inmobiliarias%rowtype;
  v_bloqueo public.bloqueos_cuenta%rowtype;
  v_nota    text;
  v_destino public.estado_suscripcion;
  v_zona    text := 'America/Argentina/Buenos_Aires';
  v_hoy     date;
  v_detalle text;
begin
  if not coalesce(private.my_es_superadmin(), false) then
    raise exception 'permiso denegado' using errcode = '42501';
  end if;

  v_nota := nullif(btrim(p_nota), '');
  if v_nota is null then
    raise exception 'La nota es obligatoria: dejá escrito por qué se reactiva la cuenta.';
  end if;

  select * into v_cuenta
  from public.inmobiliarias
  where id = p_inmobiliaria_id
  for update;

  if not found then
    raise exception 'No existe la inmobiliaria %.', p_inmobiliaria_id;
  end if;

  select * into v_bloqueo
  from public.bloqueos_cuenta b
  where b.inmobiliaria_id = p_inmobiliaria_id and b.levantado_at is null
  for update;

  if not found then
    raise exception 'La cuenta no tiene una suspensión abierta.';
  end if;

  v_hoy := (now() at time zone v_zona)::date;
  v_destino := 'VENCIDA';

  if v_cuenta.estado_suscripcion <> 'VENCIDA' then
    -- Algo (por ejemplo el webhook de Mercado Pago) ya la sacó de VENCIDA y pisó
    -- la suspensión: sólo se cierra el bloqueo, no se la baja de estado.
    v_destino := v_cuenta.estado_suscripcion;
  elsif v_cuenta.metodo_cobro = 'MANUAL'
     and v_cuenta.acceso_pagado_hasta is not null
     and (v_cuenta.acceso_pagado_hasta at time zone v_zona)::date >= v_hoy then
    v_destino := 'ACTIVA';
  elsif v_bloqueo.estado_anterior = 'TRIAL'
        and v_cuenta.fecha_fin_trial > now() then
    v_destino := 'TRIAL';
  elsif v_bloqueo.estado_anterior = 'ACTIVA'
        and v_cuenta.metodo_cobro = 'MERCADO_PAGO'
        and v_cuenta.fecha_proximo_cobro is not null
        and v_cuenta.fecha_proximo_cobro > now() then
    v_destino := 'ACTIVA';
  end if;

  update public.inmobiliarias
     set estado_suscripcion = v_destino,
         bloqueo_motivo     = null
   where id = p_inmobiliaria_id;

  update public.bloqueos_cuenta
     set levantado_por     = auth.uid(),
         levantado_at      = now(),
         nota_reactivacion = v_nota
   where id = v_bloqueo.id;

  v_detalle := case
                 when v_destino = 'VENCIDA'
                   then 'Suspensión levantada por el administrador · La cuenta queda vencida'
                 else 'Cuenta reactivada por el administrador'
               end;

  insert into public.eventos_facturacion (inmobiliaria_id, tipo, monto, moneda, detalle, raw_payload)
  values (
    p_inmobiliaria_id,
    'cuenta_reactivada',
    null,
    'ARS',
    v_detalle,
    jsonb_build_object(
      'bloqueo_id', v_bloqueo.id,
      'estado_anterior_al_bloqueo', v_bloqueo.estado_anterior,
      'estado_nuevo', v_destino,
      'nota', v_nota,
      'registrado_por', auth.uid()
    )
  );

  return v_destino;
end;
$$;

revoke execute on function public.admin_reactivar_cuenta(uuid, text) from public, anon;
grant execute on function public.admin_reactivar_cuenta(uuid, text) to authenticated;

comment on function public.admin_reactivar_cuenta(uuid, text) is
  'Panel /admin: levanta una suspensión abierta y devuelve la cuenta al estado que le corresponde hoy (ACTIVA, TRIAL o VENCIDA). Nota obligatoria. Sólo superadmin.';

-- ---------------------------------------------------------------------------
-- 6. Historial de bloqueos de una cuenta
-- ---------------------------------------------------------------------------
-- Para la ficha de la cuenta. Es la única puerta de lectura de
-- `bloqueos_cuenta`. Los nombres se resuelven desde `profiles`; si un perfil se
-- borró, el nombre viene NULL. Del más reciente al más viejo.
--
-- Los nombres de las columnas de salida (`id`, `motivo`, ...) son también
-- variables de la función: por eso toda referencia a la tabla va calificada.
create or replace function public.admin_bloqueos_cuenta(p_inmobiliaria_id uuid)
returns table (
  id                   uuid,
  motivo               text,
  nota                 text,
  estado_anterior      public.estado_suscripcion,
  bloqueado_at         timestamptz,
  bloqueado_por        uuid,
  bloqueado_por_nombre text,
  levantado_at         timestamptz,
  levantado_por        uuid,
  levantado_por_nombre text,
  nota_reactivacion    text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not coalesce(private.my_es_superadmin(), false) then
    raise exception 'permiso denegado' using errcode = '42501';
  end if;

  return query
  select b.id,
         b.motivo,
         b.nota,
         b.estado_anterior,
         b.bloqueado_at,
         b.bloqueado_por,
         nullif(btrim(coalesce(pb.nombre, '') || ' ' || coalesce(pb.apellido, '')), ''),
         b.levantado_at,
         b.levantado_por,
         nullif(btrim(coalesce(pl.nombre, '') || ' ' || coalesce(pl.apellido, '')), ''),
         b.nota_reactivacion
  from public.bloqueos_cuenta b
  left join public.profiles pb on pb.id = b.bloqueado_por
  left join public.profiles pl on pl.id = b.levantado_por
  where b.inmobiliaria_id = p_inmobiliaria_id
  order by b.bloqueado_at desc;
end;
$$;

revoke execute on function public.admin_bloqueos_cuenta(uuid) from public, anon;
grant execute on function public.admin_bloqueos_cuenta(uuid) to authenticated;

comment on function public.admin_bloqueos_cuenta(uuid) is
  'Panel /admin: historial de suspensiones de una cuenta, con la nota interna y el nombre de quien bloqueó y levantó. Sólo superadmin.';

-- ---------------------------------------------------------------------------
-- 7a. Registrar un pago manual
-- ---------------------------------------------------------------------------
-- Reemplaza la versión de 20260924140000_cupo_por_rol.sql (la vigente). Es la
-- misma función —misma firma, mismo retorno, mismas validaciones, mismo cálculo
-- de cupo, mismo evento— con un único cambio: si la cuenta tiene una suspensión
-- abierta, el pago se registra y el acceso pago se extiende, pero NO se toca
-- `estado_suscripcion`. Para levantarla hay que reactivar de forma explícita
-- (`admin_reactivar_cuenta`), que ya ve el acceso pago y deja la cuenta ACTIVA.
--
-- Sigue devolviendo el nuevo `acceso_pagado_hasta`: el tipo de retorno no deja
-- avisar que la cuenta sigue suspendida. El front lo sabe por `bloqueo_motivo`.
create or replace function public.admin_registrar_pago_manual(
  p_inmobiliaria_id uuid,
  p_plan public.plan_leadera,
  p_meses int,
  p_monto numeric,
  p_fecha_pago date,
  p_metodo text,
  p_nota text
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cuenta            public.inmobiliarias%rowtype;
  v_anterior          timestamptz;
  v_nuevo_hasta       timestamptz;
  v_limite_usuarios   int;
  v_aplicar_cupo      boolean;
  v_usuarios          int;
  v_metodo_legible    text;
  v_detalle           text;
  v_bloqueado         boolean;
  v_zona              text := 'America/Argentina/Buenos_Aires';
begin
  if not coalesce(private.my_es_superadmin(), false) then
    raise exception 'permiso denegado' using errcode = '42501';
  end if;

  if p_meses is null or p_meses < 1 or p_meses > 12 then
    raise exception 'Los meses tienen que estar entre 1 y 12.';
  end if;

  if p_monto is null or p_monto <= 0 then
    raise exception 'El monto tiene que ser mayor a 0.';
  end if;

  if p_metodo is null or p_metodo not in ('TRANSFERENCIA', 'EFECTIVO', 'OTRO') then
    raise exception 'El método de pago tiene que ser TRANSFERENCIA, EFECTIVO u OTRO.';
  end if;

  -- FOR UPDATE: dos registros simultáneos sobre la misma cuenta se
  -- serializan, así que el segundo extiende sobre el resultado del primero en
  -- vez de pisarlo.
  select * into v_cuenta
  from public.inmobiliarias
  where id = p_inmobiliaria_id
  for update;

  if not found then
    raise exception 'No existe la inmobiliaria %.', p_inmobiliaria_id;
  end if;

  -- Una suscripción viva en Mercado Pago le va a seguir escribiendo el estado
  -- a esta cuenta por webhook. Cobrarle además por transferencia es cobrarle
  -- dos veces, así que se corta acá.
  if v_cuenta.metodo_cobro = 'MERCADO_PAGO'
     and v_cuenta.estado_suscripcion = 'ACTIVA'
     and v_cuenta.mp_preapproval_id is not null
     and v_cuenta.cancelacion_solicitada = false then
    raise exception 'La cuenta tiene una suscripción activa de Mercado Pago. Cancelala antes de registrar un pago manual.';
  end if;

  v_bloqueado := exists (
    select 1 from public.bloqueos_cuenta b
    where b.inmobiliaria_id = p_inmobiliaria_id and b.levantado_at is null
  );

  v_anterior := v_cuenta.acceso_pagado_hasta;

  -- `greatest(..., now())` para que un pago tardío no arranque en el pasado:
  -- si el acceso ya venció, los meses se cuentan desde hoy. Si todavía está
  -- vigente, se apilan sobre lo que quedaba y no se le regala nada.
  v_nuevo_hasta := greatest(coalesce(v_cuenta.acceso_pagado_hasta, now()), now())
                   + make_interval(months => p_meses);

  -- Cupo de usuarios: el tope del plan, pero nunca por debajo de la gente que
  -- la inmobiliaria ya tiene cargada.
  select limite_usuarios into v_limite_usuarios
  from public.planes_cupo
  where plan = p_plan;
  v_aplicar_cupo := found;

  if v_aplicar_cupo and v_limite_usuarios is not null then
    -- SECURITY DEFINER, así que este conteo no lo acota RLS: son todos los
    -- profiles de la inmobiliaria. No filtra por `activo` a propósito, igual
    -- que `hayCupo`: un miembro desactivado sigue ocupando su lugar.
    select count(*) into v_usuarios
    from public.profiles
    where inmobiliaria_id = p_inmobiliaria_id;

    v_limite_usuarios := greatest(v_limite_usuarios, v_usuarios);
  end if;

  -- Con una suspensión abierta el estado se deja como está (VENCIDA).
  update public.inmobiliarias
     set estado_suscripcion       = case when v_bloqueado then estado_suscripcion
                                         else 'ACTIVA' end,
         metodo_cobro             = 'MANUAL',
         acceso_pagado_hasta      = v_nuevo_hasta,
         plan                     = p_plan,
         fecha_ultimo_pago_fallido = null,
         cancelacion_solicitada   = false,
         limite_usuarios          = case when v_aplicar_cupo then v_limite_usuarios
                                         else limite_usuarios end
   where id = p_inmobiliaria_id;

  v_metodo_legible := case p_metodo
                        when 'TRANSFERENCIA' then 'Transferencia'
                        when 'EFECTIVO'      then 'Efectivo'
                        else 'Otro'
                      end;

  v_detalle := v_metodo_legible
    || ' · ' || p_meses || (case when p_meses = 1 then ' mes' else ' meses' end)
    || ' · Plan ' || p_plan::text
    || ' · pagado el ' || to_char(p_fecha_pago, 'DD/MM/YYYY')
    || ' · activa hasta ' || to_char(v_nuevo_hasta at time zone v_zona, 'DD/MM/YYYY')
    || coalesce(' · Nota: ' || nullif(btrim(p_nota), ''), '');

  insert into public.eventos_facturacion (inmobiliaria_id, tipo, monto, moneda, detalle, raw_payload)
  values (
    p_inmobiliaria_id,
    'pago_manual',
    p_monto,
    'ARS',
    v_detalle,
    jsonb_build_object(
      'meses', p_meses,
      'metodo', p_metodo,
      'fecha_pago', p_fecha_pago,
      'nota', nullif(btrim(p_nota), ''),
      'plan', p_plan::text,
      'acceso_hasta_anterior', v_anterior,
      'acceso_hasta_nuevo', v_nuevo_hasta,
      'cuenta_suspendida', v_bloqueado,
      'registrado_por', auth.uid()
    )
  );

  return v_nuevo_hasta;
end;
$$;

revoke execute on function public.admin_registrar_pago_manual(uuid, public.plan_leadera, int, numeric, date, text, text) from public, anon;
grant execute on function public.admin_registrar_pago_manual(uuid, public.plan_leadera, int, numeric, date, text, text) to authenticated;

comment on function public.admin_registrar_pago_manual(uuid, public.plan_leadera, int, numeric, date, text, text) is
  'Panel /admin: registra un pago por transferencia y extiende el acceso. Con una suspensión abierta no cambia el estado. Sólo superadmin (chequeo interno).';

-- ---------------------------------------------------------------------------
-- 7b. Ajustar el vencimiento a mano
-- ---------------------------------------------------------------------------
-- Reemplaza la versión de 20260923120000_cobro_manual.sql (4). Igual salvo que,
-- con una suspensión abierta, mueve la fecha y deja el estado en paz (adelantar
-- la fecha ya no reactiva). Sigue devolviendo void.
create or replace function public.admin_ajustar_vencimiento(
  p_inmobiliaria_id uuid,
  p_nuevo_hasta timestamptz,
  p_nota text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cuenta     public.inmobiliarias%rowtype;
  v_anterior   timestamptz;
  v_estado     public.estado_suscripcion;
  v_nota       text;
  v_bloqueado  boolean;
  v_zona       text := 'America/Argentina/Buenos_Aires';
begin
  if not coalesce(private.my_es_superadmin(), false) then
    raise exception 'permiso denegado' using errcode = '42501';
  end if;

  v_nota := nullif(btrim(p_nota), '');
  if v_nota is null then
    raise exception 'La nota es obligatoria: dejá escrito por qué se ajusta el vencimiento.';
  end if;

  if p_nuevo_hasta is null then
    raise exception 'Falta la fecha nueva de vencimiento.';
  end if;

  select * into v_cuenta
  from public.inmobiliarias
  where id = p_inmobiliaria_id
  for update;

  if not found then
    raise exception 'No existe la inmobiliaria %.', p_inmobiliaria_id;
  end if;

  if v_cuenta.metodo_cobro <> 'MANUAL' then
    raise exception 'Esta cuenta cobra por Mercado Pago: su vencimiento lo maneja el webhook. Registrá un pago manual primero.';
  end if;

  v_bloqueado := exists (
    select 1 from public.bloqueos_cuenta b
    where b.inmobiliaria_id = p_inmobiliaria_id and b.levantado_at is null
  );

  v_anterior := v_cuenta.acceso_pagado_hasta;
  v_estado := v_cuenta.estado_suscripcion;

  -- Adelantar la fecha reactiva la cuenta; atrasarla NO la vence acá. De eso se
  -- encarga el cron. Con una suspensión abierta no se reactiva: eso sólo lo hace
  -- `admin_reactivar_cuenta`.
  if not v_bloqueado
     and p_nuevo_hasta > now()
     and v_cuenta.estado_suscripcion in ('GRACIA', 'VENCIDA') then
    v_estado := 'ACTIVA';
  end if;

  update public.inmobiliarias
     set acceso_pagado_hasta = p_nuevo_hasta,
         estado_suscripcion  = v_estado,
         fecha_ultimo_pago_fallido = case when v_estado = 'ACTIVA' then null
                                          else fecha_ultimo_pago_fallido end
   where id = p_inmobiliaria_id;

  insert into public.eventos_facturacion (inmobiliaria_id, tipo, monto, moneda, detalle, raw_payload)
  values (
    p_inmobiliaria_id,
    'ajuste_vencimiento',
    null,
    'ARS',
    'Vencimiento ajustado de '
      || coalesce(to_char(v_anterior at time zone v_zona, 'DD/MM/YYYY'), 'sin fecha')
      || ' a ' || to_char(p_nuevo_hasta at time zone v_zona, 'DD/MM/YYYY')
      || ' · Nota: ' || v_nota,
    jsonb_build_object(
      'acceso_hasta_anterior', v_anterior,
      'acceso_hasta_nuevo', p_nuevo_hasta,
      'estado_anterior', v_cuenta.estado_suscripcion,
      'estado_nuevo', v_estado,
      'cuenta_suspendida', v_bloqueado,
      'nota', v_nota,
      'registrado_por', auth.uid()
    )
  );
end;
$$;

revoke execute on function public.admin_ajustar_vencimiento(uuid, timestamptz, text) from public, anon;
grant execute on function public.admin_ajustar_vencimiento(uuid, timestamptz, text) to authenticated;

comment on function public.admin_ajustar_vencimiento(uuid, timestamptz, text) is
  'Panel /admin: corrige a mano el vencimiento de una cuenta manual. Nota obligatoria. Con una suspensión abierta no cambia el estado. Sólo superadmin.';

-- ---------------------------------------------------------------------------
-- 7c. Extender un trial
-- ---------------------------------------------------------------------------
-- Reemplaza la versión de 20260924120000_admin_gestion.sql (3c). Igual salvo que,
-- con una suspensión abierta, mueve `fecha_fin_trial` y deja el estado como está
-- (VENCIDA) en lugar de pasarla a TRIAL. Sigue devolviendo la fecha nueva de fin
-- de trial.
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
  v_cuenta     public.inmobiliarias%rowtype;
  v_anterior   timestamptz;
  v_nuevo      timestamptz;
  v_nota       text;
  v_bloqueado  boolean;
  v_zona       text := 'America/Argentina/Buenos_Aires';
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

  v_bloqueado := exists (
    select 1 from public.bloqueos_cuenta b
    where b.inmobiliaria_id = p_inmobiliaria_id and b.levantado_at is null
  );

  v_anterior := v_cuenta.fecha_fin_trial;
  v_nuevo := greatest(v_cuenta.fecha_fin_trial, now()) + make_interval(days => p_dias);

  update public.inmobiliarias
     set estado_suscripcion = case when v_bloqueado then estado_suscripcion
                                   else 'TRIAL' end,
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
      'cuenta_suspendida', v_bloqueado,
      'nota', v_nota,
      'registrado_por', auth.uid()
    )
  );

  return v_nuevo;
end;
$$;

revoke execute on function public.admin_extender_trial(uuid, int, text) from public, anon;
grant execute on function public.admin_extender_trial(uuid, int, text) to authenticated;

comment on function public.admin_extender_trial(uuid, int, text) is
  'Panel /admin: extiende la prueba de una cuenta de Mercado Pago en prueba o vencida. Con una suspensión abierta no cambia el estado. Sólo superadmin.';

-- ---------------------------------------------------------------------------
-- Verificación: si algo no da, se aborta y no se aplica nada.
-- ---------------------------------------------------------------------------
do $$
declare
  firma   text;
  v_oid   oid;
  rol     text;
  priv    text;
  funciones text[] := array[
    'public.admin_suspender_cuenta(uuid,text)',
    'public.admin_marcar_vencida(uuid,text)',
    'public.admin_reactivar_cuenta(uuid,text)',
    'public.admin_bloqueos_cuenta(uuid)',
    'public.admin_registrar_pago_manual(uuid,public.plan_leadera,integer,numeric,date,text,text)',
    'public.admin_ajustar_vencimiento(uuid,timestamptz,text)',
    'public.admin_extender_trial(uuid,integer,text)'
  ];
begin
  -- Las siete funciones: existen, son SECURITY DEFINER con search_path vacío, y
  -- sólo las ejecuta un usuario con sesión.
  foreach firma in array funciones loop
    v_oid := to_regprocedure(firma);
    if v_oid is null then
      raise exception 'ABORTADO: no existe la función %.', firma;
    end if;
    if not (select p.prosecdef from pg_proc p where p.oid = v_oid) then
      raise exception 'ABORTADO: % no es SECURITY DEFINER.', firma;
    end if;
    if not exists (
      select 1
      from pg_proc p, unnest(coalesce(p.proconfig, '{}'::text[])) c
      where p.oid = v_oid and c in ('search_path=""', 'search_path=')
    ) then
      raise exception 'ABORTADO: % no tiene search_path vacío.', firma;
    end if;
    if has_function_privilege('anon', v_oid, 'EXECUTE') then
      raise exception 'ABORTADO: anon puede ejecutar %.', firma;
    end if;
    if not has_function_privilege('authenticated', v_oid, 'EXECUTE') then
      raise exception 'ABORTADO: authenticated no puede ejecutar %.', firma;
    end if;
  end loop;

  -- bloqueos_cuenta: RLS activada, sin policies y sin ningún privilegio para los
  -- roles del navegador.
  if not (select c.relrowsecurity from pg_class c where c.oid = 'public.bloqueos_cuenta'::regclass) then
    raise exception 'ABORTADO: bloqueos_cuenta no tiene RLS activada.';
  end if;

  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'bloqueos_cuenta') then
    raise exception 'ABORTADO: bloqueos_cuenta tiene policies y no debería tener ninguna.';
  end if;

  foreach rol in array array['anon', 'authenticated'] loop
    foreach priv in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'] loop
      if has_table_privilege(rol, 'public.bloqueos_cuenta', priv) then
        raise exception 'ABORTADO: % tiene % sobre bloqueos_cuenta.', rol, priv;
      end if;
    end loop;
  end loop;

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'bloqueos_cuenta_abierto_unico'
  ) then
    raise exception 'ABORTADO: falta el índice único de bloqueo abierto.';
  end if;

  -- bloqueo_motivo: existe, tiene su CHECK y los miembros la pueden leer.
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'inmobiliarias' and column_name = 'bloqueo_motivo'
  ) then
    raise exception 'ABORTADO: falta la columna inmobiliarias.bloqueo_motivo.';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.inmobiliarias'::regclass
      and conname = 'inmobiliarias_bloqueo_motivo_check'
  ) then
    raise exception 'ABORTADO: falta el CHECK de bloqueo_motivo.';
  end if;

  if not has_column_privilege('authenticated', 'public.inmobiliarias', 'bloqueo_motivo', 'SELECT') then
    raise exception 'ABORTADO: authenticated no puede leer inmobiliarias.bloqueo_motivo. Hace falta un GRANT SELECT (bloqueo_motivo) ... TO authenticated.';
  end if;

  -- Nada quedó con motivo sin bloqueo abierto (la columna recién se creó).
  if exists (
    select 1 from public.inmobiliarias i
    where i.bloqueo_motivo is not null
      and not exists (
        select 1 from public.bloqueos_cuenta b
        where b.inmobiliaria_id = i.id and b.levantado_at is null
      )
  ) then
    raise exception 'ABORTADO: hay cuentas con bloqueo_motivo y sin bloqueo abierto.';
  end if;
end
$$;

commit;

-- ---------------------------------------------------------------------------
-- Prueba manual (NO forma parte de la migración). Correla aparte, después de
-- aplicarla. Todo termina en ROLLBACK: no deja nada escrito.
-- Reemplazá <SUPERADMIN_UUID> por el id de tu usuario y <CUENTA_UUID> por el de
-- una cuenta de prueba (tipo TESTING) que NO sea de Mercado Pago activa.
-- ---------------------------------------------------------------------------
-- begin;
--   set local role authenticated;
--   select set_config('request.jwt.claims', '{"sub":"<SUPERADMIN_UUID>","role":"authenticated"}', true);
--
--   -- 1. Suspender: sin error. Después la cuenta está VENCIDA con motivo.
--   select public.admin_suspender_cuenta('<CUENTA_UUID>', 'prueba');
--   select estado_suscripcion, bloqueo_motivo from public.inmobiliarias where id = '<CUENTA_UUID>';
--
--   -- 2. Suspender de nuevo: tiene que fallar ("ya está suspendida").
--   select public.admin_suspender_cuenta('<CUENTA_UUID>', 'otra');
-- rollback;
--
-- begin;
--   set local role authenticated;
--   select set_config('request.jwt.claims', '{"sub":"<SUPERADMIN_UUID>","role":"authenticated"}', true);
--   select public.admin_suspender_cuenta('<CUENTA_UUID>', 'prueba');
--
--   -- 3. El historial trae la nota y tu nombre.
--   select * from public.admin_bloqueos_cuenta('<CUENTA_UUID>');
--
--   -- 4. El evento NO lleva la nota en detalle.
--   select tipo, detalle from public.eventos_facturacion
--    where inmobiliaria_id = '<CUENTA_UUID>' and tipo = 'cuenta_suspendida';
--
--   -- 5. Reactivar: devuelve el estado en que queda.
--   select public.admin_reactivar_cuenta('<CUENTA_UUID>', 'prueba terminada');
-- rollback;
--
-- begin;
--   -- 6. Un usuario común no puede nada: tiene que fallar con 42501.
--   set local role authenticated;
--   select set_config('request.jwt.claims', '{"sub":"<UUID_DE_UN_DUENO>","role":"authenticated"}', true);
--   select public.admin_suspender_cuenta('<CUENTA_UUID>', 'x');
--   -- 7. Y no lee el historial directo: tiene que fallar con "permission denied".
--   select * from public.bloqueos_cuenta;
-- rollback;
