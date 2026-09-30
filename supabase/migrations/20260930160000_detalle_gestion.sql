-- ============================================================================
-- Modelo de gestión — fuente única de filas y detalle por métrica
--
-- Por qué: el panel de detalle lista lo que suma a cada anillo. Si la lista y
-- el número salieran de dos consultas con WHERE copiados, la próxima regla que
-- cambie en una sola dejaría de coincidir sin que nada falle. Acá todo sale de
-- una misma función de filas.
--
-- 0. resumen_gestion(text, date) se renombra a resumen_gestion_previo: red de
--    seguridad para comparar viejo vs nuevo y revertir. Se borra cuando se
--    valide. resumen_semana_gestion() (wrapper plpgsql) resuelve el nombre al
--    ejecutarse, así que pasa a usar la nueva sin tocarlo.
-- 1. ventana_gestion(p_periodo, p_referencia): la ventana del período, misma
--    lógica que antes ('dia', 'semana' mié-mar, 'mes'; hora argentina).
-- 2. filas_gestion(p_periodo, p_referencia): una fila por evento que suma a
--    alguna métrica, con una bandera por métrica. Reglas EXACTAMENTE las de
--    resumen_gestion (migración 20260930120000):
--    - interacciones del agente en la ventana: verde si VISITA/REUNION;
--      prelisting/prebuying si REUNION con esa categoría
--    - visitas REALIZADA sin lead asignadas al agente: verde
--    - leads del agente REFERIDO/MANUAL con fecha_ingreso en la ventana:
--      nuevo contacto
-- 3. resumen_gestion(...): misma firma y forma que antes, contando sobre (2).
-- 4. detalle_gestion(p_metrica, ...): las filas de una métrica sobre (2), con
--    LEFT JOIN a leads y propiedades para mostrarlas. Nunca se descarta una
--    fila por no poder leer el lead o la propiedad (RLS): igual cuenta.
--
-- Todas SECURITY INVOKER (respetan la RLS) y con la zona de la sesión fijada
-- en hora argentina: los casts implícitos date -> timestamptz caen a la
-- medianoche argentina.
-- ============================================================================

begin;

-- 0. Red de seguridad --------------------------------------------------------

alter function public.resumen_gestion(text, date) rename to resumen_gestion_previo;

comment on function public.resumen_gestion_previo(text, date) is
  'Versión anterior de resumen_gestion (conteo directo). Sólo para comparar y revertir; borrar al validar la de 20260930160000.';

-- 1. Ventana -----------------------------------------------------------------

create function public.ventana_gestion(p_periodo text, p_referencia date)
returns table (
  inicio       date,
  fin          date,      -- último día incluido
  dias_totales integer,
  dia_actual   integer,   -- 1-based; 0 si no empezó, dias_totales si terminó
  desde        timestamptz,
  hasta        timestamptz -- exclusivo
)
language plpgsql
stable
security invoker
set search_path = public
set timezone = 'America/Argentina/Buenos_Aires'
as $$
declare
  v_tz  constant text := 'America/Argentina/Buenos_Aires';
  v_hoy date := (now() at time zone v_tz)::date;
  v_ref date := coalesce(p_referencia, (now() at time zone v_tz)::date);
begin
  if p_periodo = 'dia' then
    inicio := v_ref;
    fin    := v_ref;
  elsif p_periodo = 'semana' then
    -- Miércoles a martes (isodow: lunes=1 ... miércoles=3)
    inicio := v_ref - ((extract(isodow from v_ref)::int - 3 + 7) % 7);
    fin    := inicio + 6;
  elsif p_periodo = 'mes' then
    inicio := date_trunc('month', v_ref)::date;
    fin    := (date_trunc('month', v_ref) + interval '1 month')::date - 1;
  else
    raise exception 'Período inválido: %. Usá ''dia'', ''semana'' o ''mes''.',
      coalesce(p_periodo, 'null')
      using errcode = '22023';  -- invalid_parameter_value
  end if;

  dias_totales := fin - inicio + 1;
  dia_actual   := least(greatest(v_hoy - inicio + 1, 0), dias_totales);
  desde        := inicio::timestamp at time zone v_tz;
  hasta        := (fin + 1)::timestamp at time zone v_tz;
  return next;
end;
$$;

comment on function public.ventana_gestion(text, date) is
  'Modelo de gestión: la ventana (día, semana mié-mar o mes) que contiene p_referencia (null = hoy), hora argentina.';

-- 2. Fuente única de filas ---------------------------------------------------

create function public.filas_gestion(p_periodo text, p_referencia date)
returns table (
  fuente            text,        -- 'interaccion' | 'visita' | 'lead'
  id                uuid,
  dia               date,        -- en hora argentina
  momento           timestamptz, -- null en visitas
  hora              time,        -- null salvo visitas
  es_verde          boolean,
  es_prelisting     boolean,
  es_prebuying      boolean,
  es_nuevo_contacto boolean,
  lead_id           uuid,
  propiedad_id      uuid,
  tipo              text,
  categoria         text,
  origen            text
)
language sql
stable
security invoker
set search_path = public
set timezone = 'America/Argentina/Buenos_Aires'
as $$
  with v as (
    select * from public.ventana_gestion(p_periodo, p_referencia)
  )
  -- Interacciones del agente. Sólo VISITA/REUNION tienen alguna bandera
  -- (prelisting y prebuying son REUNION), así que el filtro de tipo es el
  -- mismo que "alguna bandera en true".
  select
    'interaccion'::text,
    i.id,
    (i.fecha at time zone 'America/Argentina/Buenos_Aires')::date,
    i.fecha,
    null::time,
    i.tipo in ('VISITA', 'REUNION'),
    (i.tipo = 'REUNION' and i.categoria is not distinct from 'PRELISTING'),
    (i.tipo = 'REUNION' and i.categoria is not distinct from 'PREBUYING'),
    false,
    i.lead_id,
    null::uuid,
    i.tipo::text,
    i.categoria::text,
    null::text
  from interacciones i, v
  where i.agente_id = auth.uid()
    and i.fecha >= v.desde
    and i.fecha <  v.hasta
    and i.tipo in ('VISITA', 'REUNION')

  union all

  -- Visitas realizadas sin lead. Las que tienen lead ya generan una
  -- interacción VISITA al marcarse realizadas; contarlas acá las duplicaría.
  -- `visitas.fecha` ya es `date`: el día de la visita, sin huso.
  select
    'visita'::text,
    vi.id,
    vi.fecha,
    null::timestamptz,
    vi.hora,
    true,
    false,
    false,
    false,
    null::uuid,
    vi.propiedad_id,
    null::text,
    null::text,
    null::text
  from visitas vi, v
  where vi.asignado_a = auth.uid()
    and vi.estado = 'REALIZADA'
    and vi.lead_id is null
    and vi.fecha >= v.inicio
    and vi.fecha <= v.fin

  union all

  -- Contactos nuevos: leads propios o referidos que entraron en la ventana.
  select
    'lead'::text,
    l.id,
    (l.fecha_ingreso at time zone 'America/Argentina/Buenos_Aires')::date,
    l.fecha_ingreso,
    null::time,
    false,
    false,
    false,
    true,
    l.id,
    null::uuid,
    null::text,
    null::text,
    l.origen::text
  from leads l, v
  where l.agente_id = auth.uid()
    and l.origen in ('REFERIDO', 'MANUAL')
    and l.fecha_ingreso >= v.desde
    and l.fecha_ingreso <  v.hasta
$$;

comment on function public.filas_gestion(text, date) is
  'Modelo de gestión: una fila por evento que suma a alguna métrica, con sus banderas. Fuente única de resumen_gestion y detalle_gestion.';

-- 3. Resumen (misma firma y forma que antes) ---------------------------------

create function public.resumen_gestion(
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
language sql
stable
security invoker
set search_path = public
set timezone = 'America/Argentina/Buenos_Aires'
as $$
  select
    v.inicio,
    v.fin,
    v.dias_totales,
    v.dia_actual,
    c.verdes,
    c.prelistings,
    c.prebuyings,
    c.nuevos_contactos
  from public.ventana_gestion(p_periodo, p_referencia) v
  cross join (
    select
      (count(*) filter (where f.es_verde))::integer          as verdes,
      (count(*) filter (where f.es_prelisting))::integer     as prelistings,
      (count(*) filter (where f.es_prebuying))::integer      as prebuyings,
      (count(*) filter (where f.es_nuevo_contacto))::integer as nuevos_contactos
    from public.filas_gestion(p_periodo, p_referencia) f
  ) c
$$;

comment on function public.resumen_gestion(text, date) is
  'Modelo de gestión: verdes, prelistings, prebuyings y nuevos contactos del agente logueado en el día, la semana (mié-mar) o el mes que contiene p_referencia (null = hoy), hora argentina. Cuenta sobre filas_gestion.';

-- 4. Detalle por métrica -----------------------------------------------------

create function public.detalle_gestion(
  p_metrica    text,
  p_periodo    text    default 'semana',
  p_referencia date    default null,
  p_limite     integer default 500
)
returns table (
  fuente              text,
  id                  uuid,
  dia                 date,
  momento             timestamptz,
  hora                time,
  tipo                text,
  categoria           text,
  detalle             text,
  lead_id             uuid,
  lead_nombre         text,
  lead_apellido       text,
  lead_estado         text,
  lead_origen         text,
  propiedad_id        uuid,
  propiedad_direccion text,
  propiedad_zona      text,
  total_filas         integer  -- antes del limit: "Mostrando X de N"
)
language plpgsql
stable
security invoker
set search_path = public
set timezone = 'America/Argentina/Buenos_Aires'
as $$
#variable_conflict use_column
declare
  v_limite integer := least(greatest(coalesce(p_limite, 500), 1), 500);
begin
  if p_metrica is null or p_metrica not in ('verdes', 'pre', 'nuevos') then
    raise exception 'Métrica inválida: %. Usá ''verdes'', ''pre'' o ''nuevos''.',
      coalesce(p_metrica, 'null')
      using errcode = '22023';  -- invalid_parameter_value
  end if;

  -- LEFT JOIN siempre: si la RLS no deja leer el lead o la propiedad (una
  -- visita sin lead sobre una propiedad de otro agente, un lead reasignado),
  -- la fila sale igual con esos datos en null. Descartarla haría que la lista
  -- no coincida con el anillo.
  return query
  select
    f.fuente,
    f.id,
    f.dia,
    f.momento,
    f.hora,
    f.tipo,
    f.categoria,
    i.detalle::text,
    f.lead_id,
    l.nombre::text,
    l.apellido::text,
    l.estado::text,
    coalesce(l.origen::text, f.origen),
    f.propiedad_id,
    p.direccion::text,
    p.zona::text,
    (count(*) over ())::integer
  from public.filas_gestion(p_periodo, p_referencia) f
  left join interacciones i on f.fuente = 'interaccion' and i.id = f.id
  left join leads         l on l.id = f.lead_id
  left join propiedades   p on p.id = f.propiedad_id
  where case p_metrica
          when 'verdes' then f.es_verde
          when 'pre'    then f.es_prelisting or f.es_prebuying
          else               f.es_nuevo_contacto
        end
  order by f.dia desc, f.momento desc nulls last, f.hora desc nulls last, f.id
  limit v_limite;
end;
$$;

comment on function public.detalle_gestion(text, text, date, integer) is
  'Modelo de gestión: las filas que suman a una métrica (verdes | pre | nuevos) en el período, con lead y propiedad por LEFT JOIN. total_filas es el total antes del límite (1..500).';

-- Permisos --------------------------------------------------------------------

revoke all on function public.ventana_gestion(text, date) from public, anon;
grant execute on function public.ventana_gestion(text, date) to authenticated;

revoke all on function public.filas_gestion(text, date) from public, anon;
grant execute on function public.filas_gestion(text, date) to authenticated;

revoke all on function public.resumen_gestion(text, date) from public, anon;
grant execute on function public.resumen_gestion(text, date) to authenticated;

revoke all on function public.detalle_gestion(text, text, date, integer) from public, anon;
grant execute on function public.detalle_gestion(text, text, date, integer) to authenticated;

commit;
