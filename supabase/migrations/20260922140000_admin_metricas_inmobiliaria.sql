-- Métricas de uso de UNA inmobiliaria, para el detalle del panel /admin.
--
-- Sólo números. La función cuenta filas de leads, propiedades, operaciones,
-- interacciones y profiles, pero NO devuelve ninguna: ni ids, ni nombres, ni
-- teléfonos, ni contenido. El superadmin sigue sin SELECT sobre esas tablas
-- (la migración 20260922120000 sólo le abrió inmobiliarias, profiles y
-- eventos_facturacion); lo único que ve de ellas es lo que esta función
-- agrega.
--
-- SECURITY DEFINER porque tiene que contar filas de otra inmobiliaria, que la
-- RLS del que llama no le deja ver. Eso la vuelve peligrosa si cualquiera
-- pudiera ejecutarla con cualquier `p_inmobiliaria_id`, así que:
--   1. Adentro, antes de tocar ninguna tabla, exige
--      `private.my_es_superadmin()` (sesión + es_superadmin + activo). Si no,
--      aborta con 42501. No se confía en que el frontend no la llame.
--   2. EXECUTE sólo para `authenticated`: es el rol con el que llega el
--      superadmin desde el navegador. No hay forma de dar el grant a un
--      usuario puntual; el filtro fino es el chequeo del punto 1. `anon` y
--      `public` quedan afuera.
--
-- `search_path` vacío y todo calificado con esquema, igual que
-- `private.my_es_superadmin()`: una SECURITY DEFINER con search_path heredado
-- se puede secuestrar con objetos del mismo nombre en otro esquema.
--
-- Criterios:
--   - `interacciones` no tiene `inmobiliaria_id`: se cuentan por el lead al
--     que pertenecen (`lead_id` es obligatorio).
--   - "Leads nuevos 30 días" usa `created_at` (cuándo se cargó en LeadEra) y
--     no `fecha_ingreso` (fecha de negocio, editable y que puede venir de una
--     importación): esto mide uso del producto, no el embudo del cliente.
--   - "Agentes" cuenta todos los perfiles de la cuenta (dueño, agentes y
--     asistentes): es el tamaño del equipo que usa LeadEra.
--   - "Última actividad" es el máximo entre `updated_at` de leads,
--     propiedades y operaciones, y `created_at` de interacciones (cuándo se
--     registró, no la `fecha` que el agente puede corregir hacia atrás).
--
-- Idempotente.

create or replace function public.admin_metricas_inmobiliaria(p_inmobiliaria_id uuid)
returns table (
  leads_total             bigint,
  leads_nuevos_30d        bigint,
  propiedades_total       bigint,
  operaciones_total       bigint,
  operaciones_ganadas     bigint,
  interacciones_total     bigint,
  agentes_total           bigint,
  agentes_activos         bigint,
  ultima_actividad        timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not coalesce(private.my_es_superadmin(), false) then
    raise exception 'permiso denegado' using errcode = '42501';
  end if;

  return query
  with
    l as (
      select count(*)                                                    as total,
             count(*) filter (where created_at >= now() - interval '30 days') as nuevos,
             max(updated_at)                                             as ultima
      from public.leads
      where inmobiliaria_id = p_inmobiliaria_id
    ),
    p as (
      select count(*) as total, max(updated_at) as ultima
      from public.propiedades
      where inmobiliaria_id = p_inmobiliaria_id
    ),
    o as (
      select count(*)                                           as total,
             count(*) filter (where estado = 'CERRADA_GANADA')  as ganadas,
             max(updated_at)                                    as ultima
      from public.operaciones
      where inmobiliaria_id = p_inmobiliaria_id
    ),
    i as (
      select count(*) as total, max(it.created_at) as ultima
      from public.interacciones it
      join public.leads ld on ld.id = it.lead_id
      where ld.inmobiliaria_id = p_inmobiliaria_id
    ),
    a as (
      select count(*)                          as total,
             count(*) filter (where activo)    as activos
      from public.profiles
      where inmobiliaria_id = p_inmobiliaria_id
    )
  select l.total, l.nuevos, p.total, o.total, o.ganadas, i.total, a.total, a.activos,
         -- greatest() ignora los null: una cuenta sin interacciones igual
         -- devuelve la fecha de su último lead. Todo null → null.
         greatest(l.ultima, p.ultima, o.ultima, i.ultima)
  from l, p, o, i, a;
end;
$$;

revoke all on function public.admin_metricas_inmobiliaria(uuid) from public, anon, authenticated;
grant execute on function public.admin_metricas_inmobiliaria(uuid) to authenticated;

comment on function public.admin_metricas_inmobiliaria(uuid) is
  'Panel /admin: conteos de uso de una inmobiliaria. Sólo superadmin (chequeo interno con private.my_es_superadmin()). Devuelve números, nunca filas.';
