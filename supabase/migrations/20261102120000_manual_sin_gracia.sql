-- Cuentas MANUAL sin período de gracia.
--
-- Antes: una cuenta manual con `acceso_pagado_hasta` vencido pasaba a GRACIA y
-- recién a los 3 días a VENCIDA (reglas 4 y 5 de 20260923120000_cobro_manual.sql).
-- Ahora: el acceso rige hasta el fin del día D de vencimiento (hora de
-- Argentina) y la cuenta pasa a VENCIDA en la primera corrida del cron
-- (05:00 UTC = 02:00 AR) del día D+1, sin importar a qué hora del día D venza.
--
-- Qué cambia en `procesar_transiciones_suscripcion()`:
--   * Regla 4: MANUAL + ACTIVA, y el DÍA (en America/Argentina/Buenos_Aires) de
--     `acceso_pagado_hasta` ya pasó -> VENCIDA (antes GRACIA, y por instante).
--   * Regla 5: MANUAL + GRACIA -> VENCIDA, sin esperar los 3 días. Cubre las
--     cuentas manuales que hoy están en GRACIA: pasan a VENCIDA en la PRÓXIMA
--     corrida del cron (05:00 UTC), no al aplicar esta migración.
--   * Reglas 1, 2 y 3: idénticas a las vigentes.
--
-- Por qué por fecha y no por instante: `registrar_pago_manual` fija el
-- vencimiento en `now() + N meses`, así que la hora del día es arbitraria. Con
-- `acceso_pagado_hasta < now()` una cuenta que vence a las 00:30 se cortaría
-- ese mismo día a las 02:00 AR, y una que vence a las 23:50 tendría casi un día
-- más. Comparando fechas, todas tienen el mismo plazo: hasta el fin del día D.
--
-- Se conservan firma y atributos de la función actual: plpgsql, returns void,
-- SIN security definer, `set search_path = public`. La llama el job
-- `procesar-transiciones-suscripcion-diario` (pg_cron, 05:00 UTC), que corre con
-- el rol del job y no depende de los grants de `authenticated`.
--
-- No toca RLS, policies, el webhook de Mercado Pago ni otros crons. Los grants
-- de la función se conservan con `create or replace`.
--
-- Idempotente.

begin;

create or replace function public.procesar_transiciones_suscripcion()
returns void
language plpgsql
set search_path = public
as $$
begin
  -- 1) Gracia agotada (Mercado Pago): el cobro falló hace más de un día y no se
  --    recuperó. Sin cambios.
  update inmobiliarias
     set estado_suscripcion = 'VENCIDA'
   where estado_suscripcion = 'GRACIA'
     and fecha_ultimo_pago_fallido < now() - interval '1 day';

  -- 2) Trial terminado sin haber contratado. Sin cambios.
  update inmobiliarias
     set estado_suscripcion = 'VENCIDA'
   where estado_suscripcion = 'TRIAL'
     and fecha_fin_trial < now();

  -- 3) Baja pedida que llegó a su fecha de corte: el período pago terminó.
  --    Sin cambios.
  update inmobiliarias
     set estado_suscripcion = 'CANCELADA'
   where estado_suscripcion = 'ACTIVA'
     and cancelacion_solicitada = true
     and fecha_proximo_cobro < now();

  -- 4) Cuenta manual cuyo día de vencimiento ya pasó: pierde el acceso
  --    directamente (no hay gracia). Se compara el DÍA en hora de Argentina: el
  --    día D de vencimiento entra completo y el corte llega con la corrida de
  --    las 05:00 UTC (02:00 AR) del día D+1.
  update inmobiliarias
     set estado_suscripcion = 'VENCIDA'
   where metodo_cobro = 'MANUAL'
     and estado_suscripcion = 'ACTIVA'
     and (acceso_pagado_hasta at time zone 'America/Argentina/Buenos_Aires')::date
         < (now() at time zone 'America/Argentina/Buenos_Aires')::date;

  -- 5) Cuenta manual que había quedado en GRACIA con el esquema anterior: se
  --    vence ya, sin esperar los 3 días. Después de aplicar esta migración
  --    ninguna regla vuelve a dejar una cuenta manual en GRACIA.
  update inmobiliarias
     set estado_suscripcion = 'VENCIDA'
   where metodo_cobro = 'MANUAL'
     and estado_suscripcion = 'GRACIA';
end;
$$;

-- Nadie la llama desde el navegador ni desde una Edge Function (verificado con
-- grep sobre src/ y supabase/functions/): sólo la ejecuta el job de pg_cron.
-- Ya está revocado en producción; se repite acá para dejar el repo sincronizado.
-- REVOKE de un privilegio que el rol no tiene no falla.
revoke execute on function public.procesar_transiciones_suscripcion() from public, anon, authenticated;

commit;
