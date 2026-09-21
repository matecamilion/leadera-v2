-- El agente prende y apaga la importación de su calendario desde /perfil.
--
-- Hasta acá `importacion_activa` se cambiaba a mano desde el SQL Editor. Para
-- que lo haga la UI, el cliente necesita poder escribir ESA columna y ninguna
-- otra de esta tabla, que es donde viven los tokens de Google.
--
-- Son dos capas distintas y hacen falta las dos:
--   - GRANT por columna: decide QUÉ columnas puede tocar un UPDATE.
--   - RLS: decide QUÉ FILAS. No puede limitar columnas, así que sola no
--     alcanzaría.
--
-- Idempotente.

-- ---------------------------------------------------------------------------
-- 1. Permisos por columna
-- ---------------------------------------------------------------------------
-- Hoy `authenticated` y `anon` tienen UPDATE sobre TODAS las columnas (el grant
-- amplio que Supabase da por defecto). No se nota porque no hay ninguna policy
-- de UPDATE y RLS bloquea todo, pero al agregar la policy de abajo ese grant
-- pasaría a permitir escribir access_token y refresh_token. Así que primero se
-- cierra el grant y recién después se abre la fila.
revoke update on public.google_calendar_tokens from authenticated;
revoke update on public.google_calendar_tokens from anon;

-- Lo único que el cliente puede escribir en esta tabla.
grant update (importacion_activa) on public.google_calendar_tokens to authenticated;

-- `anon` (visitante sin sesión) no escribe nada acá.

-- ---------------------------------------------------------------------------
-- 2. RLS: sólo su propia fila
-- ---------------------------------------------------------------------------
-- Mismo criterio que la policy de SELECT que ya existe (`agente_ve_su_token`).
-- El WITH CHECK repite la condición para que un UPDATE no pueda dejar la fila
-- apuntando a otro agente: sin él, `agente_id` seguiría fuera de alcance por el
-- grant, pero la regla queda explícita y no depende de eso.
drop policy if exists agente_activa_su_importacion on public.google_calendar_tokens;

create policy agente_activa_su_importacion
  on public.google_calendar_tokens
  for update
  to authenticated
  using (agente_id = auth.uid())
  with check (agente_id = auth.uid());
