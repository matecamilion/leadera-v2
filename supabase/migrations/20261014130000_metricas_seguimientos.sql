-- Métricas de seguimientos del reporte semanal, sobre el historial nuevo.
--
-- Desde 20261014120000_cumplir_seguimiento, una interacción que cumple el
-- seguimiento del lead lo vacía (o lo reemplaza por el próximo) y deja la
-- fecha cumplida en `interacciones.seguimiento_cumplido_fecha`. La fórmula
-- vieja de cumplidos miraba `leads.fecha_proximo_seguimiento`, que ahora ya no
-- conserva lo cumplido: contaría casi cero.
--
-- Cambian solo esas dos subconsultas. Misma firma, mismo retorno, mismo
-- search_path y mismos permisos que 20260921200000_metricas_reporte_semanal.
--
-- TODAS las fechas se recortan en hora argentina, no en UTC: una interacción
-- registrada un domingo a las 21:00 de Buenos Aires es las 00:00 del lunes en
-- UTC, y con `::date` pelado caería en la semana siguiente, moviendo el número
-- justo en el borde de la semana que el reporte cuenta.
--
-- Idempotente.

begin;

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
