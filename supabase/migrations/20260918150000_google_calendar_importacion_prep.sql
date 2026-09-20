-- Google Calendar Fase 2 (importar Google -> LeadEra): preparación del schema.
--
-- Sólo prepara el terreno. No crea la función de importación ni el cron: esos
-- van en su propia migración, cuando la función exista y esté desplegada.
--
-- Idempotente: se puede correr más de una vez sin romper ni duplicar nada.

-- ---------------------------------------------------------------------------
-- 1. pg_trgm, para el match difuso de direcciones
-- ---------------------------------------------------------------------------
-- En `extensions`, como el resto de las extensiones del proyecto (pg_net,
-- pgcrypto). Ese schema ya está en el search_path de los roles de la API.
create extension if not exists pg_trgm with schema extensions;

-- Índice de trigramas sobre la dirección: la importación compara cada evento
-- "Visita: ..." contra las propiedades de la inmobiliaria del agente. Con
-- pocas propiedades no hace falta, pero sin él cada comparación recorre la
-- tabla entera y el costo crece con la cartera.
create index if not exists propiedades_direccion_trgm_idx
  on public.propiedades
  using gin (lower(direccion) extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- 2. Índices sobre google_event_id
-- ---------------------------------------------------------------------------
-- Únicos por (asignado_a, google_event_id) y no por el id solo: un evento con
-- invitados tiene el MISMO id en el calendario de cada invitado, así que dos
-- agentes invitados a la misma reunión lo importarían legítimamente cada uno.
-- Por agente sí tiene que ser único: es lo que hace que una corrida repetida
-- o dos corridas pisándose no dupliquen la importación.
--
-- Parciales: la mayoría de las filas no tiene evento en Google.
--
-- Verificado antes de escribir esto: hoy no hay duplicados en ninguna de las
-- dos tablas, así que el índice se crea sin conflicto.
create unique index if not exists tareas_asignado_google_event_uidx
  on public.tareas (asignado_a, google_event_id)
  where google_event_id is not null;

create unique index if not exists visitas_asignado_google_event_uidx
  on public.visitas (asignado_a, google_event_id)
  where google_event_id is not null;

-- ---------------------------------------------------------------------------
-- 3. Origen de la importación
-- ---------------------------------------------------------------------------
-- null = creado en LeadEra (todo lo que existe hoy).
-- 'google_calendar' = lo trajo la importación de Fase 2.
--
-- Distinto de `google_event_id`: ese sólo dice "está vinculado a un evento",
-- y lo tienen tanto lo que LeadEra empujó como lo que se importó.
alter table public.tareas
  add column if not exists origen_importacion text;

alter table public.visitas
  add column if not exists origen_importacion text;

-- CHECK aparte del ADD COLUMN para que re-correr la migración no falle por
-- una constraint que ya existe.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tareas_origen_importacion_check'
  ) then
    alter table public.tareas
      add constraint tareas_origen_importacion_check
      check (origen_importacion in ('google_calendar'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'visitas_origen_importacion_check'
  ) then
    alter table public.visitas
      add constraint visitas_origen_importacion_check
      check (origen_importacion in ('google_calendar'));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Estado de la sincronización incremental
-- ---------------------------------------------------------------------------
-- El patrón de Google (events.list):
--   - La primera corrida lista con una ventana de fechas y, al terminar la
--     última página, Google devuelve un `nextSyncToken`.
--   - Las siguientes mandan sólo `syncToken` y reciben lo que cambió.
--   - Si Google responde 410 Gone el token caducó: se borra y se vuelve a
--     hacer la corrida completa.
-- Por eso alcanza con guardar el token; el resto son datos para diagnosticar.
alter table public.google_calendar_tokens
  add column if not exists sync_token text,
  -- Cuándo terminó bien la última importación de esta cuenta.
  add column if not exists importacion_ultima_at timestamptz,
  -- Último error de importación, o null si la última salió bien. Para ver
  -- desde el SQL Editor qué cuenta está fallando sin ir a los logs.
  add column if not exists importacion_ultimo_error text;

-- Si el agente reconecta con OTRA cuenta de Google, el sync_token viejo es de
-- otro calendario y no sirve. Desconectar borra la fila (y con ella el token),
-- pero reconectar después de un `conectado = false` —permiso revocado desde
-- Google— hace UPDATE sobre la fila que quedó (google-oauth-callback). Como
-- `prompt=consent` hace que cada autorización traiga un refresh_token nuevo,
-- que cambie es la señal de "reconectó, quizás con otra cuenta".
create or replace function public.google_calendar_tokens_limpiar_sync()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.refresh_token is distinct from old.refresh_token
     or new.google_calendar_id is distinct from old.google_calendar_id then
    new.sync_token := null;
  end if;
  return new;
end $$;

drop trigger if exists google_calendar_tokens_limpiar_sync on public.google_calendar_tokens;
create trigger google_calendar_tokens_limpiar_sync
  before update on public.google_calendar_tokens
  for each row
  execute function public.google_calendar_tokens_limpiar_sync();
