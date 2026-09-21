-- Cron del reporte semanal: lunes 9:00 de la mañana, hora de Argentina.
--
-- pg_cron corre en UTC y Argentina es UTC-3 todo el año (no hay horario de
-- verano desde 2009), así que las 9:00 locales son las 12:00 UTC fijas. Si
-- alguna vez volviera el horario de verano, este job hay que revisarlo.
--
-- La función sola decide a quién le manda: sólo a los agentes con
-- `reporte_semanal_activo = true` y `activo = true`. El cron no filtra nada.
--
-- Mismo patrón que los otros crons: la service role key se lee del Vault en
-- cada ejecución y nunca queda escrita en `cron.job`.
--
-- `cron.schedule` con nombre hace upsert: correrla dos veces no duplica el job.
-- Para apagarla: select cron.unschedule('enviar-reportes-semanales');

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'enviar-reportes-semanales',
  '0 12 * * 1',
  $$
    SELECT net.http_post(
      url := 'https://gnnowyphlxebdxbfsmss.supabase.co/functions/v1/enviar-reportes-semanales',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret FROM vault.decrypted_secrets
          WHERE name = 'cron_service_role_key'
        ),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb,
      -- Un mail por agente contra Resend: con varias cuentas la corrida tarda
      -- más que los 5 s que pg_net espera por defecto.
      timeout_milliseconds := 120000
    );
  $$
);
