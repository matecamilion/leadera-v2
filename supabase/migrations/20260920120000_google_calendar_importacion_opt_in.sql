-- Google Calendar Fase 2: la importación es opt-in por cuenta.
--
-- El cron recorre todas las cuentas conectadas, y la primera corrida de una
-- cuenta trae TODO su calendario de los próximos 90 días: también lo personal,
-- que no tiene nada que ver con la inmobiliaria. Prenderle eso a alguien sin
-- que lo haya pedido le llena la agenda de LeadEra con su vida privada.
--
-- Por eso arranca apagada y se prende cuenta por cuenta:
--   update google_calendar_tokens set importacion_activa = true
--   where agente_id = (select id from profiles where email = '<agente>');
--
-- Conectar Google (Fase 1, el push LeadEra -> Google) sigue funcionando igual:
-- esta bandera sólo gobierna la dirección inversa.
alter table public.google_calendar_tokens
  add column if not exists importacion_activa boolean not null default false;
