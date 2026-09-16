-- Respaldo de los cron jobs que hasta ahora vivían sólo en la base de
-- producción, sin versionar.
--
-- `cron.schedule` con nombre hace upsert: si el job ya existe lo reemplaza con
-- esta definición, así que la migración es idempotente y aplicarla sobre
-- producción no duplica nada.
--
-- La clave con la que el cron llama a `actualizar-precios-planes` NO va acá:
-- se lee del Vault por nombre (`cron_service_role_key`) en cada ejecución. En
-- una base nueva ese secreto hay que crearlo a mano antes de que corra el job:
--   select vault.create_secret('<service role key>', 'cron_service_role_key');
-- Nunca escribir la clave en el `command`: queda en texto plano en cron.job.
--
-- Pendiente: `procesar_transiciones_suscripcion()` sigue definida sólo en
-- producción. Este archivo respalda el job que la llama, no la función.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- Lunes 06:00 UTC: recalcula los precios en ARS según el dólar MEP y reajusta
-- las suscripciones en Mercado Pago.
select cron.schedule(
  'actualizar-precios-planes-semanal',
  '0 6 * * 1',
  $$
    SELECT net.http_post(
      url := 'https://gnnowyphlxebdxbfsmss.supabase.co/functions/v1/actualizar-precios-planes',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret FROM vault.decrypted_secrets
          WHERE name = 'cron_service_role_key'
        ),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    );
  $$
);

-- Todos los días 05:00 UTC: aplica las transiciones de estado de las
-- suscripciones (trial vencido, fin de gracia, bajas diferidas al fin del
-- período pagado).
select cron.schedule(
  'procesar-transiciones-suscripcion-diario',
  '0 5 * * *',
  $$ SELECT procesar_transiciones_suscripcion(); $$
);
