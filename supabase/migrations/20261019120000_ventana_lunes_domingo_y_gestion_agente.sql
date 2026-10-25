-- YA APLICADA EN PRODUCCION el 19/10/2026 via SQL Editor. Este archivo solo alinea el repo. No re-ejecutar manualmente.

begin;

create or replace function public.ventana_gestion(p_periodo text, p_referencia date)
 returns table(inicio date, fin date, dias_totales integer, dia_actual integer, desde timestamp with time zone, hasta timestamp with time zone)
 language plpgsql
 stable
 set search_path to 'public'
 set "TimeZone" to 'America/Argentina/Buenos_Aires'
as $function$
declare
  v_tz  constant text := 'America/Argentina/Buenos_Aires';
  v_hoy date := (now() at time zone v_tz)::date;
  v_ref date := coalesce(p_referencia, (now() at time zone v_tz)::date);
begin
  if p_periodo = 'dia' then
    inicio := v_ref;
    fin    := v_ref;
  elsif p_periodo = 'semana' then
    -- Lunes a domingo (isodow: lunes=1 ... domingo=7)
    inicio := v_ref - (extract(isodow from v_ref)::int - 1);
    fin    := inicio + 6;
  elsif p_periodo = 'mes' then
    inicio := date_trunc('month', v_ref)::date;
    fin    := (date_trunc('month', v_ref) + interval '1 month')::date - 1;
  else
    raise exception 'Período inválido: %. Usá ''dia'', ''semana'' o ''mes''.',
      coalesce(p_periodo, 'null')
      using errcode = '22023';  -- invalid_parameter_value
  end if;

  dias_totales := fin - inicio + 1;
  dia_actual   := least(greatest(v_hoy - inicio + 1, 0), dias_totales);
  desde        := inicio::timestamp at time zone v_tz;
  hasta        := (fin + 1)::timestamp at time zone v_tz;
  return next;
end;
$function$;

create or replace function public.filas_gestion_agente(p_agente_id uuid, p_periodo text, p_referencia date)
 returns table(fuente text, id uuid, dia date, momento timestamp with time zone, hora time without time zone, es_verde boolean, es_prelisting boolean, es_prebuying boolean, es_nuevo_contacto boolean, lead_id uuid, propiedad_id uuid, tipo text, categoria text, origen text)
 language sql
 stable
 set search_path to 'public'
 set "TimeZone" to 'America/Argentina/Buenos_Aires'
as $function$
  with v as (
    select * from public.ventana_gestion(p_periodo, p_referencia)
  )
  select
    'interaccion'::text,
    i.id,
    (i.fecha at time zone 'America/Argentina/Buenos_Aires')::date,
    i.fecha,
    null::time,
    i.tipo in ('VISITA', 'REUNION'),
    (i.tipo = 'REUNION' and i.categoria is not distinct from 'PRELISTING'),
    (i.tipo = 'REUNION' and i.categoria is not distinct from 'PREBUYING'),
    false,
    i.lead_id,
    null::uuid,
    i.tipo::text,
    i.categoria::text,
    null::text
  from interacciones i, v
  where i.agente_id = p_agente_id
    and i.fecha >= v.desde
    and i.fecha <  v.hasta
    and i.tipo in ('VISITA', 'REUNION')

  union all

  select
    'visita'::text,
    vi.id,
    vi.fecha,
    null::timestamptz,
    vi.hora,
    true,
    false,
    false,
    false,
    null::uuid,
    vi.propiedad_id,
    null::text,
    null::text,
    null::text
  from visitas vi, v
  where vi.asignado_a = p_agente_id
    and vi.estado = 'REALIZADA'
    and vi.lead_id is null
    and vi.fecha >= v.inicio
    and vi.fecha <= v.fin

  union all

  select
    'lead'::text,
    l.id,
    (l.fecha_ingreso at time zone 'America/Argentina/Buenos_Aires')::date,
    l.fecha_ingreso,
    null::time,
    false,
    false,
    false,
    true,
    l.id,
    null::uuid,
    null::text,
    null::text,
    l.origen::text
  from leads l, v
  where l.agente_id = p_agente_id
    and l.origen in ('REFERIDO', 'MANUAL')
    and l.fecha_ingreso >= v.desde
    and l.fecha_ingreso <  v.hasta
$function$;

create or replace function public.filas_gestion(p_periodo text, p_referencia date)
 returns table(fuente text, id uuid, dia date, momento timestamp with time zone, hora time without time zone, es_verde boolean, es_prelisting boolean, es_prebuying boolean, es_nuevo_contacto boolean, lead_id uuid, propiedad_id uuid, tipo text, categoria text, origen text)
 language sql
 stable security definer
 set search_path to 'public'
 set "TimeZone" to 'America/Argentina/Buenos_Aires'
as $function$
  select * from public.filas_gestion_agente(auth.uid(), p_periodo, p_referencia)
$function$;

create or replace function public.resumen_gestion_agente(p_agente_id uuid, p_periodo text default 'semana'::text, p_referencia date default null::date)
 returns table(periodo_inicio date, periodo_fin date, dias_totales integer, dia_actual integer, verdes integer, prelistings integer, prebuyings integer, nuevos_contactos integer)
 language sql
 stable
 set search_path to 'public'
 set "TimeZone" to 'America/Argentina/Buenos_Aires'
as $function$
  select
    v.inicio,
    v.fin,
    v.dias_totales,
    v.dia_actual,
    c.verdes,
    c.prelistings,
    c.prebuyings,
    c.nuevos_contactos
  from public.ventana_gestion(p_periodo, p_referencia) v
  cross join (
    select
      (count(*) filter (where f.es_verde))::integer          as verdes,
      (count(*) filter (where f.es_prelisting))::integer     as prelistings,
      (count(*) filter (where f.es_prebuying))::integer      as prebuyings,
      (count(*) filter (where f.es_nuevo_contacto))::integer as nuevos_contactos
    from public.filas_gestion_agente(p_agente_id, p_periodo, p_referencia) f
  ) c
$function$;

create or replace function public.resumen_gestion(p_periodo text default 'semana'::text, p_referencia date default null::date)
 returns table(periodo_inicio date, periodo_fin date, dias_totales integer, dia_actual integer, verdes integer, prelistings integer, prebuyings integer, nuevos_contactos integer)
 language sql
 stable
 set search_path to 'public'
 set "TimeZone" to 'America/Argentina/Buenos_Aires'
as $function$
  select
    v.inicio,
    v.fin,
    v.dias_totales,
    v.dia_actual,
    c.verdes,
    c.prelistings,
    c.prebuyings,
    c.nuevos_contactos
  from public.ventana_gestion(p_periodo, p_referencia) v
  cross join (
    select
      (count(*) filter (where f.es_verde))::integer          as verdes,
      (count(*) filter (where f.es_prelisting))::integer     as prelistings,
      (count(*) filter (where f.es_prebuying))::integer      as prebuyings,
      (count(*) filter (where f.es_nuevo_contacto))::integer as nuevos_contactos
    from public.filas_gestion(p_periodo, p_referencia) f
  ) c
$function$;

-- Permisos --------------------------------------------------------------------

revoke execute on function public.filas_gestion_agente(uuid, text, date) from public, anon, authenticated;
grant execute on function public.filas_gestion_agente(uuid, text, date) to service_role;

revoke execute on function public.resumen_gestion_agente(uuid, text, date) from public, anon, authenticated;
grant execute on function public.resumen_gestion_agente(uuid, text, date) to service_role;

revoke execute on function public.ventana_gestion(text, date) from public, anon;
grant execute on function public.ventana_gestion(text, date) to authenticated, service_role;

revoke execute on function public.filas_gestion(text, date) from public, anon;
grant execute on function public.filas_gestion(text, date) to authenticated, service_role;

revoke execute on function public.resumen_gestion(text, date) from public, anon;
grant execute on function public.resumen_gestion(text, date) to authenticated, service_role;

commit;
