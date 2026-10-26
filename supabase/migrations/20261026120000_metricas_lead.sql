-- YA APLICADA en producción el 26/10/2026 (pegada en el SQL Editor). No volver a ejecutar.

begin;

create or replace function public.metricas_lead(p_lead_id uuid)
returns table (
  interacciones_total  int,
  contactos_reales     int,
  llamadas             int,
  whatsapps            int,
  emails               int,
  reuniones            int,
  visitas_realizadas   int,
  visitas_agendadas    int,
  visitas_canceladas   int,
  proxima_visita_fecha date,
  proxima_visita_hora  time
)
language sql
stable
security definer
set search_path = ''
as $$
  with lead as (
    select l.id, l.inmobiliaria_id
    from public.leads l
    where l.id = p_lead_id
      and l.inmobiliaria_id = private.my_inmobiliaria_id()
      and (
        private.my_rol() = 'DUENO'
        or l.agente_id = auth.uid()
        or (private.my_rol() = 'ASISTENTE' and l.agente_id = private.my_asiste_a())
      )
  ),
  inter as (
    select
      count(*)::int                                                      as total,
      count(*) filter (where public.es_contacto_real(i.tipo))::int       as reales,
      count(*) filter (where i.tipo::text = 'LLAMADA')::int              as llamadas,
      count(*) filter (where i.tipo::text = 'WHATSAPP')::int             as whatsapps,
      count(*) filter (where i.tipo::text = 'EMAIL')::int                as emails,
      count(*) filter (where i.tipo::text = 'REUNION')::int              as reuniones
    from public.interacciones i
    join lead on lead.id = i.lead_id
  ),
  vis as (
    select
      count(*) filter (where v.estado = 'REALIZADA')::int as realizadas,
      count(*) filter (where v.estado = 'AGENDADA')::int  as agendadas,
      count(*) filter (where v.estado = 'CANCELADA')::int as canceladas
    from public.visitas v
    join lead on lead.id = v.lead_id and lead.inmobiliaria_id = v.inmobiliaria_id
  ),
  prox as (
    select v.fecha::date as fecha, v.hora::time as hora
    from public.visitas v
    join lead on lead.id = v.lead_id and lead.inmobiliaria_id = v.inmobiliaria_id
    where v.estado = 'AGENDADA'
      and v.fecha::date >= (now() at time zone 'America/Argentina/Buenos_Aires')::date
    order by v.fecha::date, v.hora::time nulls last
    limit 1
  )
  select inter.total, inter.reales, inter.llamadas, inter.whatsapps,
         inter.emails, inter.reuniones,
         vis.realizadas, vis.agendadas, vis.canceladas,
         prox.fecha, prox.hora
  from lead
  cross join inter
  cross join vis
  left join prox on true;
$$;

revoke all on function public.metricas_lead(uuid) from public, anon;
grant execute on function public.metricas_lead(uuid) to authenticated;

commit;
