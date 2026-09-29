-- ============================================================================
-- Modelo de gestión — Etapa 2
--
-- Por qué: medir prelistings y prebuyings (mínimo 3 por semana) y clasificar
-- las reuniones según las actividades verdes del modelo.
--
-- 1. interacciones.categoria (text + CHECK, nullable). Solo aplica a
--    tipo = 'REUNION'. Si es null, la interacción funciona igual que antes.
-- 2. resumen_semana_gestion() suma las columnas prelistings y prebuyings.
--    Cambia la forma del retorno, así que se hace drop + create
--    (create or replace no permite cambiar las columnas de salida).
-- ============================================================================

begin;

alter table public.interacciones
  add column if not exists categoria text;

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conname = 'interacciones_categoria_valores') then
    alter table public.interacciones
      add constraint interacciones_categoria_valores
      check (categoria is null or categoria in (
        'PROSPECCION', 'PRELISTING', 'PREBUYING', 'NEGOCIACION',
        'FIRMA', 'POSTVENTA', 'PRESENTACION_ACM'
      ));
  end if;

  if not exists (select 1 from pg_constraint
                  where conname = 'interacciones_categoria_solo_reunion') then
    alter table public.interacciones
      add constraint interacciones_categoria_solo_reunion
      check (categoria is null or tipo = 'REUNION');
  end if;
end $$;

comment on column public.interacciones.categoria is
  'Modelo de gestión: tipo de reunión (solo cuando tipo = REUNION). Null = sin clasificar.';

-- Por si interacciones usa grants por columna (inofensivo si son por tabla)
grant insert (categoria), update (categoria) on public.interacciones to authenticated;

drop function if exists public.resumen_semana_gestion();

create function public.resumen_semana_gestion()
returns table (
  semana_inicio    date,
  semana_fin       date,
  verdes           integer,
  prelistings      integer,
  prebuyings       integer,
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
  -- Semana de miércoles a martes (isodow: lunes=1 ... miércoles=3)
  v_inicio := v_hoy - ((extract(isodow from v_hoy)::int - 3 + 7) % 7);
  v_desde  := v_inicio::timestamp at time zone v_tz;
  v_hasta  := (v_inicio + 7)::timestamp at time zone v_tz;

  return query
  with sem as (
    select i.tipo, i.categoria
      from interacciones i
     where i.agente_id = v_uid
       and i.fecha >= v_desde
       and i.fecha <  v_hasta
  )
  select
    v_inicio,
    v_inicio + 6,
    (
      (select count(*) from sem where sem.tipo in ('VISITA', 'REUNION'))
      +
      (select count(*)
         from visitas v
        where v.asignado_a = v_uid
          and v.estado = 'REALIZADA'
          and v.lead_id is null
          and v.fecha >= v_inicio
          and v.fecha <  v_inicio + 7)
    )::integer,
    (select count(*) from sem
      where sem.tipo = 'REUNION' and sem.categoria = 'PRELISTING')::integer,
    (select count(*) from sem
      where sem.tipo = 'REUNION' and sem.categoria = 'PREBUYING')::integer,
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
