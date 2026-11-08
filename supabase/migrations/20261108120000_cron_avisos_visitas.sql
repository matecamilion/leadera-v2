-- Cron de los avisos push de visitas: cada 10 minutos.
--
-- La función decide sola qué avisar y a quién: recordatorio cuando faltan 60
-- minutos o menos para una visita AGENDADA, y "¿Cómo te fue?" desde 30 minutos
-- después de su hora y hasta 3 horas después. El cron no filtra nada. Correr
-- más de una vez no duplica avisos: lo impide el registro
-- `avisos_push_enviados` (clave única usuario + tipo + fecha + ref).
--
-- Mismo patrón que el cron del resumen diario: la service role key se lee del
-- Vault en cada ejecución y nunca queda escrita en `cron.job`. El cuerpo `{}`
-- es la corrida real; la función rechaza con 400 cualquier cuerpo mal escrito.
--
-- Requiere la Edge Function `avisos-visitas` desplegada: antes de eso el job
-- corre y falla con 404 sin efecto. Conviene probarla a mano con
-- `{"dry_run": true}` antes de aplicar esta migración.
--
-- Idempotente: si el job ya existe se desprograma y se vuelve a programar.
-- Para apagarlo: select cron.unschedule('avisos-visitas-push');

begin;

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.unschedule(jobid)
from cron.job
where jobname = 'avisos-visitas-push';

select cron.schedule(
  'avisos-visitas-push',
  '*/10 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://gnnowyphlxebdxbfsmss.supabase.co/functions/v1/avisos-visitas',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret FROM vault.decrypted_secrets
          WHERE name = 'cron_service_role_key'
        ),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb,
      -- Un push por destinatario: con varias cuentas la corrida tarda más que
      -- los 5 s que pg_net espera por defecto.
      timeout_milliseconds := 120000
    );
  $$
);

commit;
