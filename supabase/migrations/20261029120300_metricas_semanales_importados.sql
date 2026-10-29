-- ============================================================================
-- metricas_semanales: los leads importados no cuentan como "nuevos"
--
-- Qué hace:
--   "Fue importado" pasa a decidirse por leads.importacion_id y no solo por
--   origen = 'IMPORTACION': el origen de un lead importado ahora es su fuente
--   real (ZONAPROP, WHATSAPP, etc.). Se conserva `origen <> 'IMPORTACION'` para
--   los leads importados antes de que existiera importacion_id.
--
-- Es idéntica a la de 20261027120100_importar_leads.sql (sección A) salvo UNA
-- línea: en el subselect de `nuevos`, `and l.importacion_id is null`.
--
-- Revisadas y sin cambio: las funciones de gestión (resumen_gestion*,
-- detalle_gestion, ventana_lunes_domingo) filtran con la lista blanca
-- origen in ('REFERIDO', 'MANUAL'), y la importación ya no puede asignar esos
-- dos orígenes. admin_metricas_inmobiliaria cuenta uso del producto
-- (created_at) a propósito, importaciones incluidas.
--
-- Requiere 20261029120100_leads_importacion_id.sql (una función SQL valida las
-- columnas al crearse).
-- ============================================================================

begin;

do $$
begin
  if not exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'leads'
       and column_name = 'importacion_id'
  ) then
    raise exception
      'ABORTADO: falta leads.importacion_id. Correr antes 20261029120100_leads_importacion_id.sql.';
  end if;
end
$$;

create or replace function public.metricas_semanales(
  p_agente_id uuid,
  p_desde date,
  p_hasta date
)
returns table (
  contactados integer,
  nuevos integer,
  visitas integer,
  seguimientos_cumplidos integer,
  seguimientos_vencidos integer,
  operaciones integer
)
language sql
stable
set search_path = public
as $$
  select
    -- Leads distintos con al menos una interacción en la semana. Distintos y
    -- no interacciones: tres llamadas al mismo lead son un lead contactado.
    (select count(distinct i.lead_id)
       from interacciones i
      where i.agente_id = p_agente_id
        and (i.fecha at time zone 'America/Argentina/Buenos_Aires')::date
            between p_desde and p_hasta)::integer,

    -- Leads que entraron a la cartera del agente en la semana.
    (select count(*)
       from leads l
      where l.agente_id = p_agente_id
        and l.origen <> 'IMPORTACION'
        and l.importacion_id is null
        and (l.fecha_ingreso at time zone 'America/Argentina/Buenos_Aires')::date
            between p_desde and p_hasta)::integer,

    -- Visitas efectivamente realizadas (no las agendadas ni las canceladas).
    -- `visitas.fecha` ya es `date`: es el día de la visita, sin huso.
    (select count(*)
       from visitas v
      where v.asignado_a = p_agente_id
        and v.estado = 'REALIZADA'
        and v.fecha between p_desde and p_hasta)::integer,

    -- Seguimientos cumplidos: interacciones que cumplieron un seguimiento,
    -- registradas en la semana. La atribución es por el agente dueño del
    -- lead, no por quien cargó la interacción: el seguimiento es del lead.
    (select count(*)
       from interacciones i
       join leads l on l.id = i.lead_id
      where l.agente_id = p_agente_id
        and i.seguimiento_cumplido_fecha is not null
        and (i.fecha at time zone 'America/Argentina/Buenos_Aires')::date
            between p_desde and p_hasta)::integer,

    -- Seguimientos vencidos al cierre de la semana: seguimiento con fecha
    -- pasada, sin leads GANADO —los de estado null cuentan—, mismo criterio
    -- que `soloPrioritarios` y `sinGanados` en la app para que el mail y la
    -- pantalla no digan cosas distintas. Un seguimiento cumplido ya no tiene
    -- fecha, así que no hace falta mirar el último contacto.
    (select count(*)
       from leads l
      where l.agente_id = p_agente_id
        and l.fecha_proximo_seguimiento is not null
        and (l.fecha_proximo_seguimiento at time zone 'America/Argentina/Buenos_Aires')::date <= p_hasta
        and (l.estado is null or l.estado <> 'GANADO'))::integer,

    -- Operaciones que se movieron en la semana, sin contar las canceladas.
    -- `updated_at` es lo único que hay: tampoco existe historial de estados,
    -- así que "avanzó" es "alguien la tocó y no terminó cancelada".
    (select count(*)
       from operaciones o
      where o.agente_id = p_agente_id
        and (o.updated_at at time zone 'America/Argentina/Buenos_Aires')::date
            between p_desde and p_hasta
        and o.estado <> 'CANCELADA')::integer;
$$;

-- Sólo la corrida del reporte la llama, con service_role. Recibe un agente por
-- parámetro, así que expuesta a la API dejaría leer la actividad de cualquiera.
revoke all on function public.metricas_semanales(uuid, date, date) from public, anon, authenticated;
grant execute on function public.metricas_semanales(uuid, date, date) to service_role;

commit;
