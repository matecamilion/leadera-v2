-- Cierra el último grant amplio sobre `google_calendar_tokens`.
--
-- `authenticated` y `anon` tenían INSERT sobre todas las columnas. Hoy no es
-- explotable —no hay ninguna policy de INSERT y RLS lo bloquea—, pero es el
-- mismo riesgo latente que tenía el UPDATE antes de acotarlo: el día que
-- alguien agregue una policy de INSERT mirando sólo las filas, el grant deja
-- escribir cualquier columna, tokens incluidos.
--
-- No va ningún GRANT de reemplazo: ninguna fila de esta tabla se crea desde el
-- navegador. La crea `google-oauth-callback` con service_role, al volver del
-- consentimiento de Google, y ese rol tiene sus propios permisos.
--
-- Con esto los tres verbos quedan acotados:
--   SELECT → agente_id, conectado, updated_at, importacion_activa (su fila)
--   UPDATE → importacion_activa (su fila)
--   INSERT → nadie desde el cliente
--
-- Idempotente.

revoke insert on public.google_calendar_tokens from authenticated;
revoke insert on public.google_calendar_tokens from anon;
