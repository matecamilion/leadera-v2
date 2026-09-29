-- ============================================================================
-- Modelo de gestión — Etapa 1
--
-- Por qué: sumamos el "Modelo de gestión" (actividades verdes semanales,
-- nuevos contactos) detrás de un flag por inmobiliaria, apagado por defecto.
-- Ninguna cuenta ve cambios hasta que se activa a mano.
--
-- 1. inmobiliarias.modelo_gestion_activo: flag de la funcionalidad. El cliente
--    lo lee con la policy existente "usuarios pueden ver su propia inmobiliaria".
-- 2. resumen_semana_gestion(): métricas de la semana en curso del agente
--    logueado. La semana va de miércoles a martes (inclusive), hora argentina.
--    - verdes = interacciones VISITA/REUNION del agente
--             + visitas REALIZADA sin lead asignadas al agente
--      (las visitas con lead ya generan una interacción VISITA al marcarse
--       realizadas; contarlas de nuevo las duplicaría)
--    - nuevos_contactos = leads del agente con origen REFERIDO o MANUAL
--      creados en la semana
--    SECURITY INVOKER: respeta la RLS de cada tabla.
-- ============================================================================

begin;

alter table public.inmobiliarias
  add column if not exists modelo_gestion_activo boolean not null default false;

comment on column public.inmobiliarias.modelo_gestion_activo is
  'Activa el Modelo de gestión (actividades verdes, nuevos contactos). Default false.';

create or replace function public.resumen_semana_gestion()
returns table (
  semana_inicio    date,
  semana_fin       date,
  verdes           integer,
  nuevos_contactos integer
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_tz     constant text := 'America/Argentina/Buenos_Aires';
  v_uid    uuid := auth.uid();
  v_hoy    date := (now() at time zone v_tz)::date;
  v_inicio date;
  v_desde  timestamptz;
  v_hasta  timestamptz;
begin
  -- Días desde el último miércoles (isodow: lunes=1 ... miércoles=3)
  v_inicio := v_hoy - ((extract(isodow from v_hoy)::int - 3 + 7) % 7);
  v_desde  := v_inicio::timestamp at time zone v_tz;
  v_hasta  := (v_inicio + 7)::timestamp at time zone v_tz;

  return query
  select
    v_inicio,
    v_inicio + 6,
    (
      (select count(*)
         from interacciones i
        where i.agente_id = v_uid
          and i.tipo in ('VISITA', 'REUNION')
          and i.fecha >= v_desde
          and i.fecha <  v_hasta)
      +
      (select count(*)
         from visitas v
        where v.asignado_a = v_uid
          and v.estado = 'REALIZADA'
          and v.lead_id is null
          and v.fecha >= v_inicio
          and v.fecha <  v_inicio + 7)
    )::integer,
    (select count(*)
       from leads l
      where l.agente_id = v_uid
        and l.origen in ('REFERIDO', 'MANUAL')
        and l.created_at >= v_desde
        and l.created_at <  v_hasta)::integer;
end;
$$;

revoke all on function public.resumen_semana_gestion() from public, anon;
grant execute on function public.resumen_semana_gestion() to authenticated;

commit;
