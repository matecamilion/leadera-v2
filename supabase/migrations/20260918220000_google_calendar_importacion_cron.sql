-- Google Calendar Fase 2: cron que dispara la importación Google -> LeadEra.
--
-- ⚠️ Correr recién cuando se decida activar la importación para TODAS las
-- cuentas conectadas: el cron no filtra por agente.
--
-- Cada 3 minutos. Más seguido no suma: lo que el agente carga en Google aparece
-- en LeadEra a lo sumo 3 minutos después, y así una corrida lenta (muchas
-- cuentas, Google tardando) tiene margen para terminar antes de que arranque la
-- siguiente. Si igual se pisaran, el índice único (asignado_a, google_event_id)
-- evita duplicar lo importado.
--
-- Mismo patrón que `actualizar-precios-planes-semanal` (ver respaldo_crons):
-- la clave se lee del Vault en cada ejecución y nunca queda escrita en cron.job.
--
-- `cron.schedule` con nombre hace upsert: correrla dos veces no duplica el job.
-- Para apagarla: select cron.unschedule('importar-google-calendar');

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'importar-google-calendar',
  '*/3 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://gnnowyphlxebdxbfsmss.supabase.co/functions/v1/google-calendar-import',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret FROM vault.decrypted_secrets
          WHERE name = 'cron_service_role_key'
        ),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb,
      -- El default de pg_net son 5 s; con varias cuentas la función tarda más.
      -- No cambia lo que hace la función, sólo cuánto espera pg_net la respuesta.
      timeout_milliseconds := 60000
    );
  $$
);
