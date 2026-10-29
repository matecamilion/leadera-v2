-- ============================================================================
-- Revertir una importación de leads
--
-- Qué hace:
--   revertir_importacion(p_importacion_id, p_confirmar) borra los leads de una
--   importación (los que tienen ese leads.importacion_id) que no tienen ningún
--   dato asociado. Con p_confirmar = false (por defecto) solo simula.
--
-- Por qué SECURITY DEFINER:
--   La RPC necesita private.my_inmobiliaria_id(), private.my_rol() y los helpers
--   de abajo, y el rol authenticated NO tiene USAGE sobre el esquema private (ni
--   se le otorga). Con SECURITY INVOKER fallaba con "permission denied for schema
--   private". Corre entonces como el dueño de la función, con search_path vacío y
--   todos los nombres calificados con esquema: una función SECURITY DEFINER con
--   search_path heredado se puede secuestrar con objetos del mismo nombre en otro
--   esquema.
--
-- Qué reemplaza a la RLS:
--   Como corre sin RLS, la autorización es explícita y equivale a la policy
--   leads_delete (más estricta: no deja revertir al ASISTENTE):
--     - el DUENO de la inmobiliaria, o
--     - quien no es ASISTENTE y tiene como agente a TODOS los leads del lote.
--   Cualquier otro caso (incluido un lote entero de otro agente) es el error "No
--   tenés permiso para revertir esta importación." El permiso se verifica antes de
--   devolver o contar nada hacia afuera, para no filtrar cantidades de leads
--   ajenos. Si la policy leads_delete cambia, hay que revisar esta función.
--   También se verifica que el usuario esté activo: lo que antes frenaban las
--   policies, ahora lo frena este chequeo.
--
-- La identidad sale siempre de auth.uid(), private.my_inmobiliaria_id() y
-- private.my_rol(), nunca de parámetros. Todas las consultas y el DELETE filtran
-- por la inmobiliaria del usuario Y por importacion_id.
--
-- Dos helpers en el esquema private (SECURITY DEFINER, igual que
-- private.my_es_superadmin), siempre acotados a la inmobiliaria del usuario:
--   - leads_de_importacion_con_dependencias: qué leads del lote tienen filas
--     dependientes. Un DELETE de la FK en CASCADE correría sin RLS y se llevaría
--     esas filas en silencio, así que quien las tenga queda protegido.
--   - leads_ajenos_de_importacion: cuántos leads del lote no son del usuario.
--
-- Lo que NO hace, a propósito:
--   - No toca RLS, policies ni triggers.
--   - No borra leads con dependientes, aunque la FK sea SET NULL: desvincular
--     datos en silencio no es revertir una importación.
--   - No revierte importaciones anteriores a leads.importacion_id.
--
-- Repetible: create or replace, revoke y grant se pueden volver a correr.
-- Requiere 20261029120100_leads_importacion_id.sql.
-- ============================================================================

begin;

-- 0. Precondiciones -----------------------------------------------------------

do $$
declare
  v_falta text;
begin
  if to_regprocedure('private.my_inmobiliaria_id()') is null
     or to_regprocedure('private.my_rol()') is null then
    raise exception 'ABORTADO: falta private.my_inmobiliaria_id() o private.my_rol().';
  end if;

  select string_agg(t, ', ')
    into v_falta
    from unnest(array['interacciones', 'operaciones', 'busquedas', 'tareas', 'visitas', 'propiedades', 'consultas']) as t
   where to_regclass('public.' || t) is null;
  if v_falta is not null then
    raise exception 'ABORTADO: faltan tablas (%).', v_falta;
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

-- 1. Helpers ------------------------------------------------------------------

-- Qué leads del lote, de la inmobiliaria del usuario, tienen CUALQUIER fila
-- dependiente: interacciones, operaciones, búsquedas, tareas, visitas,
-- propiedades de las que son propietarios y consultas (vinculadas o como lead
-- existente).
create or replace function private.leads_de_importacion_con_dependencias(p_importacion_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select l.id
    from public.leads l
   where l.inmobiliaria_id = private.my_inmobiliaria_id()
     and l.importacion_id = p_importacion_id
     and (
       exists (select 1 from public.interacciones x where x.lead_id = l.id)
       or exists (select 1 from public.operaciones x where x.lead_id = l.id)
       or exists (select 1 from public.busquedas x where x.lead_id = l.id)
       or exists (select 1 from public.tareas x where x.lead_id = l.id)
       or exists (select 1 from public.visitas x where x.lead_id = l.id)
       or exists (select 1 from public.propiedades x where x.lead_propietario_id = l.id)
       or exists (select 1 from public.consultas x where x.lead_id = l.id or x.lead_existente_id = l.id)
     )
$$;

revoke all on function private.leads_de_importacion_con_dependencias(uuid) from public, anon;
grant execute on function private.leads_de_importacion_con_dependencias(uuid) to authenticated;

-- Cuántos leads del lote, de la inmobiliaria del usuario, no tienen como agente
-- al usuario.
create or replace function private.leads_ajenos_de_importacion(p_importacion_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
    from public.leads l
   where l.inmobiliaria_id = private.my_inmobiliaria_id()
     and l.importacion_id = p_importacion_id
     and l.agente_id is distinct from auth.uid()
$$;

revoke all on function private.leads_ajenos_de_importacion(uuid) from public, anon;
grant execute on function private.leads_ajenos_de_importacion(uuid) to authenticated;

-- 2. revertir_importacion -----------------------------------------------------

create or replace function public.revertir_importacion(
  p_importacion_id uuid,
  p_confirmar boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_dias_ventana constant int := 7;
  c_sin_lote     constant text := 'No se encontró ninguna importación con ese id en tu cuenta.';

  v_uid          uuid := auth.uid();
  -- p_confirmar puede llegar null (un cliente que lo mande explícito): sin esto,
  -- "if not null" no entra a la simulación y la función seguiría hasta el DELETE
  -- sin tomar el bloqueo. Null es simulación, igual que el valor por defecto.
  v_confirmar    boolean := coalesce(p_confirmar, false);
  v_activo       boolean;
  v_inmobiliaria uuid;
  v_rol          text;
  v_total        int;
  v_primera      timestamptz;
  v_protegidos   int;
  v_borrables    int;
  v_borrados     int;
  v_en_ventana   boolean;
  v_motivo       text;
begin
  -- Identidad -----------------------------------------------------------------
  if v_uid is null then
    raise exception 'No autenticado';
  end if;
  if p_importacion_id is null then
    raise exception 'Falta el id de la importación.';
  end if;

  select p.activo
    into v_activo
    from public.profiles p
   where p.id = v_uid;
  if not found then
    raise exception 'No se encontró tu perfil de agente.';
  end if;
  if v_activo is not true then
    raise exception 'Tu usuario está desactivado.';
  end if;

  v_inmobiliaria := private.my_inmobiliaria_id();
  v_rol := private.my_rol()::text;
  if v_inmobiliaria is null or v_rol is null then
    raise exception 'No se encontró tu perfil de agente.';
  end if;

  -- El lote en MI inmobiliaria. Los números de acá no salen hacia afuera: primero
  -- se verifica el permiso.
  select count(*), min(l.created_at)
    into v_total, v_primera
    from public.leads l
   where l.inmobiliaria_id = v_inmobiliaria
     and l.importacion_id = p_importacion_id;

  -- Lote inexistente, vacío o de otra cuenta: no hay nada que ver ni que borrar.
  if v_total = 0 then
    if v_confirmar then
      return jsonb_build_object('borrados', 0, 'protegidos', 0, 'motivo', c_sin_lote);
    end if;
    return jsonb_build_object(
      'total', 0, 'borrables', 0, 'protegidos', 0,
      'en_ventana', false, 'puede', false, 'motivo', c_sin_lote
    );
  end if;

  -- Permiso -------------------------------------------------------------------
  -- El DUENO, o quien no es ASISTENTE y es el agente de todo el lote. Un error y
  -- no un resultado vacío: "no podés" no se tiene que confundir con "no hay nada".
  if v_rol is distinct from 'DUENO'
     and (v_rol = 'ASISTENTE' or private.leads_ajenos_de_importacion(p_importacion_id) > 0) then
    raise exception 'No tenés permiso para revertir esta importación.';
  end if;

  -- Bloqueo (solo al confirmar) -------------------------------------------------
  -- Se bloquean los leads del lote antes de contar y de borrar. Una interacción,
  -- tarea o propiedad que se esté cargando termina antes de que se cuente (y se
  -- ve); una que llegue después espera a que esta transacción cierre y falla
  -- porque el lead ya no existe. Cada sentencia siguiente toma una foto nueva, así
  -- que ve todo lo confirmado hasta el bloqueo. Orden por id: sin deadlocks entre
  -- dos reversiones. Solo se bloquea después de verificar el permiso: quien no
  -- puede revertir nunca toma bloqueos.
  if v_confirmar then
    perform 1
      from public.leads l
     where l.inmobiliaria_id = v_inmobiliaria
       and l.importacion_id = p_importacion_id
     order by l.id
       for update;

    -- Con el lote bloqueado se vuelve a mirar todo: entre la primera lectura y el
    -- bloqueo alguien pudo borrarlo o reasignar leads.
    select count(*), min(l.created_at)
      into v_total, v_primera
      from public.leads l
     where l.inmobiliaria_id = v_inmobiliaria
       and l.importacion_id = p_importacion_id;

    if v_total = 0 then
      return jsonb_build_object('borrados', 0, 'protegidos', 0, 'motivo', c_sin_lote);
    end if;

    if v_rol is distinct from 'DUENO'
       and private.leads_ajenos_de_importacion(p_importacion_id) > 0 then
      raise exception 'No tenés permiso para revertir esta importación.';
    end if;
  end if;

  -- Ventana -------------------------------------------------------------------
  v_en_ventana := v_primera >= now() - make_interval(days => c_dias_ventana);
  if not v_en_ventana then
    v_motivo := format(
      'Solo se puede revertir una importación dentro de los %s días de haberse hecho.',
      c_dias_ventana
    );
  end if;

  -- Protegidos: leads del lote con cualquier fila dependiente.
  select count(*)
    into v_protegidos
    from public.leads l
   where l.inmobiliaria_id = v_inmobiliaria
     and l.importacion_id = p_importacion_id
     and l.id in (select private.leads_de_importacion_con_dependencias(p_importacion_id));
  v_borrables := v_total - v_protegidos;

  -- Simulación: no toca nada.
  if not v_confirmar then
    return jsonb_build_object(
      'total', v_total, 'borrables', v_borrables, 'protegidos', v_protegidos,
      'en_ventana', v_en_ventana, 'puede', v_en_ventana, 'motivo', v_motivo
    );
  end if;

  if not v_en_ventana then
    return jsonb_build_object('borrados', 0, 'protegidos', v_protegidos, 'motivo', v_motivo);
  end if;

  -- Borrado -------------------------------------------------------------------
  with borrados as (
    delete from public.leads l
     where l.inmobiliaria_id = v_inmobiliaria
       and l.importacion_id = p_importacion_id
       and l.id not in (select private.leads_de_importacion_con_dependencias(p_importacion_id))
    returning l.id
  )
  select count(*) into v_borrados from borrados;

  -- Todo o nada: si algún lead borrable quedó sin borrar, se deshace todo.
  if v_borrados <> v_borrables then
    raise exception 'No se pudo revertir toda la importación: no se borró nada.';
  end if;

  return jsonb_build_object('borrados', v_borrados, 'protegidos', v_protegidos, 'motivo', null);
end;
$$;

comment on function public.revertir_importacion(uuid, boolean) is
  'Revierte (borra) una importación de leads identificada por su importacion_id. Parámetros: p_importacion_id = id de la importación; p_confirmar = false (por defecto; null se trata como false) es una simulación que no borra nada y devuelve {total, borrables, protegidos, en_ventana, puede, motivo}; con true borra los leads borrables y devuelve {borrados, protegidos, motivo}. SECURITY DEFINER con search_path vacío: corre sin RLS (el rol authenticated no tiene USAGE sobre el esquema private), así que la autorización es explícita y equivale a la policy leads_delete, más estricta: puede el DUENO, o quien no es ASISTENTE y es el agente de todos los leads del lote; cualquier otro caso (incluido un lote entero de otro agente) es el error "No tenés permiso para revertir esta importación." También exige un usuario activo. El permiso se verifica antes de devolver cantidades. Siempre filtra por la inmobiliaria del usuario y por importacion_id: un id de otra cuenta, vacío o inexistente da total 0 sin error. Ventana: solo si el lead más antiguo del lote se creó en los últimos 7 días; fuera de ella no borra y lo informa. Protege (no borra) los leads que tengan cualquier dato asociado: interacciones, operaciones, búsquedas, tareas, visitas, propiedades de las que son propietarios y consultas vinculadas. Al confirmar bloquea los leads del lote (FOR UPDATE) para que nada se asocie entre contar y borrar, y es todo o nada. Si cambia la policy leads_delete, revisar esta función.';

revoke all on function public.revertir_importacion(uuid, boolean) from public, anon;
grant execute on function public.revertir_importacion(uuid, boolean) to authenticated;

commit;
