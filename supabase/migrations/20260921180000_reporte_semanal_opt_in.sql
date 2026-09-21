-- Opt-in del reporte semanal por email.
--
-- Va en `profiles` y no en una tabla nueva: es una preferencia del agente, del
-- mismo tipo que `meta_mensual_ganados`, que ya vive ahí. Una tabla aparte para
-- un booleano por agente sería un join de más en cada lectura.
--
-- Arranca apagada: mandar mails a quien no los pidió es la clase de cosa que
-- termina en la carpeta de spam y con el dominio quemado.
--
-- Esta migración es sólo el interruptor. El envío y el cálculo de métricas
-- llegan en la etapa siguiente.
--
-- Idempotente.

alter table public.profiles
  add column if not exists reporte_semanal_activo boolean not null default false;

-- ---------------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------------
-- El estado de `profiles` ya venía bien acotado y no hace falta endurecer nada
-- más para `authenticated`:
--   - RLS activa, con `profiles_update_propio` (UPDATE, `id = auth.uid()`).
--   - El grant de UPDATE es POR COLUMNA: sólo nombre, apellido y
--     meta_mensual_ganados. Por eso el agente no puede cambiarse el rol ni la
--     inmobiliaria aunque la policy lo deje escribir su fila.
--   - SELECT es a nivel tabla, acotado por RLS a la propia inmobiliaria. Las
--     columnas de `profiles` son datos de equipo (nombre, email, rol), no
--     secretos como los tokens de `google_calendar_tokens`, así que la columna
--     nueva se lee sin agregar nada.
--
-- Lo único que falta es sumar la columna nueva a ese grant de UPDATE: sin
-- esto, el toggle falla con 42501 aunque la policy lo permita.
grant update (reporte_semanal_activo) on public.profiles to authenticated;
