begin;

-- 1. Columna: qué seguimiento cumplió esta interacción (historial para el reporte)
alter table public.interacciones
  add column seguimiento_cumplido_fecha timestamptz null;

-- 2. Definición única de "contacto real"
create or replace function public.es_contacto_real(p_tipo public.tipo_interaccion)
returns boolean
language sql
immutable
set search_path = public
as $$
  select p_tipo in ('LLAMADA','WHATSAPP','EMAIL','VISITA','REUNION','SEGUIMIENTO');
$$;

-- 3. BEFORE INSERT: decide si la interacción cumple el seguimiento vigente
create or replace function public.interaccion_calcular_cumplimiento()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_tz  constant text := 'America/Argentina/Buenos_Aires';
  v_fps timestamptz;
begin
  -- Nunca se confía en lo que mande el cliente
  new.seguimiento_cumplido_fecha := null;

  if not public.es_contacto_real(new.tipo) then
    return new;
  end if;

  -- Lock del lead para evitar carreras entre interacciones simultáneas
  select fecha_proximo_seguimiento into v_fps
  from public.leads
  where id = new.lead_id
  for update;

  if v_fps is not null
     and (v_fps at time zone v_tz)::date <= (now() at time zone v_tz)::date
     and (new.fecha at time zone v_tz)::date >= (v_fps at time zone v_tz)::date
  then
    new.seguimiento_cumplido_fecha := v_fps;
  end if;

  return new;
end;
$$;

create trigger interacciones_calcular_cumplimiento
before insert on public.interacciones
for each row execute function public.interaccion_calcular_cumplimiento();

-- 4. AFTER INSERT: consume el seguimiento cumplido
create or replace function public.interaccion_consumir_seguimiento()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.seguimiento_cumplido_fecha is not null then
    update public.leads
    set fecha_proximo_seguimiento = null
    where id = new.lead_id
      and fecha_proximo_seguimiento = new.seguimiento_cumplido_fecha;
  end if;
  return new;
end;
$$;

create trigger interacciones_consumir_seguimiento
after insert on public.interacciones
for each row execute function public.interaccion_consumir_seguimiento();

-- 5. AFTER DELETE: si se borra la interacción que cumplió, se restaura
--    (solo si no se agendó otro seguimiento después)
create or replace function public.interaccion_restaurar_seguimiento()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.seguimiento_cumplido_fecha is not null then
    update public.leads
    set fecha_proximo_seguimiento = old.seguimiento_cumplido_fecha
    where id = old.lead_id
      and fecha_proximo_seguimiento is null;
  end if;
  return old;
end;
$$;

create trigger interacciones_restaurar_seguimiento
after delete on public.interacciones
for each row execute function public.interaccion_restaurar_seguimiento();

-- 6. Congelar la columna nueva en ediciones (+ search_path que faltaba)
create or replace function public.proteger_interaccion_estructura()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.lead_id is distinct from old.lead_id
     or new.agente_id is distinct from old.agente_id
     or new.operacion_id is distinct from old.operacion_id
     or new.created_at is distinct from old.created_at
  then
    raise exception 'No se puede reasignar una interacción a otro lead, agente u operación.';
  end if;

  if new.seguimiento_cumplido_fecha is distinct from old.seguimiento_cumplido_fecha then
    raise exception 'No se puede modificar el seguimiento cumplido de una interacción.';
  end if;

  return new;
end;
$$;

-- 7. RPC atómica: insertar interacción + agendar próxima fecha
create or replace function public.registrar_interaccion(
  p_lead_id             uuid,
  p_tipo                public.tipo_interaccion,
  p_detalle             text,
  p_operacion_id        uuid        default null,
  p_categoria           text        default null,
  p_fecha               timestamptz default null,
  p_proximo_seguimiento timestamptz default null
)
returns public.interacciones
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row public.interacciones;
begin
  insert into public.interacciones
    (lead_id, agente_id, tipo, detalle, operacion_id, categoria, fecha)
  values
    (p_lead_id, auth.uid(), p_tipo, p_detalle, p_operacion_id,
     case when p_tipo = 'REUNION' then p_categoria end,
     coalesce(p_fecha, now()))
  returning * into v_row;

  if p_proximo_seguimiento is not null then
    update public.leads
    set fecha_proximo_seguimiento = p_proximo_seguimiento
    where id = p_lead_id;

    if not found then
      raise exception 'No se pudo agendar el próximo seguimiento para este lead.';
    end if;
  end if;

  return v_row;
end;
$$;

revoke all on function public.registrar_interaccion(uuid, public.tipo_interaccion, text, uuid, text, timestamptz, timestamptz) from public, anon;
grant execute on function public.registrar_interaccion(uuid, public.tipo_interaccion, text, uuid, text, timestamptz, timestamptz) to authenticated;

commit;
