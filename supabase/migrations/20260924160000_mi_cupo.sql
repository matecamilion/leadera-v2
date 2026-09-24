-- `mi_cupo()`: el cupo de la inmobiliaria del usuario logueado, en una fila.
--
-- Hoy el frontend arma ese número a mano en `obtenerCupo`
-- (src/lib/api/equipo.ts): cuenta `profiles` con la RLS del que mira y lee
-- `inmobiliarias.limite_usuarios`. Las dos mitades están mal desde que el cupo
-- es por rol:
--
--   1. El conteo por RLS se infla. Un superadmin ve profiles de TODAS las
--      inmobiliarias (migración 20260922120000 le abrió `profiles`), así que el
--      cartelito del equipo le muestra el padrón entero como si fuera su
--      cuenta.
--   2. `inmobiliarias` no tiene policy de SELECT para `authenticated`, así que
--      la fila vuelve vacía y el límite queda en "desconocido" para todos.
--   3. `inmobiliarias.limite_usuarios` ya no es la fuente de verdad: el techo
--      sale de `planes_cupo` según el plan, que es lo que hace cumplir
--      `hayCupo` en las Edge Functions desde la migración 20260924140000.
--
-- Esta función devuelve lo mismo que mira `hayCupo`, calculado del lado del
-- servidor, para que la UI y el backend no puedan discrepar.
--
-- SECURITY DEFINER porque tiene que leer `planes_cupo` e `inmobiliarias`, que
-- el rol `authenticated` no ve. Eso la haría peligrosa si aceptara un
-- `inmobiliaria_id` por parámetro, así que NO acepta ninguno: la cuenta sale
-- siempre del profile de `auth.uid()`. No hay forma de preguntar por otra
-- inmobiliaria, ni siendo superadmin. Por eso tampoco hace falta un chequeo de
-- permisos adentro: la función no puede devolver nada que el que llama no sea.
--
-- `search_path` vacío y todo calificado con esquema, igual que
-- `admin_metricas_inmobiliaria` (migración 20260922140000): una SECURITY
-- DEFINER con search_path heredado se puede secuestrar con objetos del mismo
-- nombre en otro esquema.
--
-- Y NO llama a nada de `private`. El RPC `uso_recursos_inmobiliaria()` es
-- ininvocable desde el cliente justamente por eso —devuelve "permission denied
-- for schema private" para `authenticated`, según el comentario de
-- src/lib/api/uso.ts:10-16—, y este archivo evita repetir el error: vive en
-- `public`, se resuelve solo, y tiene su grant explícito.
--
-- Datos que devuelve, todos de la misma cuenta:
--   - el plan y sus tres topes (NULL = sin tope, igual que en `planes_cupo`)
--   - cuántos agentes y cuántos asistentes hay, y el total
--   - por cada agente, cuántos asistentes tiene colgados, para que el modal de
--     invitar pueda ofrecer sólo a los que todavía tienen lugar
--
-- Los conteos NO filtran por `activo`: un miembro desactivado sigue ocupando su
-- lugar del plan. Es el mismo criterio que `hayCupo`, y tienen que coincidir o
-- el cartelito diría que hay lugar donde el servidor va a decir que no.
--
-- Idempotente. No toca ninguna tabla, ninguna policy y ningún RLS.

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
  equipo as (
    select pr.id, pr.nombre, pr.apellido, pr.rol, pr.asiste_a
    from public.profiles pr
    join cuenta on cuenta.id = pr.inmobiliaria_id
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

revoke execute on function public.mi_cupo() from public, anon;
grant execute on function public.mi_cupo() to authenticated;

comment on function public.mi_cupo() is
  'Cupo por rol de la inmobiliaria del usuario logueado. Sin parámetros: la cuenta sale de auth.uid().';

commit;
