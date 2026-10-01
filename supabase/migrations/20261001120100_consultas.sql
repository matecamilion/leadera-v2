-- ============================================================================
-- Links de consulta — tablas, RLS y RPCs (Etapa 1)
--
-- Por qué: el asesor publica un link de Leadera (general o de una propiedad).
-- Quien consulta completa una encuesta corta y la consulta cae en una sala de
-- espera (`consultas`), separada de `leads`. Solo pasa a `leads` lo que se
-- acepta (a mano o automático por puntaje), así que lo descartado nunca toca la
-- lista, las métricas ni el límite del plan.
--
-- 0. Precondiciones: que corrió 20261001120000_consultas_enum.sql y que no hay
--    restos de un intento anterior.
-- 1. Enum estado_consulta.
-- 2. links_consulta: un link general por agente y uno por (agente, propiedad).
-- 3. consultas: la sala de espera.
-- 4. RLS y grants. Ni `anon` ni `authenticated` insertan: las consultas las
--    escribe la edge function `consulta-publica` con service_role, y los
--    cambios de estado van por las RPCs de abajo.
-- 5. RPCs:
--    - consulta_crear_lead (interna, solo service_role y las RPCs de abajo):
--      crea el lead + búsqueda sugerida. El límite del plan NO se calcula
--      acá: lo hace cumplir el trigger leads_verificar_limite (BEFORE INSERT,
--      P0001). Si salta, la consulta queda PENDIENTE con el motivo guardado.
--    - aceptar_consulta / descartar_consulta / vincular_consulta: para la
--      bandeja.
--    - mi_link_consulta: devuelve (o crea) el link del agente.
-- 6. Verificación final: aborta si anon quedó con algún privilegio.
--
-- Lo que NO hace, a propósito:
--   - No inserta en `interacciones`. El trigger actualizar_fechas_contacto()
--     escribe fecha_primer/ultimo_contacto_real en cualquier insert ahí, sin
--     filtrar por tipo, y "Contactados hoy" y el reporte semanal cuentan
--     interacciones. Una consulta no es contacto real. La consulta misma (con
--     su lead_id) es el registro.
--   - No detecta duplicados: eso lo hace la edge function al recibir la
--     consulta (teléfono normalizado y, si no hay match, lower(email) dentro de
--     la inmobiliaria). Acá solo se guardan lead_existente_id, duplicado_por y
--     duplicado_otro_agente.
--   - El lead nace con `estado` NULL (Nuevo), igual que crearLead(). La
--     temperatura de la encuesta queda en `consultas`.
--
-- SECURITY DEFINER con search_path vacío y todo calificado con esquema, mismo
-- patrón que private.my_es_superadmin().
-- ============================================================================

begin;

-- 0. Precondiciones -----------------------------------------------------------

do $$
begin
  if not exists (
    select 1
      from pg_enum e
      join pg_type t on t.oid = e.enumtypid
     where t.typname = 'origen_lead'
       and e.enumlabel = 'LINK_CONSULTA'
  ) then
    raise exception
      'ABORTADO: falta origen_lead.LINK_CONSULTA. Correr antes 20261001120000_consultas_enum.sql.';
  end if;

  -- La policy de consultas usa estos helpers, igual que las de leads.
  if to_regprocedure('private.my_inmobiliaria_id()') is null
     or to_regprocedure('private.my_rol()') is null
     or to_regprocedure('private.my_asiste_a()') is null then
    raise exception
      'ABORTADO: falta private.my_inmobiliaria_id(), my_rol() o my_asiste_a().';
  end if;

  -- consulta_crear_lead delega el límite del plan en este trigger.
  if not exists (
    select 1 from pg_trigger t
     where t.tgrelid = 'public.leads'::regclass
       and t.tgname = 'leads_verificar_limite'
       and not t.tgisinternal
  ) then
    raise exception
      'ABORTADO: falta el trigger leads_verificar_limite en public.leads; sin él no hay tope de leads.';
  end if;

  if to_regclass('public.consultas') is not null
     or to_regclass('public.links_consulta') is not null
     or to_regtype('public.estado_consulta') is not null then
    raise exception 'ABORTADO: ya existen objetos de consultas de un intento anterior.';
  end if;
end
$$;

-- 1. Enum ---------------------------------------------------------------------

create type public.estado_consulta as enum (
  'PENDIENTE',      -- en la bandeja
  'AUTO_ACEPTADA',  -- pasó sola a leads por puntaje
  'ACEPTADA',       -- la aceptó alguien desde la bandeja
  'DESCARTADA',
  'VINCULADA'       -- el teléfono o el email ya eran un lead: se colgó de ese lead
);

-- 2. links_consulta -----------------------------------------------------------

create table public.links_consulta (
  id              uuid primary key default gen_random_uuid(),
  inmobiliaria_id uuid not null references public.inmobiliarias (id) on delete cascade,
  agente_id       uuid not null references public.profiles (id) on delete cascade,
  -- null = link general del agente
  propiedad_id    uuid references public.propiedades (id) on delete cascade,
  -- 12 hex de un uuid v4: ~2.8e14 combinaciones, no adivinable a mano.
  slug            text not null unique
                  default substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
  activo          boolean not null default true,
  -- Preguntas opcionales apagadas por el agente.
  preguntas_off   text[] not null default '{}',
  visitas         integer not null default 0,
  created_at      timestamptz not null default now(),

  constraint links_consulta_slug_formato
    check (slug ~ '^[a-z0-9]{8,32}$'),
  constraint links_consulta_preguntas_off_validas
    check (preguntas_off <@ array['visita', 'vender', 'email']::text[])
);

comment on table public.links_consulta is
  'Links públicos de consulta (/c/:slug). Uno general por agente y uno por (agente, propiedad). Se crean con mi_link_consulta().';

create unique index links_consulta_general_unico
  on public.links_consulta (agente_id)
  where propiedad_id is null;

create unique index links_consulta_propiedad_unico
  on public.links_consulta (agente_id, propiedad_id)
  where propiedad_id is not null;

create index links_consulta_inmobiliaria_idx
  on public.links_consulta (inmobiliaria_id);

-- 3. consultas ----------------------------------------------------------------

create table public.consultas (
  id                     uuid primary key default gen_random_uuid(),
  link_id                uuid references public.links_consulta (id) on delete set null,
  inmobiliaria_id        uuid not null references public.inmobiliarias (id) on delete cascade,
  -- El agente del link: a quien se asigna el lead si se acepta.
  agente_id              uuid not null references public.profiles (id),
  propiedad_id           uuid references public.propiedades (id) on delete set null,

  nombre                 text not null,
  apellido               text,
  telefono               text not null,
  -- Normalizado como normalizarTelefonoAR() (src/lib/telefono.ts).
  telefono_norm          text not null,
  email                  text,

  respuestas             jsonb not null default '{}'::jsonb,
  -- Texto legible armado por la edge function; va a leads.descripcion_inicial.
  resumen                text,
  -- {tipo_propiedad, zona, precio_min, precio_max, notas} o null. Si viene, al
  -- aceptar se crea la búsqueda del lead.
  busqueda               jsonb,

  puntaje                integer not null,
  temperatura            public.estado_lead not null,
  presupuesto_respondido boolean not null,
  posible_captacion      boolean not null default false,

  estado                 public.estado_consulta not null default 'PENDIENTE',
  -- El lead que resultó (aceptada) o al que se colgó (vinculada).
  lead_id                uuid references public.leads (id) on delete set null,
  -- Lead con el mismo teléfono (o, si no hubo match, el mismo email) que ya
  -- existía en la inmobiliaria al entrar la consulta.
  lead_existente_id      uuid references public.leads (id) on delete set null,
  -- Por qué dato se encontró lead_existente_id.
  duplicado_por          text,
  -- El lead existente es de OTRO agente: solo la ve y la resuelve el DUEÑO.
  duplicado_otro_agente  boolean not null default false,
  -- El lead existente estaba FRIO o INACTIVO: la bandeja la destaca.
  volvio_a_consultar     boolean not null default false,

  motivo_descarte        text,
  -- Por qué un intento de alta falló y la consulta sigue PENDIENTE (hoy: el
  -- mensaje de leads_verificar_limite). Se limpia al resolverse.
  aviso_pendiente        text,
  consentimiento_at      timestamptz not null,
  -- sha256(CONSULTA_IP_SALT || ip), en hex. Solo para rate limit.
  ip_hash                text,
  created_at             timestamptz not null default now(),
  resuelta_at            timestamptz,
  resuelta_por           uuid references public.profiles (id) on delete set null,

  constraint consultas_nombre_largo
    check (char_length(btrim(nombre)) between 1 and 80),
  constraint consultas_apellido_largo
    check (apellido is null or char_length(apellido) <= 80),
  constraint consultas_telefono_largo
    check (char_length(telefono) <= 40),
  constraint consultas_telefono_norm_formato
    check (telefono_norm ~ '^[0-9]{8,15}$'),
  constraint consultas_email_largo
    check (email is null or char_length(email) <= 254),
  constraint consultas_respuestas_objeto
    check (jsonb_typeof(respuestas) = 'object' and pg_column_size(respuestas) < 8192),
  constraint consultas_busqueda_objeto
    check (busqueda is null or jsonb_typeof(busqueda) = 'object'),
  constraint consultas_resumen_largo
    check (resumen is null or char_length(resumen) <= 2000),
  constraint consultas_motivo_largo
    check (motivo_descarte is null or char_length(motivo_descarte) <= 300),
  constraint consultas_aviso_largo
    check (aviso_pendiente is null or char_length(aviso_pendiente) <= 500),
  constraint consultas_duplicado_por_valido
    check (duplicado_por is null or duplicado_por in ('TELEFONO', 'EMAIL')),
  constraint consultas_temperatura_encuesta
    check (temperatura in ('CALIENTE', 'TIBIO', 'FRIO')),
  constraint consultas_ip_hash_formato
    check (ip_hash is null or ip_hash ~ '^[0-9a-f]{64}$'),
  -- Sin presupuesto no hay pase automático, sin importar el puntaje.
  constraint consultas_auto_requiere_presupuesto
    check (estado <> 'AUTO_ACEPTADA' or presupuesto_respondido),
  -- Pendiente <=> sin resolver.
  constraint consultas_resolucion_coherente
    check ((estado = 'PENDIENTE') = (resuelta_at is null))
);

comment on table public.consultas is
  'Sala de espera de consultas entrantes por links_consulta. Las escribe la edge function consulta-publica (service_role); se resuelven con aceptar_consulta / descartar_consulta / vincular_consulta.';

-- Bandeja del agente y badge de pendientes.
create index consultas_agente_estado_idx
  on public.consultas (agente_id, estado, created_at desc);
-- Bandeja del dueño.
create index consultas_inmobiliaria_estado_idx
  on public.consultas (inmobiliaria_id, estado, created_at desc);
-- Rate limit.
create index consultas_ip_hash_idx
  on public.consultas (ip_hash, created_at desc)
  where ip_hash is not null;
-- Repetidas del mismo teléfono.
create index consultas_telefono_idx
  on public.consultas (inmobiliaria_id, telefono_norm);
-- Respuestas originales en DetalleLead.
create index consultas_lead_idx
  on public.consultas (lead_id)
  where lead_id is not null;

-- 4. RLS y grants -------------------------------------------------------------

alter table public.links_consulta enable row level security;
alter table public.consultas      enable row level security;

revoke all on table public.links_consulta from anon, authenticated;
revoke all on table public.consultas      from anon, authenticated;

-- links_consulta: se lee; solo se pueden tocar los toggles. El alta va por
-- mi_link_consulta().
grant select on table public.links_consulta to authenticated;
grant update (activo, preguntas_off) on table public.links_consulta to authenticated;

-- consultas: solo lectura, y sin ip_hash.
grant select (
  id, link_id, inmobiliaria_id, agente_id, propiedad_id,
  nombre, apellido, telefono, telefono_norm, email,
  respuestas, resumen, busqueda,
  puntaje, temperatura, presupuesto_respondido, posible_captacion,
  estado, lead_id, lead_existente_id, duplicado_por, duplicado_otro_agente,
  volvio_a_consultar, motivo_descarte, aviso_pendiente,
  consentimiento_at, created_at, resuelta_at, resuelta_por
) on table public.consultas to authenticated;

-- `(select ...)` entre paréntesis: se evalúa una vez por consulta (InitPlan),
-- no una vez por fila. Mismo criterio que 20260922120000_superadmin_lectura.

create policy links_consulta_select
  on public.links_consulta
  for select
  to authenticated
  using (
    inmobiliaria_id = (select private.my_inmobiliaria_id())
    and (
      agente_id = (select auth.uid())
      or (select private.my_rol())::text = 'DUENO'
    )
  );

create policy links_consulta_update_propio
  on public.links_consulta
  for update
  to authenticated
  using (
    inmobiliaria_id = (select private.my_inmobiliaria_id())
    and agente_id = (select auth.uid())
  )
  with check (
    inmobiliaria_id = (select private.my_inmobiliaria_id())
    and agente_id = (select auth.uid())
  );

-- Mismo patrón que las policies de leads:
--   DUEÑO: todas las de su inmobiliaria.
--   Agente: las suyas. Asistente: las del agente al que asiste
--   (private.my_asiste_a()).
-- Más: los duplicados de otro agente solo los ve el DUEÑO.
create policy consultas_select
  on public.consultas
  for select
  to authenticated
  using (
    inmobiliaria_id = (select private.my_inmobiliaria_id())
    and (
      (select private.my_rol())::text = 'DUENO'
      or (
        not duplicado_otro_agente
        and (
          agente_id = (select auth.uid())
          or agente_id = (select private.my_asiste_a())
        )
      )
    )
  );

-- 5. RPCs ---------------------------------------------------------------------

-- 5.1 Interna: crea el lead a partir de una consulta PENDIENTE.
--
-- resultado:
--   'OK'               lead creado; lead_id viene cargado
--   'LIMITE_ALCANZADO' el insert en leads lanzó P0001 (leads_verificar_limite);
--                      queda PENDIENTE con el mensaje en aviso_pendiente
--   'YA_RESUELTA'      la consulta ya no estaba PENDIENTE; lead_id = el que tenga
--
-- El límite no se cuenta acá: se intenta el insert y se atrapa lo que lance el
-- trigger. Ojo: P0001 es el código por defecto de cualquier RAISE EXCEPTION,
-- así que si mañana otro trigger BEFORE INSERT de leads lanza sin errcode
-- propio, también cae acá. Por eso se guarda el mensaje real (SQLERRM) y no un
-- texto fijo.
--
-- Una unique_violation (email repetido en la inmobiliaria, índice
-- leads_email_unico_por_inmobiliaria) NO se atrapa: la edge function ya buscó
-- duplicados por email al recibir la consulta, así que solo puede pasar si
-- alguien cargó ese email entre la llegada y la aceptación. En ese caso la
-- transacción entera se revierte y la consulta sigue PENDIENTE.
--
-- No valida quién llama: eso lo hacen aceptar_consulta (authenticated) y la
-- edge function (service_role). Por eso nadie más la puede ejecutar.
create function public.consulta_crear_lead(
  p_consulta_id uuid,
  p_estado      public.estado_consulta
)
returns table (resultado text, lead_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  c      public.consultas%rowtype;
  v_lead uuid;
  v_msg  text;
begin
  if p_estado not in ('ACEPTADA', 'AUTO_ACEPTADA') then
    raise exception 'Estado inválido para crear lead: %', p_estado
      using errcode = '22023';
  end if;

  select * into c
    from public.consultas
   where id = p_consulta_id
     for update;

  if not found then
    raise exception 'Consulta inexistente.' using errcode = 'P0002';
  end if;

  if c.estado <> 'PENDIENTE' then
    resultado := 'YA_RESUELTA';
    lead_id   := c.lead_id;
    return next;
    return;
  end if;

  begin
    -- `estado` NO se manda: nace en NULL ("Nuevo"), igual que crearLead().
    -- agente_id = el agente del link, mismo campo que llena crearLead().
    insert into public.leads (
      inmobiliaria_id, agente_id, nombre, apellido, telefono, email,
      origen, descripcion_inicial
    ) values (
      c.inmobiliaria_id, c.agente_id, btrim(c.nombre), nullif(btrim(c.apellido), ''),
      btrim(c.telefono), nullif(btrim(c.email), ''),
      'LINK_CONSULTA', c.resumen
    )
    returning id into v_lead;
  exception
    -- leads_verificar_limite. El bloque revierte solo el insert; el lock
    -- sobre la consulta sigue tomado y el update de abajo se guarda.
    when sqlstate 'P0001' then
      v_msg := left(sqlerrm, 500);

      update public.consultas
         set aviso_pendiente = v_msg
       where id = c.id;

      resultado := 'LIMITE_ALCANZADO';
      lead_id   := null;
      return next;
      return;
  end;

  if c.busqueda is not null then
    insert into public.busquedas (
      inmobiliaria_id, lead_id, agente_id,
      tipo_propiedad, zona, precio_min, precio_max, notas
    ) values (
      c.inmobiliaria_id, v_lead, c.agente_id,
      (c.busqueda ->> 'tipo_propiedad')::public.tipo_propiedad,
      nullif(c.busqueda ->> 'zona', ''),
      (c.busqueda ->> 'precio_min')::numeric,
      (c.busqueda ->> 'precio_max')::numeric,
      nullif(c.busqueda ->> 'notas', '')
    );
  end if;

  update public.consultas
     set estado          = p_estado,
         lead_id         = v_lead,
         aviso_pendiente = null,
         resuelta_at     = now(),
         resuelta_por    = auth.uid()   -- null en el pase automático
   where id = c.id;

  resultado := 'OK';
  lead_id   := v_lead;
  return next;
end;
$$;

comment on function public.consulta_crear_lead(uuid, public.estado_consulta) is
  'Interna: crea lead (estado NULL, origen LINK_CONSULTA, agente del link) + búsqueda sugerida desde una consulta PENDIENTE. Si leads_verificar_limite lanza P0001, la deja PENDIENTE con aviso_pendiente. Solo service_role y las RPCs de la bandeja.';

-- 5.2 Helper de permisos de la bandeja.
--
-- Devuelve la consulta bloqueada (FOR UPDATE) si quien llama la puede
-- resolver; si no, error. Mismo alcance que la policy consultas_select.
create function public.consulta_para_resolver(p_consulta_id uuid)
returns public.consultas
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  me    record;
  c     public.consultas%rowtype;
begin
  if v_uid is null then
    raise exception 'Sesión requerida.' using errcode = '42501';
  end if;

  select p.rol::text as rol, p.inmobiliaria_id, p.asiste_a, p.activo
    into me
    from public.profiles p
   where p.id = v_uid;

  if not found or not me.activo then
    raise exception 'Usuario inactivo.' using errcode = '42501';
  end if;

  select * into c
    from public.consultas
   where id = p_consulta_id
     for update;

  -- Otra inmobiliaria se reporta igual que inexistente: no se revela nada.
  if not found or c.inmobiliaria_id <> me.inmobiliaria_id then
    raise exception 'Consulta inexistente.' using errcode = 'P0002';
  end if;

  if me.rol <> 'DUENO' then
    if c.duplicado_otro_agente
       or (c.agente_id <> v_uid and c.agente_id is distinct from me.asiste_a) then
      raise exception 'Consulta inexistente.' using errcode = 'P0002';
    end if;
  end if;

  if c.estado <> 'PENDIENTE' then
    raise exception 'La consulta ya fue resuelta.' using errcode = '55000';
  end if;

  return c;
end;
$$;

comment on function public.consulta_para_resolver(uuid) is
  'Interna: valida que el usuario logueado pueda resolver la consulta y la devuelve bloqueada.';

-- 5.3 Aceptar desde la bandeja.
create function public.aceptar_consulta(p_consulta_id uuid)
returns table (resultado text, lead_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  c public.consultas%rowtype;
begin
  c := public.consulta_para_resolver(p_consulta_id);

  -- Un duplicado de otro agente no se convierte en un segundo lead: se vincula
  -- al existente o se descarta.
  if c.duplicado_otro_agente then
    raise exception 'Es un lead existente de otro agente: vinculala o descartala.'
      using errcode = '22023';
  end if;

  return query
    select r.resultado, r.lead_id
      from public.consulta_crear_lead(p_consulta_id, 'ACEPTADA') r;
end;
$$;

comment on function public.aceptar_consulta(uuid) is
  'Bandeja: acepta una consulta PENDIENTE y crea el lead. resultado: OK | LIMITE_ALCANZADO.';

-- 5.4 Descartar.
create function public.descartar_consulta(
  p_consulta_id uuid,
  p_motivo      text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c public.consultas%rowtype;
begin
  c := public.consulta_para_resolver(p_consulta_id);

  update public.consultas
     set estado          = 'DESCARTADA',
         motivo_descarte = left(nullif(btrim(p_motivo), ''), 300),
         resuelta_at     = now(),
         resuelta_por    = auth.uid()
   where id = c.id;
end;
$$;

comment on function public.descartar_consulta(uuid, text) is
  'Bandeja: descarta una consulta PENDIENTE, con motivo opcional.';

-- 5.5 Vincular un duplicado de otro agente al lead existente (solo DUEÑO).
create function public.vincular_consulta(p_consulta_id uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c public.consultas%rowtype;
begin
  c := public.consulta_para_resolver(p_consulta_id);

  -- consulta_para_resolver ya filtra: un no-DUEÑO nunca llega a ver un
  -- duplicado de otro agente. Igual se exige explícito.
  if (select p.rol::text from public.profiles p where p.id = auth.uid()) <> 'DUENO' then
    raise exception 'Solo el dueño puede vincular.' using errcode = '42501';
  end if;

  if not c.duplicado_otro_agente then
    raise exception 'Solo se vinculan duplicados de otro agente.' using errcode = '22023';
  end if;

  if c.lead_existente_id is null
     or not exists (
       select 1 from public.leads l
        where l.id = c.lead_existente_id
          and l.inmobiliaria_id = c.inmobiliaria_id
     ) then
    raise exception 'El lead existente ya no está.' using errcode = 'P0002';
  end if;

  update public.consultas
     set estado       = 'VINCULADA',
         lead_id      = c.lead_existente_id,
         resuelta_at  = now(),
         resuelta_por = auth.uid()
   where id = c.id;

  return c.lead_existente_id;
end;
$$;

comment on function public.vincular_consulta(uuid) is
  'Bandeja (solo DUEÑO): cuelga un duplicado de otro agente del lead existente. No inserta interacciones.';

-- 5.6 El link del agente: lo devuelve o lo crea.
--
-- Un asistente obtiene el link del agente al que asiste: los leads son de ese
-- agente.
create function public.mi_link_consulta(p_propiedad_id uuid default null)
returns public.links_consulta
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  me       record;
  v_agente uuid;
  r        public.links_consulta%rowtype;
begin
  if v_uid is null then
    raise exception 'Sesión requerida.' using errcode = '42501';
  end if;

  select p.rol::text as rol, p.inmobiliaria_id, p.asiste_a, p.activo
    into me
    from public.profiles p
   where p.id = v_uid;

  if not found or not me.activo then
    raise exception 'Usuario inactivo.' using errcode = '42501';
  end if;

  v_agente := case when me.rol = 'ASISTENTE' then me.asiste_a else v_uid end;
  if v_agente is null then
    raise exception 'El asistente no tiene agente asignado.' using errcode = '22023';
  end if;

  if p_propiedad_id is not null and not exists (
    select 1 from public.propiedades pr
     where pr.id = p_propiedad_id
       and pr.inmobiliaria_id = me.inmobiliaria_id
  ) then
    raise exception 'Propiedad inexistente.' using errcode = 'P0002';
  end if;

  if p_propiedad_id is null then
    insert into public.links_consulta (inmobiliaria_id, agente_id)
    values (me.inmobiliaria_id, v_agente)
    on conflict (agente_id) where propiedad_id is null do nothing;

    select * into r from public.links_consulta l
     where l.agente_id = v_agente and l.propiedad_id is null;
  else
    insert into public.links_consulta (inmobiliaria_id, agente_id, propiedad_id)
    values (me.inmobiliaria_id, v_agente, p_propiedad_id)
    on conflict (agente_id, propiedad_id) where propiedad_id is not null do nothing;

    select * into r from public.links_consulta l
     where l.agente_id = v_agente and l.propiedad_id = p_propiedad_id;
  end if;

  return r;
end;
$$;

comment on function public.mi_link_consulta(uuid) is
  'Devuelve (o crea) el link de consulta del agente logueado: general (null) o de una propiedad de su inmobiliaria.';

-- Permisos de funciones ---------------------------------------------------------

revoke all on function public.consulta_crear_lead(uuid, public.estado_consulta) from public, anon, authenticated;
grant execute on function public.consulta_crear_lead(uuid, public.estado_consulta) to service_role;

revoke all on function public.consulta_para_resolver(uuid) from public, anon, authenticated;

revoke all on function public.aceptar_consulta(uuid) from public, anon;
grant execute on function public.aceptar_consulta(uuid) to authenticated;

revoke all on function public.descartar_consulta(uuid, text) from public, anon;
grant execute on function public.descartar_consulta(uuid, text) to authenticated;

revoke all on function public.vincular_consulta(uuid) from public, anon;
grant execute on function public.vincular_consulta(uuid) to authenticated;

revoke all on function public.mi_link_consulta(uuid) from public, anon;
grant execute on function public.mi_link_consulta(uuid) to authenticated;

-- 6. Verificación final ---------------------------------------------------------

do $$
declare
  t text;
  p text;
begin
  foreach t in array array['public.consultas', 'public.links_consulta'] loop
    foreach p in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE'] loop
      if has_table_privilege('anon', t, p) then
        raise exception 'ABORTADO: anon tiene % sobre %.', p, t;
      end if;
    end loop;
    if has_table_privilege('authenticated', t, 'INSERT')
       or has_table_privilege('authenticated', t, 'DELETE') then
      raise exception 'ABORTADO: authenticated puede insertar o borrar en %.', t;
    end if;
  end loop;

  if has_column_privilege('authenticated', 'public.consultas', 'ip_hash', 'SELECT') then
    raise exception 'ABORTADO: consultas.ip_hash quedó legible para authenticated.';
  end if;

  if has_function_privilege('authenticated', 'public.consulta_crear_lead(uuid, public.estado_consulta)', 'EXECUTE')
     or has_function_privilege('anon', 'public.consulta_crear_lead(uuid, public.estado_consulta)', 'EXECUTE') then
    raise exception 'ABORTADO: consulta_crear_lead quedó ejecutable desde el navegador.';
  end if;
end
$$;

commit;
