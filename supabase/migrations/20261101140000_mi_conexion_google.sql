-- APLICADA el 01/11/2026.
--
-- `mi_conexion_google()`: el estado de la conexión con Google Calendar del
-- agente del llamador, visible también para sus asistentes.
--
-- Por qué hace falta: un ASISTENTE no conecta Google, opera el calendario de su
-- agente (`profiles.asiste_a`). Pero la policy de `google_calendar_tokens` solo
-- deja ver la fila propia, así que el asistente veía "No conectado" y el banner
-- de Conectar aunque el agente estuviera conectado. No se abre la policy (la
-- fila trae los tokens): esta función devuelve SOLO tres campos.
--
-- Qué devuelve (nunca tokens ni otros campos):
--   conectado           boolean
--   updated_at          timestamptz
--   importacion_activa  boolean
--
-- De quién es la fila que lee (sin parámetros: no acepta ningún id):
--   - Dueño o agente: la suya.
--   - Asistente: la del agente al que asiste, y solo si el asistente está
--     activo y el agente existe, está activo, no es a su vez un asistente y es
--     de la misma inmobiliaria. Es el mismo criterio que `resolverDuenoCalendario`
--     de las Edge Functions (supabase/functions/_shared/equipoCalendario.ts):
--     lo que la UI muestra es lo que el servidor va a usar.
--   Cualquier otro caso (sin sesión, sin perfil, sin fila) devuelve CERO filas,
--   que el front interpreta como "nunca conectó".
--
-- Seguridad:
--   - SECURITY DEFINER con `search_path = 'public'` fijo; toda referencia va
--     calificada (`public.`, `auth.`).
--   - revoke de public, anon y authenticated, y grant solo a authenticated.
--   - Los nombres del `returns table` son parámetros OUT: toda columna va
--     calificada con su alias para que no resuelva contra ellos.
--
-- No toca tablas, policies ni RLS. Idempotente.

begin;

create or replace function public.mi_conexion_google()
returns table (
  conectado          boolean,
  updated_at         timestamptz,
  importacion_activa boolean
)
language sql
stable
security definer
set search_path = 'public'
as $$
  select t.conectado, t.updated_at, t.importacion_activa
  from public.profiles yo
  left join public.profiles ag on ag.id = yo.asiste_a
  join public.google_calendar_tokens t
    on t.agente_id = case when yo.rol = 'ASISTENTE' then ag.id else yo.id end
  where yo.id = auth.uid()
    and yo.activo
    and (
      yo.rol <> 'ASISTENTE'
      or (
        ag.id is not null
        and ag.activo
        and ag.rol <> 'ASISTENTE'
        and ag.inmobiliaria_id = yo.inmobiliaria_id
      )
    )
$$;

revoke all on function public.mi_conexion_google() from public;
revoke all on function public.mi_conexion_google() from anon;
revoke all on function public.mi_conexion_google() from authenticated;
grant execute on function public.mi_conexion_google() to authenticated;

commit;

-- ============================================================================
-- PRUEBA (correr DESPUÉS de aplicar; termina en rollback, no deja nada)
-- ============================================================================
-- Se simula la sesión de un usuario con el rol `authenticated` y su `sub`.
-- Reemplazar los uuid. Para elegirlos (solo lectura):
--
--   select a.id as asistente, a.asiste_a as agente, ag.rol as rol_agente
--   from public.profiles a join public.profiles ag on ag.id = a.asiste_a
--   where a.rol = 'ASISTENTE' and a.activo;
--
-- begin;
--
-- -- 1) COMO ASISTENTE: debe devolver la conexión DEL AGENTE (una fila, 3 columnas).
-- set local role authenticated;
-- select set_config('request.jwt.claims',
--   json_build_object('sub', '<UUID_DEL_ASISTENTE>', 'role', 'authenticated')::text, true);
-- select * from public.mi_conexion_google();
--
-- -- 2) COMO AGENTE: debe devolver SU propia conexión (o cero filas si nunca conectó).
-- select set_config('request.jwt.claims',
--   json_build_object('sub', '<UUID_DEL_AGENTE>', 'role', 'authenticated')::text, true);
-- select * from public.mi_conexion_google();
--
-- -- 3) El asistente sigue sin poder leer la tabla directo (la policy no cambió):
-- select set_config('request.jwt.claims',
--   json_build_object('sub', '<UUID_DEL_ASISTENTE>', 'role', 'authenticated')::text, true);
-- select count(*) from public.google_calendar_tokens;   -- esperado: 0 (o solo la fila propia)
--
-- -- 4) Sin sesión (auth.uid() nulo): cero filas.
-- select set_config('request.jwt.claims', '{}', true);
-- select * from public.mi_conexion_google();             -- esperado: 0 filas
--
-- -- 5) anon NO puede ejecutarla:
-- reset role;
-- set local role anon;
-- select * from public.mi_conexion_google();             -- esperado: ERROR permission denied
--
-- rollback;
