-- Los tokens de Google dejan de ser legibles desde el navegador.
--
-- `authenticated` (y `anon`) tenían SELECT sobre TODAS las columnas de
-- `google_calendar_tokens`. La policy de RLS acota a la fila propia, así que
-- nadie veía la de otro agente, pero cualquier script corriendo con la sesión
-- de un agente podía leer SU access_token y SU refresh_token de Google en
-- texto plano: credenciales que dan acceso a su calendario por fuera de
-- LeadEra. Verificado en la práctica: un PATCH con `return=representation`
-- devolvía la fila entera con el access_token adentro.
--
-- El frontend nunca los necesitó. `src/lib/api/googleCalendar.ts` lee
-- `conectado, updated_at, importacion_activa` y escribe `importacion_activa`.
--
-- El UPDATE ya quedó acotado a `importacion_activa` en la migración
-- `..._google_calendar_importacion_toggle` y acá no se toca.
--
-- Las Edge Functions no se ven afectadas: usan service_role, que tiene sus
-- propios permisos y es quien lee y renueva los tokens.
--
-- Idempotente.

revoke select on public.google_calendar_tokens from authenticated;
revoke select on public.google_calendar_tokens from anon;

-- Lo único que el navegador necesita ver:
--   conectado          → el estado de la conexión en /perfil.
--   updated_at         → "cuándo se sincronizó por última vez".
--   importacion_activa → el toggle de importación.
--   agente_id          → NO se muestra, pero el UPDATE del toggle filtra por
--                        esta columna, y Postgres exige SELECT sobre lo que
--                        aparece en un WHERE. Es el uuid del propio agente,
--                        que el cliente ya conoce por su sesión.
--
-- Fuera quedan, además de los tokens: `scope`, `google_calendar_id`, `id`,
-- `created_at` y las tres columnas de diagnóstico de la importación
-- (`importacion_ultima_at`, `importacion_ultimo_error`,
-- `importacion_fallos_seguidos`). Si alguna vez la UI muestra el estado de la
-- última importación, habrá que sumar acá la columna que use.
grant select (agente_id, conectado, updated_at, importacion_activa)
  on public.google_calendar_tokens
  to authenticated;

-- `anon` (visitante sin sesión) no lee nada de esta tabla. La policy ya lo
-- dejaba sin filas, porque `auth.uid()` es null; ahora tampoco tiene el grant.
