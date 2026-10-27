-- ============================================================================
-- Importar leads desde Excel/CSV
--
-- Qué hace:
--   A) metricas_semanales: los leads con origen IMPORTACION no cuentan como
--      "nuevos" del reporte semanal (una importación masiva inflaría el número
--      y el cambio contra la semana anterior). Es la única función de gestión
--      que no filtraba por origen: las de gestión ya usan la lista blanca
--      origen in ('REFERIDO', 'MANUAL').
--   B) importar_leads(p_filas jsonb): inserta leads de a uno con el JWT del
--      usuario (SECURITY INVOKER), así la RLS y los triggers de `leads`
--      (leads_verificar_limite, leads_normalizar_asignacion) aplican igual que
--      en un alta manual. Una fila que falla no tumba al resto.
--
-- Requiere que haya corrido antes 20261027120000_origen_importacion.sql (el
-- valor IMPORTACION no se puede usar en la transacción que lo agrega).
--
-- Lo que NO hace, a propósito:
--   - No toca RLS ni policies.
--   - No acepta inmobiliaria_id, agente_id ni asignado_a del cliente: salen del
--     perfil de quien llama (espejo de src/lib/atribucionLead.ts).
--   - No setea fecha_primer_contacto_real, fecha_ultimo_contacto_real ni
--     fecha_proximo_seguimiento.
--   - No devuelve ids ni datos de leads, y no loguea datos personales.
-- ============================================================================

begin;

-- 0. Precondiciones -----------------------------------------------------------

do $$
begin
  if not exists (
    select 1
      from pg_enum e
      join pg_type t on t.oid = e.enumtypid
     where t.typname = 'origen_lead'
       and e.enumlabel = 'IMPORTACION'
  ) then
    raise exception
      'ABORTADO: falta origen_lead.IMPORTACION. Correr antes 20261027120000_origen_importacion.sql.';
  end if;
end
$$;

-- A. metricas_semanales -------------------------------------------------------
-- Idéntica a la de 20261014130000_metricas_seguimientos.sql salvo una línea: el
-- subselect de `nuevos` deja afuera origen IMPORTACION.

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

-- B. importar_leads -----------------------------------------------------------

create or replace function public.importar_leads(p_filas jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  c_max_filas    constant int  := 2000;
  c_espacios     constant text := E' \t\r\n';

  v_uid          uuid := auth.uid();
  v_inmobiliaria uuid;
  v_asiste_a     uuid;
  v_activo       boolean;
  v_agente       uuid;

  v_e            jsonb;
  v_ord          int;
  v_fila         int;
  v_tiene_fila   boolean;

  v_nombre       text;
  v_apellido     text;
  v_telefono     text;
  v_email        text;
  v_descripcion  text;
  v_estado_txt   text;
  v_estado       public.estado_lead;
  v_fecha_txt    text;
  v_fecha        timestamptz;

  v_error        text;
  v_msg          text;
  v_limite       boolean := false;
  v_insertados   int := 0;
  v_resultados   jsonb := '[]'::jsonb;
begin
  -- Identidad -----------------------------------------------------------------
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  select p.inmobiliaria_id, p.asiste_a, p.activo
    into v_inmobiliaria, v_asiste_a, v_activo
    from public.profiles p
   where p.id = v_uid;

  if not found then
    raise exception 'No se encontró tu perfil de agente.';
  end if;
  if v_activo is not true then
    raise exception 'Tu usuario está desactivado.';
  end if;

  -- Misma regla que atribucionDeAlta(): el lead es del agente (el asistente
  -- carga para el agente al que asiste) y lo lleva quien lo importa.
  v_agente := coalesce(v_asiste_a, v_uid);

  -- Entrada -------------------------------------------------------------------
  if p_filas is null or jsonb_typeof(p_filas) <> 'array' then
    raise exception 'p_filas tiene que ser una lista de filas.';
  end if;
  if jsonb_array_length(p_filas) > c_max_filas then
    raise exception 'Máximo % filas por importación.', c_max_filas;
  end if;

  -- Filas ---------------------------------------------------------------------
  for v_e, v_ord in
    select e.value, e.ordinality::int
      from jsonb_array_elements(p_filas) with ordinality as e(value, ordinality)
  loop
    -- Número de fila del archivo; si no vino bien, la posición en la lista.
    v_tiene_fila := coalesce(
      jsonb_typeof(v_e) = 'object'
        and jsonb_typeof(v_e -> 'fila') = 'number'
        and (v_e ->> 'fila') ~ '^[0-9]{1,9}$',
      false
    );
    v_fila := case when v_tiene_fila then (v_e ->> 'fila')::int else v_ord end;

    -- Tras el tope del plan, el resto no se intenta.
    if v_limite then
      v_resultados := v_resultados || jsonb_build_object('fila', v_fila, 'resultado', 'LIMITE_ALCANZADO');
      continue;
    end if;

    -- Normalización ---------------------------------------------------------
    -- Solo se lee un campo si es texto: un número o un objeto ahí es un dato
    -- mal formado, no algo que haya que convertir.
    v_error := null;

    v_nombre      := nullif(btrim(case when jsonb_typeof(v_e -> 'nombre') = 'string' then v_e ->> 'nombre' end, c_espacios), '');
    v_apellido    := nullif(btrim(case when jsonb_typeof(v_e -> 'apellido') = 'string' then v_e ->> 'apellido' end, c_espacios), '');
    v_telefono    := nullif(btrim(case when jsonb_typeof(v_e -> 'telefono') = 'string' then v_e ->> 'telefono' end, c_espacios), '');
    v_email       := nullif(lower(btrim(case when jsonb_typeof(v_e -> 'email') = 'string' then v_e ->> 'email' end, c_espacios)), '');
    v_descripcion := nullif(btrim(case when jsonb_typeof(v_e -> 'descripcion_inicial') = 'string' then v_e ->> 'descripcion_inicial' end, c_espacios), '');
    v_estado_txt  := nullif(btrim(case when jsonb_typeof(v_e -> 'estado') = 'string' then v_e ->> 'estado' end, c_espacios), '');
    v_fecha_txt   := nullif(btrim(case when jsonb_typeof(v_e -> 'fecha_ingreso') = 'string' then v_e ->> 'fecha_ingreso' end, c_espacios), '');

    if jsonb_typeof(v_e) <> 'object' or not v_tiene_fila then
      v_error := 'Falta el número de fila.';
    elsif v_nombre is null then
      v_error := 'Falta el nombre.';
    elsif char_length(v_nombre) > 100 then
      v_error := 'El nombre supera los 100 caracteres.';
    elsif char_length(coalesce(v_apellido, '')) > 100 then
      v_error := 'El apellido supera los 100 caracteres.';
    elsif char_length(coalesce(v_telefono, '')) > 50 then
      v_error := 'El teléfono supera los 50 caracteres.';
    elsif char_length(coalesce(v_email, '')) > 254 then
      v_error := 'El email supera los 254 caracteres.';
    elsif char_length(coalesce(v_descripcion, '')) > 2000 then
      v_error := 'La descripción supera los 2000 caracteres.';
    end if;

    if v_error is not null then
      v_resultados := v_resultados || jsonb_build_object('fila', v_fila, 'resultado', 'ERROR', 'mensaje', v_error);
      continue;
    end if;

    -- Estado: un valor del enum o nada. Lo que no se reconoce no frena la fila.
    v_estado := case
      when upper(v_estado_txt) = any (enum_range(null::public.estado_lead)::text[])
        then upper(v_estado_txt)::public.estado_lead
    end;

    -- Fecha de ingreso: ilegible o a más de un día en el futuro => ahora.
    v_fecha := null;
    if v_fecha_txt is not null then
      begin
        v_fecha := v_fecha_txt::timestamptz;
      exception when others then
        v_fecha := null;
      end;
    end if;
    if v_fecha is null or v_fecha > now() + interval '1 day' then
      v_fecha := now();
    end if;

    -- Inserción -------------------------------------------------------------
    begin
      insert into public.leads (
        inmobiliaria_id, agente_id, asignado_a,
        nombre, apellido, telefono, email, descripcion_inicial,
        estado, origen, fecha_ingreso
      ) values (
        v_inmobiliaria, v_agente, v_uid,
        v_nombre, v_apellido, v_telefono, v_email, v_descripcion,
        v_estado, 'IMPORTACION', v_fecha
      );

      v_insertados := v_insertados + 1;
      v_resultados := v_resultados || jsonb_build_object('fila', v_fila, 'resultado', 'OK');
    exception
      -- leads_email_unico_por_inmobiliaria. Este bloque revierte solo esta fila.
      when unique_violation then
        v_resultados := v_resultados || jsonb_build_object('fila', v_fila, 'resultado', 'EMAIL_DUPLICADO');

      -- Triggers con raise exception: el tope del plan corta el lote; los
      -- demás (por ejemplo leads_normalizar_asignacion) son error de esa fila.
      when sqlstate 'P0001' then
        v_msg := left(sqlerrm, 200);
        if v_msg like 'Llegaste al límite%' then
          v_limite := true;
          v_resultados := v_resultados || jsonb_build_object('fila', v_fila, 'resultado', 'LIMITE_ALCANZADO');
        else
          v_resultados := v_resultados || jsonb_build_object('fila', v_fila, 'resultado', 'ERROR', 'mensaje', v_msg);
        end if;

      -- Cualquier otra cosa: solo el código. SQLERRM podría traer datos del lead.
      when others then
        v_resultados := v_resultados || jsonb_build_object(
          'fila', v_fila, 'resultado', 'ERROR', 'mensaje', 'Error al guardar (código ' || sqlstate || ').'
        );
    end;
  end loop;

  return jsonb_build_object('insertados', v_insertados, 'resultados', v_resultados);
end;
$$;

comment on function public.importar_leads(jsonb) is
  'Importa leads desde un archivo, de a uno, con el JWT del usuario (RLS y triggers aplican). Origen IMPORTACION, agente_id/asignado_a como atribucionDeAlta. Una fila que falla no frena a las demás; el tope del plan corta el resto del lote. No devuelve ids ni datos de leads.';

revoke all on function public.importar_leads(jsonb) from public, anon;
grant execute on function public.importar_leads(jsonb) to authenticated;

commit;
