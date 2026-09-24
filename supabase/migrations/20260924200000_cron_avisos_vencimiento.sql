-- Cron de los avisos de vencimiento: todos los días a las 10:00 de Argentina.
--
-- pg_cron corre en UTC y Argentina es UTC-3 todo el año (no hay horario de
-- verano desde 2009), así que las 10:00 locales son las 13:00 UTC fijas. Si
-- alguna vez volviera el horario de verano, este job hay que revisarlo.
--
-- La función decide sola a quién le escribe y qué aviso le toca: el cron no
-- filtra nada. Tiene que correr DESPUÉS de `procesar-transiciones-suscripcion-diario`
-- (05:00 UTC): la fecha de corte que anuncia el mail sale de ese horario.
--
-- Mismo patrón que los otros crons: la service role key se lee del Vault en
-- cada ejecución y nunca queda escrita en `cron.job`. El cuerpo `{}` es la
-- corrida real; la función rechaza con 400 cualquier cuerpo mal escrito.
--
-- Idempotente: si el job ya existe se desprograma y se vuelve a programar.
-- Para apagarlo: select cron.unschedule('avisos-vencimiento-diario');

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.unschedule(jobid)
from cron.job
where jobname = 'avisos-vencimiento-diario';

select cron.schedule(
  'avisos-vencimiento-diario',
  '0 13 * * *',
  $$
    SELECT net.http_post(
      url := 'https://gnnowyphlxebdxbfsmss.supabase.co/functions/v1/avisos-vencimiento',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret FROM vault.decrypted_secrets
          WHERE name = 'cron_service_role_key'
        ),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb,
      -- Un mail por cuenta contra Resend: con varias cuentas la corrida tarda
      -- más que los 5 s que pg_net espera por defecto.
      timeout_milliseconds := 120000
    );
  $$
);
