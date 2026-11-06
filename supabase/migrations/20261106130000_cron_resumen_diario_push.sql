-- Cron del resumen diario por push: todos los días a las 9:05 de Argentina.
--
-- pg_cron corre en UTC y Argentina es UTC-3 todo el año (no hay horario de
-- verano desde 2009), así que las 9:05 locales son las 12:05 UTC fijas. Si
-- alguna vez volviera el horario de verano, este job hay que revisarlo.
--
-- La función decide sola a quién le escribe: usuarios con notificaciones
-- activadas, activos y de cuentas no bloqueadas, y sólo si tienen algo para
-- hacer hoy. El cron no filtra nada. Dos corridas el mismo día no duplican el
-- aviso: lo impide el registro `avisos_push_enviados`.
--
-- Mismo patrón que los otros crons: la service role key se lee del Vault en
-- cada ejecución y nunca queda escrita en `cron.job`. El cuerpo `{}` es la
-- corrida real; la función rechaza con 400 cualquier cuerpo mal escrito.
--
-- Requiere la Edge Function `resumen-diario` desplegada: antes de eso el job
-- corre y falla con 404 sin efecto. Conviene probarla a mano con
-- `{"dry_run": true}` antes de aplicar esta migración.
--
-- Idempotente: si el job ya existe se desprograma y se vuelve a programar.
-- Para apagarlo: select cron.unschedule('resumen-diario-push');

begin;

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.unschedule(jobid)
from cron.job
where jobname = 'resumen-diario-push';

select cron.schedule(
  'resumen-diario-push',
  '5 12 * * *',
  $$
    SELECT net.http_post(
      url := 'https://gnnowyphlxebdxbfsmss.supabase.co/functions/v1/resumen-diario',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret FROM vault.decrypted_secrets
          WHERE name = 'cron_service_role_key'
        ),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb,
      -- Una consulta y un push por usuario: con varias cuentas la corrida
      -- tarda más que los 5 s que pg_net espera por defecto.
      timeout_milliseconds := 120000
    );
  $$
);

commit;
