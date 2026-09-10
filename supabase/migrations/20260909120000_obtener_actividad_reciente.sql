-- Actividad reciente del agente: un solo feed con las cinco cosas que deja
-- hechas a lo largo del día, ordenadas por cuándo pasaron.
--
-- La función NO arma texto de presentación. Devuelve el enum crudo en
-- `subtipo` y el cliente lo traduce con `etiquetaTipoInteraccion()` y
-- `etiquetaTipoOperacion()`, que ya existen en TS y son las que usa el resto
-- de la app. Duplicar esas tablas de etiquetas acá dejaría dos fuentes de
-- verdad que se desincronizan en cuanto se agrega un valor al enum.
--
-- Sin SECURITY DEFINER: corre como el invocador, así que las RLS de cada
-- tabla siguen aplicando y el `auth.uid()` de cada rama es sólo un filtro de
-- "lo mío", no el control de acceso.

create or replace function public.obtener_actividad_reciente(p_limite int default 20)
returns table (
  tipo         text,
  subtipo      text,
  titulo       text,
  descripcion  text,
  fecha        timestamptz,
  entidad_tipo text,
  entidad_id   uuid,
  origen_id    uuid
)
language sql
stable
set search_path = public
as $$
  -- El union va adentro de un subselect: los nombres de las columnas de
  -- salida (`fecha`, `tipo`) también son visibles como variables del RETURNS
  -- TABLE, y un `order by fecha` pelado queda ambiguo. Calificado por el
  -- alias `e` no hay duda de a qué se refiere.
  select e.tipo, e.subtipo, e.titulo, e.descripcion, e.fecha,
         e.entidad_tipo, e.entidad_id, e.origen_id
  from (
    -- Interacciones. El nombre del lead viaja en `titulo` y el tipo crudo en
    -- `subtipo`; el cliente arma "Llamada a Juan Pérez".
    select 'INTERACCION'::text                                     as tipo,
           i.tipo::text                                            as subtipo,
           (l.nombre || coalesce(' ' || l.apellido, ''))::text      as titulo,
           i.detalle::text                                         as descripcion,
           i.fecha                                                 as fecha,
           'LEAD'::text                                            as entidad_tipo,
           i.lead_id                                               as entidad_id,
           i.id                                                    as origen_id
    from interacciones i
    join leads l on l.id = i.lead_id
    where i.agente_id = auth.uid()

    union all

    -- Tareas completadas. Una tarea puede colgar de varias entidades a la vez;
    -- se linkea a la más específica para el agente, en ese orden.
    select 'TAREA_COMPLETADA'::text,
           null::text,
           t.titulo::text,
           t.descripcion::text,
           t.completada_en,
           case when t.lead_id      is not null then 'LEAD'
                when t.operacion_id is not null then 'OPERACION'
                when t.propiedad_id is not null then 'PROPIEDAD'
                else null end::text,
           coalesce(t.lead_id, t.operacion_id, t.propiedad_id),
           t.id
    from tareas t
    where t.completada_en is not null
      and (t.asignado_a = auth.uid() or t.creado_por = auth.uid())

    union all

    -- Visitas realizadas SIN lead. Las que sí tienen lead ya entraron por la
    -- primera rama: `marcarRealizada()` les deja una interacción de tipo
    -- VISITA, y contarlas de los dos lados las duplicaría en el feed.
    --
    -- La fecha replica `momentoDeLaInteraccion()` de src/lib/api/visitas.ts:
    -- fecha + hora pactadas leídas como hora de pared de Buenos Aires —el TS
    -- las arma con `new Date(a, m, d, hh, mm)`, que usa el huso del navegador—
    -- y acotadas a `now()`, porque una visita marcada antes de tiempo tiene la
    -- agendada en el futuro y un evento futuro no es actividad reciente.
    select 'VISITA_REALIZADA'::text,
           null::text,
           'Visita a la propiedad realizada'::text,
           null::text,
           least(
             (v.fecha + coalesce(v.hora, '00:00'::time))
               at time zone 'America/Argentina/Buenos_Aires',
             now()
           ),
           'PROPIEDAD'::text,
           v.propiedad_id,
           v.id
    from visitas v
    where v.estado = 'REALIZADA'
      and v.lead_id is null
      and (v.asignado_a = auth.uid() or v.creado_por = auth.uid())

    union all

    -- Propiedades creadas. Las de `agente_id` nulo son de la inmobiliaria y no
    -- de nadie en particular: no son actividad de este agente.
    select 'PROPIEDAD_CREADA'::text,
           null::text,
           p.direccion::text,
           null::text,
           p.created_at,
           'PROPIEDAD'::text,
           p.id,
           p.id
    from propiedades p
    where p.agente_id = auth.uid()

    union all

    -- Operaciones creadas. `titulo` es opcional en la tabla; cuando falta el
    -- cliente cae al `subtipo` traducido, igual que hace ListaOperacionesEnCurso.
    select 'OPERACION_CREADA'::text,
           o.tipo::text,
           o.titulo::text,
           null::text,
           o.created_at,
           'OPERACION'::text,
           o.id,
           o.id
    from operaciones o
    where o.agente_id = auth.uid()
  ) e
  order by e.fecha desc
  limit p_limite
$$;

grant execute on function public.obtener_actividad_reciente(int) to authenticated;
