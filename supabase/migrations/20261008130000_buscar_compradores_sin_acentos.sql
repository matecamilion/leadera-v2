-- ============================================================================
-- buscar_compradores: la zona se compara sin acentos
--
-- Por qué: "Güemes" en la búsqueda y "Guemes" tipeado al ofrecer no
-- coincidían. Ahora los dos lados pasan por lower + unaccent antes del ilike.
--
-- Idéntica a la versión de 20261008120000_buscar_compradores.sql salvo esa
-- comparación. Mismos parámetros, retorno, SECURITY INVOKER, search_path
-- vacío, comment y permisos.
-- ============================================================================

begin;

create extension if not exists unaccent with schema extensions;

create or replace function public.buscar_compradores(
  p_tipo_operacion text                  default null,
  p_precio         numeric               default null,
  p_moneda         text                  default 'USD',
  p_tipo_propiedad public.tipo_propiedad default null,
  p_zona           text                  default null,
  p_ambientes      integer               default null,
  p_m2             numeric               default null,
  p_banos          integer               default null,
  p_cocheras       integer               default null,
  p_expensas       numeric               default null
)
returns table (
  busqueda_id          uuid,
  lead_id              uuid,
  nombre               text,
  apellido             text,
  telefono             text,
  estado               public.estado_lead,
  tipo_operacion       text,
  tipo_propiedad       public.tipo_propiedad,
  zona                 text,
  precio_min           numeric,
  precio_max           numeric,
  moneda               text,
  ambientes_min        integer,
  busqueda_created_at  timestamptz,
  criterios_evaluados  integer,
  criterios_cumplidos  integer,
  score_pct            integer,
  dif_presupuesto_pct  numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    b.id,
    l.id,
    l.nombre::text,
    l.apellido::text,
    l.telefono::text,
    l.estado,
    b.tipo_operacion::text,
    b.tipo_propiedad,
    b.zona::text,
    b.precio_min::numeric,
    b.precio_max::numeric,
    b.moneda::text,
    b.ambientes_min::integer,
    b.created_at::timestamptz as busqueda_created_at,
    s.evaluados,
    s.cumplidos,
    case
      when s.evaluados = 0 then null
      else round(100.0 * s.cumplidos / s.evaluados)::integer
    end as score_pct,
    -- Positivo: el precio pasa el máximo del comprador; negativo: queda abajo.
    case
      when p_precio is null or b.precio_max is null or b.precio_max = 0 then null
      else round(100 * (p_precio - b.precio_max) / b.precio_max, 1)
    end
  from public.busquedas b
  join public.leads l on l.id = b.lead_id
  -- Zona vacía o en blanco cuenta como "no vino": '%' || '' || '%' matchearía todo.
  -- Los dos lados sin acentos y en minúscula: "Güemes" y "guemes" son la misma.
  -- Forma de dos argumentos con el diccionario calificado: con search_path = ''
  -- la de un argumento no encuentra el diccionario y falla.
  cross join lateral (
    select
      lower(extensions.unaccent('extensions.unaccent'::regdictionary, nullif(btrim(p_zona), ''))) as ofrecida,
      lower(extensions.unaccent('extensions.unaccent'::regdictionary, nullif(btrim(b.zona), ''))) as buscada
  ) z
  cross join lateral (
    select
      count(*) filter (where c.evaluado)::integer                 as evaluados,
      count(*) filter (where c.evaluado and c.cumple)::integer    as cumplidos
    from (
      values
        (
          z.ofrecida is not null and z.buscada is not null,
          z.ofrecida ilike '%' || z.buscada || '%' or z.buscada ilike '%' || z.ofrecida || '%'
        ),
        (p_ambientes is not null and b.ambientes_min is not null, p_ambientes >= b.ambientes_min),
        (p_m2        is not null and b.m2_min        is not null, p_m2        >= b.m2_min),
        (p_banos     is not null and b.banos_min     is not null, p_banos     >= b.banos_min),
        (p_cocheras  is not null and b.cocheras_min  is not null, p_cocheras  >= b.cocheras_min),
        (p_expensas  is not null and b.expensas_max  is not null, p_expensas  <= b.expensas_max)
    ) as c (evaluado, cumple)
  ) s
  where b.activa
    and l.estado is distinct from 'GANADO'
    and (
      p_tipo_operacion is null
      or b.tipo_operacion is null
      or b.tipo_operacion = p_tipo_operacion
    )
    and (
      p_precio is null
      or (
        b.moneda = coalesce(p_moneda, 'USD')
        and p_precio >= coalesce(b.precio_min, 0) * 0.9
        -- precio_max vacío = sin techo (equivale a coalesce(…, infinito) * 1.1).
        and (b.precio_max is null or p_precio <= b.precio_max * 1.1)
      )
    )
    and (
      p_tipo_propiedad is null
      or b.tipo_propiedad is null
      or b.tipo_propiedad = p_tipo_propiedad
    )
  order by score_pct desc nulls last, busqueda_created_at desc;
$$;

comment on function public.buscar_compradores(
  text, numeric, text, public.tipo_propiedad, text, integer, numeric, integer, integer, numeric
) is
  'Búsquedas activas (de leads no GANADO) donde encaja algo que se ofrece. Filtra por operación, precio ±10 % en la misma moneda y tipo; puntúa zona, ambientes, m2, baños, cocheras y expensas. SECURITY INVOKER: respeta la RLS de leads y busquedas.';

revoke all on function public.buscar_compradores(
  text, numeric, text, public.tipo_propiedad, text, integer, numeric, integer, integer, numeric
) from public, anon;

grant execute on function public.buscar_compradores(
  text, numeric, text, public.tipo_propiedad, text, integer, numeric, integer, integer, numeric
) to authenticated;

commit;
