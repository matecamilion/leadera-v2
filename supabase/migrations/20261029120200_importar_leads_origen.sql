-- ============================================================================
-- Importar leads: origen por fila
--
-- Qué hace:
--   A) importar_leads deja de estampar siempre 'IMPORTACION'. Cada fila puede
--      traer "origen" (texto):
--        - viene y es un valor del enum origen_lead (sin distinguir mayúsculas
--          ni espacios en los bordes) -> se usa ese, salvo MANUAL, REFERIDO y
--          LINK_CONSULTA, que un archivo no puede asignar: alimentan métricas de
--          gestión o son de uso interno -> ERROR de esa fila;
--        - no viene, es null o es vacío -> 'IMPORTACION' (el comportamiento de antes);
--        - viene y NO es un valor del enum (o no es texto) -> ERROR de esa fila;
--      en todos los casos el error es de la fila y el resto del lote sigue.
--   B) Recibe el id del lote en un segundo parámetro (p_importacion_id, uno por
--      importación: el front lo manda igual en cada tanda de 200 filas) y lo
--      guarda en leads.importacion_id. Sin él queda null.
--
--      Se cambia la firma: se borra importar_leads(jsonb) para no dejar una
--      sobrecarga. Un cliente que siga llamando solo con p_filas anda igual
--      (el parámetro nuevo tiene DEFAULT NULL).
--
-- Requiere que hayan corrido antes 20261027120000_origen_importacion.sql,
-- 20261029120000_origen_portales.sql (los valores nuevos del enum no se pueden
-- usar en la transacción que los agrega) y 20261029120100_leads_importacion_id.sql
-- (la columna).
--
-- Lo que NO hace, a propósito:
--   - Todo lo demás de la función queda idéntico a 20261027120100_importar_leads.sql:
--     SECURITY INVOKER, search_path, tope de 2000 filas, validaciones de largo,
--     atribución (agente_id / asignado_a), fecha_ingreso, tope del plan, formato
--     del retorno y grants.
--   - No recrea metricas_semanales ni nada ajeno a la función.
--   - No toca RLS ni policies.
-- ============================================================================

begin;

-- 0. Precondiciones -----------------------------------------------------------

do $$
declare
  v_falta text;
begin
  select string_agg(r.valor, ', ' order by r.valor)
    into v_falta
    from unnest(array['IMPORTACION', 'ZONAPROP', 'ARGENPROP', 'MERCADO_LIBRE']) as r(valor)
   where not exists (
     select 1
       from pg_enum e
       join pg_type t on t.oid = e.enumtypid
      where t.typname = 'origen_lead'
        and e.enumlabel = r.valor
   );

  if v_falta is not null then
    raise exception
      'ABORTADO: faltan valores de origen_lead (%). Correr antes 20261027120000_origen_importacion.sql y 20261029120000_origen_portales.sql.',
      v_falta;
  end if;

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

-- 1. importar_leads -----------------------------------------------------------

-- La firma vieja de un solo parámetro se borra: dejarla sería una sobrecarga y
-- supabase.rpc('importar_leads', { p_filas }) quedaría ambiguo.
drop function if exists public.importar_leads(jsonb);

create or replace function public.importar_leads(
  p_filas jsonb,
  p_importacion_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  c_max_filas    constant int  := 2000;
  c_espacios     constant text := E' \t\r\n';
  -- Orígenes que un archivo no puede asignar. Lista negra y no blanca, para que
  -- un valor nuevo del enum quede permitido sin tocar la función.
  c_origenes_vedados constant text[] := array['MANUAL', 'REFERIDO', 'LINK_CONSULTA'];

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
  v_origen_txt   text;
  v_origen_malo  boolean;
  v_origen       public.origen_lead;

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

    -- Origen: ausente, null o vacío es "no vino" (se usa IMPORTACION). Un texto se
    -- compara en mayúsculas contra el enum. Un valor que no es texto (número,
    -- objeto, lista, booleano) sí vino y no sirve: es error, no "no vino".
    v_origen_txt  := nullif(upper(btrim(case when jsonb_typeof(v_e -> 'origen') = 'string' then v_e ->> 'origen' end, c_espacios)), '');
    v_origen_malo := coalesce(jsonb_typeof(v_e -> 'origen') not in ('string', 'null'), false);

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
    elsif v_origen_malo then
      v_error := 'El origen tiene que ser un texto.';
    elsif v_origen_txt is not null
          and v_origen_txt <> all (enum_range(null::public.origen_lead)::text[]) then
      v_error := 'El origen "' || left(v_origen_txt, 40) || '" no es válido.';
    elsif v_origen_txt = any (c_origenes_vedados) then
      v_error := 'El origen "' || v_origen_txt || '" no se puede usar al importar.';
    end if;

    if v_error is not null then
      v_resultados := v_resultados || jsonb_build_object('fila', v_fila, 'resultado', 'ERROR', 'mensaje', v_error);
      continue;
    end if;

    -- Origen: el de la fila (ya validado arriba) o IMPORTACION.
    v_origen := coalesce(v_origen_txt::public.origen_lead, 'IMPORTACION'::public.origen_lead);

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
        estado, origen, fecha_ingreso, importacion_id
      ) values (
        v_inmobiliaria, v_agente, v_uid,
        v_nombre, v_apellido, v_telefono, v_email, v_descripcion,
        v_estado, v_origen, v_fecha, p_importacion_id
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

comment on function public.importar_leads(jsonb, uuid) is
  'Importa leads desde un archivo, de a uno, con el JWT del usuario (RLS y triggers aplican). Origen por fila (un valor de origen_lead salvo MANUAL, REFERIDO y LINK_CONSULTA; si no viene, IMPORTACION; si no sirve, ERROR de esa fila), importacion_id = p_importacion_id (null si no viene), agente_id/asignado_a como atribucionDeAlta. Una fila que falla no frena a las demás; el tope del plan corta el resto del lote. No devuelve ids ni datos de leads.';

revoke all on function public.importar_leads(jsonb, uuid) from public, anon;
grant execute on function public.importar_leads(jsonb, uuid) to authenticated;

commit;
