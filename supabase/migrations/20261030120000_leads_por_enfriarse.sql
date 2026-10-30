-- YA APLICADA en producción el 30/10/2026 (pegada en el SQL Editor). No volver a ejecutar.

begin;

create or replace function public.leads_por_enfriarse(
  p_asignado_a uuid default null,
  p_dias_aviso int  default 21,
  p_limite     int  default 20
)
returns table (
  lead_id uuid,
  nombre text,
  apellido text,
  estado public.estado_lead,
  ultimo_contacto timestamptz,
  dias_sin_contacto int,
  importado boolean,
  total bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    l.id,
    l.nombre,
    l.apellido,
    l.estado,
    u.ultimo,
    extract(day from now() - u.ultimo)::int,
    (l.importacion_id is not null or l.origen = 'IMPORTACION'),
    count(*) over ()
  from leads l
  cross join lateral (
    select greatest(
      (select max(i.fecha)::timestamptz
         from interacciones i
        where i.lead_id = l.id
          and es_contacto_real(i.tipo)),
      case
        when l.importacion_id is not null or l.origen = 'IMPORTACION'
        then l.fecha_ultimo_contacto_real::timestamptz
      end
    ) as ultimo
  ) u
  where l.estado is distinct from 'GANADO'
    and l.estado is distinct from 'INACTIVO'
    and l.fecha_proximo_seguimiento is null
    and (p_asignado_a is null or l.asignado_a = p_asignado_a)
    and u.ultimo is not null
    and u.ultimo <= now() - make_interval(days => p_dias_aviso)
  order by l.estado asc nulls last, u.ultimo asc
  limit p_limite;
$$;

revoke all on function public.leads_por_enfriarse(uuid, int, int) from public, anon;
grant execute on function public.leads_por_enfriarse(uuid, int, int) to authenticated;

commit;
