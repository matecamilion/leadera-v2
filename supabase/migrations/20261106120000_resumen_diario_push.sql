-- Resumen diario por push: registro de envíos y conteo de "Mi día".
--
-- Dos piezas, las dos solo para la service role:
--
--   1. public.avisos_push_enviados: qué avisos push salieron, a quién y qué día.
--      Es lo que evita que un mismo resumen salga dos veces: la función que lo
--      manda corre una vez por día, pero nada impide dispararla a mano o que el
--      cron se repita. Clave única (usuario, tipo, fecha).
--
--   2. public.resumen_mi_dia(p_user_id, p_hoy): los cuatro números de las
--      tarjetas de Mi día para un usuario. Solo conteos.
--
-- La Edge Function que arma el texto y el cron van en una migración aparte.
--
-- No toca ninguna otra tabla, policy, trigger ni función existente.
--
-- Idempotente: create table if not exists, create or replace function.

begin;

-- ---------------------------------------------------------------------------
-- 1. Registro de avisos push enviados
-- ---------------------------------------------------------------------------
-- La clave es (usuario, tipo, fecha) y la fecha es el día de Argentina de la
-- corrida, no el UTC: el resumen de las 9:00 AR no puede caer en dos "días".
--
-- ENVIANDO es el reclamo que toma una corrida antes de llamar a enviar-push,
-- para que dos corridas simultáneas no manden el mismo aviso. OMITIDO es un día
-- sin nada pendiente: no se manda, pero queda registrado. Una fila en ERROR no
-- bloquea: la corrida siguiente del mismo día la reintenta.
--
-- Solo la usa la service role. RLS activado y sin ninguna policy.

create table if not exists public.avisos_push_enviados (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  tipo           text not null,
  fecha          date not null,
  estado         text not null,
  resumen        jsonb,
  dispositivos   int,
  enviados       int,
  error          text,
  intentos       int not null default 1,
  created_at     timestamptz not null default now(),
  actualizado_at timestamptz not null default now(),
  enviado_at     timestamptz,
  constraint avisos_push_enviados_tipo_check
    check (tipo in ('RESUMEN_DIARIO')),
  constraint avisos_push_enviados_estado_check
    check (estado in ('ENVIANDO', 'ENVIADO', 'OMITIDO', 'ERROR')),
  constraint avisos_push_enviados_unico unique (user_id, tipo, fecha)
);

create index if not exists avisos_push_enviados_fecha_idx
  on public.avisos_push_enviados (fecha);

alter table public.avisos_push_enviados enable row level security;

-- Sin policies alcanza para que no se lea nada, pero el grant por defecto de
-- Supabase a anon y authenticated la dejaría visible en la API apenas alguien
-- agregue una policy sin pensarlo. Se corta también desde el grant.
revoke all on table public.avisos_push_enviados from anon, authenticated;

comment on table public.avisos_push_enviados is
  'Avisos push enviados por las Edge Functions de resumen. Clave única por (usuario, tipo, fecha). Sólo service role.';
comment on column public.avisos_push_enviados.user_id is
  'Destinatario del aviso.';
comment on column public.avisos_push_enviados.tipo is
  'Clase de aviso. Hoy solo RESUMEN_DIARIO; se amplía con una migración futura.';
comment on column public.avisos_push_enviados.fecha is
  'Día calendario de Argentina de la corrida (no UTC).';
comment on column public.avisos_push_enviados.estado is
  'ENVIANDO: reclamo de una corrida en curso. ENVIADO: salió. OMITIDO: no había nada pendiente, no se mandó. ERROR: falló, la próxima corrida del día lo reintenta.';
comment on column public.avisos_push_enviados.resumen is
  'Los conteos calculados al momento del aviso, para auditar.';
comment on column public.avisos_push_enviados.dispositivos is
  'Cuántos dispositivos suscriptos tenía el usuario.';
comment on column public.avisos_push_enviados.enviados is
  'A cuántos dispositivos llegó el aviso.';
comment on column public.avisos_push_enviados.error is
  'Motivo del último fallo, si lo hubo.';
comment on column public.avisos_push_enviados.intentos is
  'Cuántas veces se intentó mandar este aviso.';
comment on column public.avisos_push_enviados.enviado_at is
  'Cuándo salió el aviso. Null si no salió.';

-- ---------------------------------------------------------------------------
-- 2. Conteo de Mi día
-- ---------------------------------------------------------------------------
-- Calcula los mismos cuatro números que las tarjetas de Mi día
-- (src/lib/api/dashboard.ts y src/pages/MiDia.tsx). SI CAMBIA MI DÍA HAY QUE
-- CAMBIAR ESTO: son dos implementaciones de la misma regla.
--
--   prioritarios  no GANADO y (estado = CALIENTE o seguimiento anterior a hoy)
--   nuevos        no GANADO y sin primer contacto real
--   seguimientos  no GANADO y seguimiento dentro de hoy
--   visitas_hoy   visitas de hoy, salvo las CANCELADA
--
-- A los tres de leads se les descuentan los que tuvieron una interacción hoy,
-- de cualquier autor (en Mi día pasan a "contactados"). Las categorías pueden
-- solaparse: un CALIENTE sin primer contacto cuenta en prioritarios y en nuevos.
-- INACTIVO cuenta igual que en Mi día: solo se excluye GANADO.
--
-- "Hoy" es el día de Argentina de p_hoy, [00:00, +1 día), y no la zona de la
-- sesión. Las visitas se comparan por fecha = p_hoy (es date).
--
-- Alcance por rol. La función corre con la service role, que no tiene RLS ni
-- auth.uid(), así que los helpers private.my_* no sirven y el alcance está
-- escrito a mano, copiando lo que ve cada rol en la app:
--   leads, DUENO       todos los de su inmobiliaria
--   leads, AGENTE      agente_id = el usuario
--   leads, ASISTENTE   agente_id = su agente y asignado_a = el asistente (el
--                      front acota al asistente por asignado_a, ver
--                      lib/alcanceLeads.ts)
--   visitas, DUENO     todas las de su inmobiliaria
--   visitas, resto     creadas por o asignadas a alguien del equipo (el agente
--                      y sus asistentes), como private.mi_equipo_ids()
--
-- Un perfil inexistente o inactivo devuelve una fila con todo en cero.
--
-- SECURITY INVOKER, stable. Solo la service role puede ejecutarla.

create or replace function public.resumen_mi_dia(
  p_user_id uuid,
  p_hoy     date
)
returns table (
  prioritarios int,
  nuevos       int,
  seguimientos int,
  visitas_hoy  int
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_rol      text;
  v_asiste_a uuid;
  v_inmo     uuid;
  v_activo   boolean;
  v_inicio   timestamptz;
  v_fin      timestamptz;
  v_equipo   uuid[];
begin
  if p_hoy is null then
    raise exception 'p_hoy es obligatorio';
  end if;

  select p.rol::text, p.asiste_a, p.inmobiliaria_id, p.activo
    into v_rol, v_asiste_a, v_inmo, v_activo
  from public.profiles p
  where p.id = p_user_id;

  if not found or v_activo is not true then
    return query select 0, 0, 0, 0;
    return;
  end if;

  v_inicio := p_hoy::timestamp at time zone 'America/Argentina/Buenos_Aires';
  v_fin    := (p_hoy + 1)::timestamp at time zone 'America/Argentina/Buenos_Aires';

  -- El agente y todos sus asistentes (private.mi_equipo_ids()).
  v_equipo := array(
    select p.id
    from public.profiles p
    where p.id = coalesce(v_asiste_a, p_user_id)
       or p.asiste_a = coalesce(v_asiste_a, p_user_id)
  );

  return query
  with pendientes as (
    select l.estado, l.fecha_primer_contacto_real, l.fecha_proximo_seguimiento
    from public.leads l
    where l.inmobiliaria_id = v_inmo
      and (
        v_rol = 'DUENO'
        or (v_rol = 'AGENTE' and l.agente_id = p_user_id)
        or (v_rol = 'ASISTENTE' and l.agente_id = v_asiste_a and l.asignado_a = p_user_id)
      )
      and l.estado is distinct from 'GANADO'::public.estado_lead
      and not exists (
        select 1
        from public.interacciones i
        where i.lead_id = l.id
          and i.fecha >= v_inicio
          and i.fecha < v_fin
      )
  ),
  de_leads as (
    select
      count(*) filter (
        where pe.estado = 'CALIENTE'::public.estado_lead
           or pe.fecha_proximo_seguimiento < v_inicio
      ) as prio,
      count(*) filter (where pe.fecha_primer_contacto_real is null) as nue,
      count(*) filter (
        where pe.fecha_proximo_seguimiento >= v_inicio
          and pe.fecha_proximo_seguimiento < v_fin
      ) as seg
    from pendientes pe
  ),
  de_visitas as (
    select count(*) as vis
    from public.visitas v
    where v.inmobiliaria_id = v_inmo
      and v.fecha = p_hoy
      and v.estado is distinct from 'CANCELADA'
      and (
        v_rol = 'DUENO'
        or v.creado_por = any (v_equipo)
        or v.asignado_a = any (v_equipo)
      )
  )
  select dl.prio::int, dl.nue::int, dl.seg::int, dv.vis::int
  from de_leads dl
  cross join de_visitas dv;
end;
$$;

revoke all on function public.resumen_mi_dia(uuid, date) from public, anon, authenticated;
grant execute on function public.resumen_mi_dia(uuid, date) to service_role;

comment on function public.resumen_mi_dia(uuid, date) is
  'Conteos de las tarjetas de Mi día (prioritarios, nuevos, seguimientos, visitas de hoy) para un usuario y un día de Argentina. Mismos criterios que src/lib/api/dashboard.ts: si cambia Mi día hay que cambiar esto. Perfil inexistente o inactivo: ceros. Sólo service role.';

commit;
