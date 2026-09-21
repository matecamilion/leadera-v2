-- Métricas del reporte semanal, en una sola consulta por agente y por semana.
--
-- Va en la base y no en la Edge Function porque si no serían ~12 requests por
-- agente (seis métricas × dos semanas) para devolver seis números.
--
-- TODAS las fechas se recortan en hora argentina, no en UTC: una interacción
-- registrada un domingo a las 21:00 de Buenos Aires es las 00:00 del lunes en
-- UTC, y con `::date` pelado caería en la semana siguiente, moviendo el número
-- justo en el borde de la semana que el reporte cuenta.
--
-- Idempotente.

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

    -- Seguimientos cumplidos: leads cuyo seguimiento caía en la semana y que
    -- fueron contactados en esa fecha o después.
    --
    -- Subcuenta a propósito, y conviene saberlo antes de leer el número: la
    -- base guarda UN solo `fecha_proximo_seguimiento` por lead, sin historial.
    -- Si el agente cumplió el seguimiento y agendó el siguiente, la fecha vieja
    -- ya no existe y ese cumplimiento no se puede contar. Para que el número
    -- sea exacto hace falta una tabla de historial de seguimientos.
    (select count(*)
       from leads l
      where l.agente_id = p_agente_id
        and l.fecha_proximo_seguimiento is not null
        and (l.fecha_proximo_seguimiento at time zone 'America/Argentina/Buenos_Aires')::date
            between p_desde and p_hasta
        and l.fecha_ultimo_contacto_real >= l.fecha_proximo_seguimiento)::integer,

    -- Seguimientos vencidos al cierre de la semana: mismo criterio que usa
    -- `soloPrioritarios` en la app —seguimiento con fecha pasada— para que el
    -- mail y la pantalla no digan cosas distintas.
    (select count(*)
       from leads l
      where l.agente_id = p_agente_id
        and l.fecha_proximo_seguimiento is not null
        and (l.fecha_proximo_seguimiento at time zone 'America/Argentina/Buenos_Aires')::date <= p_hasta
        and (l.fecha_ultimo_contacto_real is null
             or l.fecha_ultimo_contacto_real < l.fecha_proximo_seguimiento))::integer,

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
