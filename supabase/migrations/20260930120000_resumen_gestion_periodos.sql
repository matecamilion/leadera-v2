-- ============================================================================
-- Modelo de gestión — resumen por período (día / semana / mes)
--
-- Por qué: la tarjeta de Mi día sólo sabe de la semana en curso. Para sumar
-- las vistas Día y Mes hace falta el mismo conteo sobre otras ventanas.
--
-- 1. resumen_gestion(p_periodo, p_referencia): mismas reglas de conteo que
--    resumen_semana_gestion(), sobre la ventana que se pida, en hora argentina.
--    - 'dia':    [ref, ref + 1)
--    - 'semana': miércoles a martes (la que contiene a ref), igual que hoy
--    - 'mes':    del 1 al último día del mes calendario de ref
--    - p_referencia null = hoy en Argentina
--    - dias_totales: días de la ventana (1, 7, 28..31)
--    - dia_actual:   qué día de la ventana es hoy (1-based). 0 si la ventana
--                    todavía no empezó, dias_totales si ya terminó.
--    CAMBIO de regla: nuevos_contactos filtra por leads.fecha_ingreso (antes
--    created_at), igual que el reporte semanal y Estadísticas.
--
--    `set timezone` fija la zona de la sesión mientras corre la función: si
--    alguna columna de fecha fuera `date` y no `timestamptz`, su cast implícito
--    a timestamptz cae a la medianoche argentina y no a la de UTC. Con
--    timestamptz no cambia nada.
--
-- 2. resumen_semana_gestion() queda como wrapper de resumen_gestion('semana'),
--    con la misma forma de retorno que antes (el front no cambia). Como la
--    forma no cambia alcanza con create or replace.
--
-- SECURITY INVOKER: respeta la RLS de cada tabla.
-- ============================================================================

begin;

create or replace function public.resumen_gestion(
  p_periodo    text default 'semana',
  p_referencia date default null
)
returns table (
  periodo_inicio   date,
  periodo_fin      date,
  dias_totales     integer,
  dia_actual       integer,
  verdes           integer,
  prelistings      integer,
  prebuyings       integer,
  nuevos_contactos integer
)
language plpgsql
stable
security invoker
set search_path = public
set timezone = 'America/Argentina/Buenos_Aires'
as $$
declare
  v_tz     constant text := 'America/Argentina/Buenos_Aires';
  v_uid    uuid := auth.uid();
  v_hoy    date := (now() at time zone v_tz)::date;
  v_ref    date := coalesce(p_referencia, (now() at time zone v_tz)::date);
  v_inicio date;
  v_fin    date;      -- último día incluido
  v_dias   integer;
  v_desde  timestamptz;
  v_hasta  timestamptz;
begin
  if p_periodo = 'dia' then
    v_inicio := v_ref;
    v_fin    := v_ref;
  elsif p_periodo = 'semana' then
    -- Miércoles a martes (isodow: lunes=1 ... miércoles=3)
    v_inicio := v_ref - ((extract(isodow from v_ref)::int - 3 + 7) % 7);
    v_fin    := v_inicio + 6;
  elsif p_periodo = 'mes' then
    v_inicio := date_trunc('month', v_ref)::date;
    v_fin    := (date_trunc('month', v_ref) + interval '1 month')::date - 1;
  else
    raise exception 'Período inválido: %. Usá ''dia'', ''semana'' o ''mes''.',
      coalesce(p_periodo, 'null')
      using errcode = '22023';  -- invalid_parameter_value
  end if;

  v_dias  := v_fin - v_inicio + 1;
  v_desde := v_inicio::timestamp at time zone v_tz;
  v_hasta := (v_fin + 1)::timestamp at time zone v_tz;

  return query
  with ventana as (
    select i.tipo, i.categoria
      from interacciones i
     where i.agente_id = v_uid
       and i.fecha >= v_desde
       and i.fecha <  v_hasta
  )
  select
    v_inicio,
    v_fin,
    v_dias,
    least(greatest(v_hoy - v_inicio + 1, 0), v_dias),
    (
      (select count(*) from ventana where ventana.tipo in ('VISITA', 'REUNION'))
      +
      -- Las visitas con lead ya generan una interacción VISITA al marcarse
      -- realizadas; contarlas de nuevo las duplicaría.
      (select count(*)
         from visitas v
        where v.asignado_a = v_uid
          and v.estado = 'REALIZADA'
          and v.lead_id is null
          and v.fecha >= v_inicio
          and v.fecha <= v_fin)
    )::integer,
    (select count(*) from ventana
      where ventana.tipo = 'REUNION' and ventana.categoria = 'PRELISTING')::integer,
    (select count(*) from ventana
      where ventana.tipo = 'REUNION' and ventana.categoria = 'PREBUYING')::integer,
    (select count(*)
       from leads l
      where l.agente_id = v_uid
        and l.origen in ('REFERIDO', 'MANUAL')
        and l.fecha_ingreso >= v_desde
        and l.fecha_ingreso <  v_hasta)::integer;
end;
$$;

comment on function public.resumen_gestion(text, date) is
  'Modelo de gestión: verdes, prelistings, prebuyings y nuevos contactos del agente logueado en el día, la semana (mié-mar) o el mes que contiene p_referencia (null = hoy), hora argentina.';

-- Misma forma de retorno que antes: create or replace alcanza.
create or replace function public.resumen_semana_gestion()
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
begin
  return query
  select r.periodo_inicio, r.periodo_fin, r.verdes, r.prelistings,
         r.prebuyings, r.nuevos_contactos
    from public.resumen_gestion('semana') r;
end;
$$;

revoke all on function public.resumen_gestion(text, date) from public, anon;
grant execute on function public.resumen_gestion(text, date) to authenticated;

revoke all on function public.resumen_semana_gestion() from public, anon;
grant execute on function public.resumen_semana_gestion() to authenticated;

commit;
