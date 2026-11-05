-- Suscripciones Web Push: una fila por dispositivo (endpoint) y usuario.
--
-- Cada navegador que acepta notificaciones devuelve una suscripción
-- (endpoint + claves p256dh/auth). La Edge Function que envía los avisos las
-- lee con la service role. Un mismo usuario puede tener varias (celular,
-- compu), así que la clave natural es el endpoint, no el usuario.
--
-- Las escrituras van sólo por registrar_push_suscripcion(): el usuario no
-- inserta ni actualiza directo. Así el user_id y la inmobiliaria salen de la
-- sesión y no del cliente, y un endpoint ya registrado por otro usuario del
-- mismo navegador se reasigna al usuario actual en vez de duplicarse o fallar.
--
-- RLS activado con policies sólo de SELECT y DELETE propios (para que el
-- usuario vea y dé de baja sus dispositivos). No toca ninguna otra tabla,
-- RLS ni policy existente.
--
-- Idempotente.

begin;

create table if not exists public.push_suscripciones (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  inmobiliaria_id uuid not null references public.inmobiliarias(id) on delete cascade,
  endpoint        text not null,
  p256dh          text not null,
  auth            text not null,
  user_agent      text,
  created_at      timestamptz not null default now(),
  last_seen_at    timestamptz not null default now(),
  constraint push_suscripciones_endpoint_key unique (endpoint)
);

create index if not exists push_suscripciones_user_id_idx
  on public.push_suscripciones (user_id);

comment on table public.push_suscripciones is
  'Suscripciones Web Push, una por dispositivo. Se escriben sólo con registrar_push_suscripcion(); las lee la Edge Function con service role.';
comment on column public.push_suscripciones.user_id is
  'Usuario dueño del dispositivo. Si el navegador cambia de usuario, la RPC reasigna la fila.';
comment on column public.push_suscripciones.inmobiliaria_id is
  'Cuenta del usuario al registrar. Se toma de profiles, no del cliente.';
comment on column public.push_suscripciones.endpoint is
  'URL del servicio push del navegador (FCM, Mozilla, Apple). Única por dispositivo.';
comment on column public.push_suscripciones.p256dh is
  'Clave pública ECDH P-256 de la suscripción, base64url.';
comment on column public.push_suscripciones.auth is
  'Secreto de autenticación de la suscripción, base64url.';
comment on column public.push_suscripciones.user_agent is
  'User agent al registrar, recortado a 300 caracteres. Sólo para identificar el dispositivo.';
comment on column public.push_suscripciones.last_seen_at is
  'Último registro de este dispositivo (la app vuelve a registrar al abrirse).';

alter table public.push_suscripciones enable row level security;

-- El grant por defecto de Supabase abre todo a anon y authenticated. Se corta y
-- se vuelve a dar sólo lo necesario: sin INSERT ni UPDATE.
revoke all on table public.push_suscripciones from anon, authenticated;
grant select, delete on table public.push_suscripciones to authenticated;

-- `(select auth.uid())`: se evalúa una vez por consulta, no por fila.
drop policy if exists push_suscripciones_select_propio on public.push_suscripciones;
create policy push_suscripciones_select_propio
  on public.push_suscripciones
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists push_suscripciones_delete_propio on public.push_suscripciones;
create policy push_suscripciones_delete_propio
  on public.push_suscripciones
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- Es SECURITY DEFINER porque authenticated no tiene INSERT ni UPDATE sobre la
-- tabla: la RPC es la única vía de escritura y por eso puede reasignar un
-- endpoint que hoy figura a nombre de otro usuario (RLS no se lo dejaría ver).
-- search_path vacío y todo calificado, mismo patrón que private.my_es_superadmin().
create or replace function public.registrar_push_suscripcion(
  p_endpoint   text,
  p_p256dh     text,
  p_auth       text,
  p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid             uuid := auth.uid();
  v_inmobiliaria_id uuid;
  v_host            text;
  -- Servicios push permitidos. Sin punto inicial: host exacto. Con punto
  -- inicial: cualquier subdominio de ese dominio (el dominio pelado no entra).
  -- Para agregar un servicio nuevo, sumar un elemento acá y volver a
  -- ejecutar esta migración (create or replace).
  v_hosts_permitidos constant text[] := array[
    'fcm.googleapis.com',
    '.push.services.mozilla.com',
    '.push.apple.com',
    '.notify.windows.com'
  ];
begin
  if v_uid is null then
    raise exception 'No autenticado' using errcode = '28000';
  end if;

  if p_endpoint is null or p_endpoint !~ '^https://' or length(p_endpoint) > 2048 then
    raise exception 'endpoint inválido' using errcode = '22023';
  end if;

  -- Host por lista blanca de caracteres, no por lista negra: tiene que empezar
  -- con letra o número y sólo admite [a-z0-9.-]; después de "https://host" sólo
  -- puede venir el puerto 443 explícito y luego "/", "?", "#" o el fin. Cualquier
  -- otro carácter ("\", "@", espacios, otro puerto) no coincide y se rechaza,
  -- porque los parsers de URL los interpretan distinto que esta regex. La
  -- comparación es exacta o por sufijo con punto, así que
  -- fcm.googleapis.com.evil.com no pasa.
  v_host := substring(lower(p_endpoint) from '^https://([a-z0-9][a-z0-9.-]*)(?::443)?(?:[/?#]|$)');
  if v_host is null or not exists (
    select 1
      from unnest(v_hosts_permitidos) as h
     where v_host = h
        or (left(h, 1) = '.' and right(v_host, length(h)) = h)
  ) then
    raise exception 'endpoint de un servicio push no permitido' using errcode = '22023';
  end if;

  if p_p256dh is null or length(p_p256dh) not between 1 and 256 then
    raise exception 'p256dh inválido' using errcode = '22023';
  end if;
  if p_auth is null or length(p_auth) not between 1 and 128 then
    raise exception 'auth inválido' using errcode = '22023';
  end if;

  select p.inmobiliaria_id
    into v_inmobiliaria_id
    from public.profiles p
   where p.id = v_uid
     and p.activo;

  if v_inmobiliaria_id is null then
    raise exception 'Perfil no encontrado o inactivo' using errcode = '42501';
  end if;

  insert into public.push_suscripciones
    (user_id, inmobiliaria_id, endpoint, p256dh, auth, user_agent)
  values
    (v_uid, v_inmobiliaria_id, p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set user_id         = excluded.user_id,
        inmobiliaria_id = excluded.inmobiliaria_id,
        p256dh          = excluded.p256dh,
        auth            = excluded.auth,
        user_agent      = excluded.user_agent,
        last_seen_at    = now();
end;
$$;

comment on function public.registrar_push_suscripcion(text, text, text, text) is
  'Alta o renovación de la suscripción push del dispositivo actual. Usuario e inmobiliaria salen de la sesión; si el endpoint ya existía a nombre de otro usuario, se reasigna.';

revoke all on function public.registrar_push_suscripcion(text, text, text, text) from public, anon;
grant execute on function public.registrar_push_suscripcion(text, text, text, text) to authenticated;

commit;
