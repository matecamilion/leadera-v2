-- PENDIENTE DE APLICAR EN PRODUCCION: pegar en el SQL Editor. Al aplicarla, cambiar este comentario a YA APLICADA.
--
-- `mi_cupo()`: los miembros inactivos dejan de ocupar lugar.
--
-- Mismo cambio que `hayCupo` (supabase/functions/_shared/cupo.ts): el conteo
-- sólo mira `profiles.activo = true`. Sin esto, el menú lateral seguiría
-- contando a los desactivados mientras el servidor ya no los cuenta, y el
-- cartelito diría que no hay lugar donde el servidor va a decir que sí.
--
-- Es un `create or replace` de la función de 20260924160000: misma firma, mismo
-- tipo de retorno, mismo SECURITY DEFINER, mismo `search_path` vacío, y el
-- único cambio es el `where pr.activo` del CTE `equipo`. No toca grants (los de
-- la migración original se conservan con `create or replace`), tablas ni RLS.
--
-- Idempotente.

begin;

create or replace function public.mi_cupo()
returns table (
  plan                      public.plan_leadera,
  limite_usuarios           int,
  max_agentes               int,
  max_asistentes_por_agente int,
  agentes_usados            int,
  asistentes_usados         int,
  usados_total              int,
  por_agente                jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  -- Toda referencia a columna va calificada con su alias: los nombres de
  -- `returns table` son parámetros OUT y sin calificar podrían resolver contra
  -- ellos en vez de contra la tabla.
  with yo as (
    select pr.inmobiliaria_id
    from public.profiles pr
    where pr.id = auth.uid()
  ),
  -- Sin sesión, o con un usuario sin profile, esto queda vacío y la función
  -- devuelve CERO filas. No es un error: es "no sé de qué cuenta hablás", y el
  -- frontend ya sabe mostrar el cupo como desconocido.
  cuenta as (
    select i.id, i.plan
    from public.inmobiliarias i
    join yo on yo.inmobiliaria_id = i.id
  ),
  -- Sólo miembros activos: uno desactivado no ocupa lugar del plan, igual que
  -- en `hayCupo` (supabase/functions/_shared/cupo.ts). Alimenta los conteos de
  -- abajo y la lista `por_agente`.
  equipo as (
    select pr.id, pr.nombre, pr.apellido, pr.rol, pr.asiste_a
    from public.profiles pr
    join cuenta on cuenta.id = pr.inmobiliaria_id
    where pr.activo
  ),
  -- Sin plan, o con un plan que no tiene fila, el join no da nada y los tres
  -- topes salen NULL. Los conteos igual se devuelven: saber cuántos son no
  -- depende de saber cuántos entran.
  topes as (
    select pc.limite_usuarios, pc.max_agentes, pc.max_asistentes_por_agente
    from public.planes_cupo pc
    join cuenta on cuenta.plan = pc.plan
  ),
  -- El dueño cuenta como agente y puede tener asistentes igual que cualquier
  -- otro, así que entra en esta lista.
  agentes as (
    select e.id,
           e.nombre,
           e.apellido,
           (select count(*)::int
              from equipo a
             where a.rol = 'ASISTENTE'
               and a.asiste_a = e.id) as asistentes
    from equipo e
    where e.rol in ('DUENO', 'AGENTE')
  )
  select
    cuenta.plan,
    (select t.limite_usuarios           from topes t),
    (select t.max_agentes               from topes t),
    (select t.max_asistentes_por_agente from topes t),
    (select count(*)::int from equipo e where e.rol in ('DUENO', 'AGENTE')),
    (select count(*)::int from equipo e where e.rol = 'ASISTENTE'),
    (select count(*)::int from equipo),
    -- `[]` y no NULL cuando no hay agentes: el frontend itera esto sin tener
    -- que preguntar si vino algo.
    coalesce(
      (select jsonb_agg(
                jsonb_build_object(
                  'agente_id',  a.id,
                  'nombre',     a.nombre,
                  'apellido',   a.apellido,
                  'asistentes', a.asistentes
                )
                order by a.nombre, a.apellido
              )
         from agentes a),
      '[]'::jsonb
    )
  from cuenta;
$$;

commit;
