-- Superadmin de LeadEra: lectura de cuentas y facturación de TODAS las
-- inmobiliarias, para el panel interno /admin.
--
-- Alcance deliberadamente acotado a tres tablas: `inmobiliarias`,
-- `eventos_facturacion` y `profiles`. Leads, propiedades, operaciones,
-- interacciones y el resto siguen siendo privados de cada inmobiliaria, también
-- para el superadmin: esta migración no les agrega ninguna policy.
--
-- Sólo lectura. No hay policy de INSERT/UPDATE/DELETE para el superadmin.
--
-- Todo es ADITIVO: las policies existentes de las tres tablas no se tocan. Las
-- nuevas son PERMISSIVE (el default), así que Postgres las combina con OR con
-- las que ya están: un usuario común sigue viendo exactamente lo mismo que hoy,
-- porque para él `my_es_superadmin()` da false y la policy nueva no suma filas.
--
-- Idempotente.

-- ---------------------------------------------------------------------------
-- 1. La marca
-- ---------------------------------------------------------------------------
-- Separada de `rol`: `rol` es el permiso DENTRO de una agencia (DUENO /
-- AGENTE / ASISTENTE) y lo usan la RLS y el front en todos lados. Ser
-- superadmin es un permiso sobre la plataforma, ortogonal a eso: Mateo sigue
-- siendo DUENO de su inmobiliaria además de superadmin.
alter table public.profiles
  add column if not exists es_superadmin boolean not null default false;

-- ---------------------------------------------------------------------------
-- 2. Nadie la escribe desde el navegador
-- ---------------------------------------------------------------------------
-- El grant de UPDATE de `authenticated` sobre `profiles` ya es POR COLUMNA
-- (nombre, apellido, meta_mensual_ganados, reporte_semanal_activo; ver
-- `..._reporte_semanal_opt_in`). Un grant por columna no se extiende a las
-- columnas nuevas, así que `es_superadmin` nace sin UPDATE para nadie más que
-- service_role / postgres. Se activa a mano desde el SQL Editor.
--
-- No se hace un `revoke update (es_superadmin)`: si alguien hubiera vuelto a
-- dar UPDATE a nivel tabla, el revoke por columna NO lo anula (el privilegio de
-- tabla gana), y el revoke daría una falsa sensación de seguridad. En cambio se
-- verifica el resultado efectivo y, si la columna quedó escribible por un rol
-- del navegador, la migración entera se aborta y no se crea ninguna policy.
--
-- Se chequea también INSERT: un INSERT con `es_superadmin = true` sería la
-- otra forma de auto-otorgárselo.
--
-- INSERT: se cierra por completo, no se acota por columna. La primera corrida
-- de esta migración abortó en el chequeo de abajo con "authenticated tiene
-- INSERT sobre profiles.es_superadmin". Como la columna era nueva, ningún
-- grant por columna podía incluirla: el INSERT estaba dado a nivel TABLA (el
-- default de Supabase para todo lo que se crea en `public`).
--
-- Nadie inserta en `profiles` con la sesión del navegador:
--   - el frontend no tiene ningún `.from('profiles').insert/upsert`;
--   - los perfiles los crea el trigger `handle_new_user` al insertarse la fila
--     en `auth.users`, desde `auth.admin.createUser` de la Edge Function
--     `signup` (service_role), con un user_metadata armado del lado del
--     servidor. Ese insert corre como el rol de auth, no como `authenticated`.
-- La RLS ya rechazaba cualquier INSERT desde el cliente; ahora tampoco hay
-- grant, igual que en `..._google_calendar_tokens_sin_insert`.
--
-- `anon` se cierra en la misma línea: con el default de Supabase tiene los
-- mismos grants a nivel tabla y el chequeo lo frenaría en la vuelta
-- siguiente. Además se le saca UPDATE: no tiene sesión, `profiles_update_propio`
-- (`id = auth.uid()`) nunca le deja escribir una fila, y un grant de UPDATE a
-- nivel tabla alcanzaría también a `es_superadmin`. El UPDATE de
-- `authenticated` no se toca: ya es por columna y el chequeo lo deja pasar.
revoke insert on public.profiles from authenticated;
revoke insert on public.profiles from anon;
revoke update on public.profiles from anon;

-- DELETE y TRUNCATE: mismo default de Supabase, a nivel tabla, en las tres
-- tablas que toca esta migración. DELETE hoy lo frena la falta de policy;
-- TRUNCATE ni siquiera pasa por RLS (Postgres no la aplica), y lo único que
-- lo separa del navegador es que PostgREST no lo expone. Ninguno de los dos
-- tiene motivo para existir para estos roles:
--   - el frontend no hace ningún `.delete()` sobre estas tablas;
--   - el único DELETE es el rollback de `signup` sobre `inmobiliarias`
--     (supabase/functions/signup/index.ts:136), con service_role.
-- REVOKE de un privilegio que el rol no tiene no falla, así que esto es
-- seguro de correr aunque en alguna de las tablas el grant ya no esté.
revoke delete, truncate on public.profiles            from authenticated, anon;
revoke delete, truncate on public.inmobiliarias       from authenticated, anon;
revoke delete, truncate on public.eventos_facturacion from authenticated, anon;

do $$
declare
  r text;
  p text;
begin
  foreach r in array array['authenticated', 'anon'] loop
    foreach p in array array['UPDATE', 'INSERT'] loop
      if has_column_privilege(r, 'public.profiles', 'es_superadmin', p) then
        raise exception
          'ABORTADO: el rol % tiene % sobre profiles.es_superadmin. '
          'Acotar el grant de % de profiles por columna antes de aplicar esta migración.',
          r, p, p;
      end if;
    end loop;
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- 3. Helper, mismo patrón que private.my_rol() / private.my_inmobiliaria_id()
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER porque la usa una policy de `profiles`: si corriera con los
-- permisos del invocador, leer `profiles` dispararía la RLS de `profiles`, que
-- vuelve a llamar a esta función → recursión infinita.
--
-- `search_path` vacío y todo calificado con esquema: una función SECURITY
-- DEFINER con search_path heredado se puede secuestrar creando objetos con el
-- mismo nombre en un esquema que venga antes.
--
-- Pide además `activo`: desactivar a un miembro (toggle-activo-miembro) tiene
-- que cortarle también este acceso, sin depender de acordarse de bajar la
-- marca a mano.
--
-- `coalesce(..., false)`: sin sesión o sin fila de perfil, false y no null.
create or replace function private.my_es_superadmin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select p.es_superadmin and p.activo
      from public.profiles p
      where p.id = auth.uid()
    ),
    false
  )
$$;

revoke all on function private.my_es_superadmin() from public, anon;
grant execute on function private.my_es_superadmin() to authenticated;

-- ---------------------------------------------------------------------------
-- 4. `raw_payload` deja de ser legible desde el navegador
-- ---------------------------------------------------------------------------
-- Es el cuerpo crudo que manda Mercado Pago: datos del pagador y del medio de
-- pago que ninguna pantalla usa. Con la policy de superadmin de abajo, sin
-- esto quedaría legible por API el de TODAS las inmobiliarias.
--
-- Los grants por columna son por ROL, no por policy: no hay forma de sacarle
-- la columna sólo al superadmin. Se le saca a todo `authenticated`, que es
-- también lo correcto para el dueño que mira su propio historial. Mismo
-- patrón que `..._google_calendar_tokens_select_acotado`.
--
-- Quién lee hoy la tabla desde el navegador: sólo `listarPagos`
-- (src/lib/api/suscripcion.ts), que pide `id, created_at, monto, moneda,
-- tipo`. Las Edge Functions (webhook-mercadopago, cancelar-suscripcion,
-- actualizar-precios-planes) usan service_role y no se ven afectadas.
--
-- El grant se arma leyendo las columnas reales en vez de listarlas a mano:
-- los tipos generados del repo pueden estar atrasados respecto de la base, y
-- una columna olvidada acá rompería en silencio un SELECT que hoy funciona.
-- Queda afuera sólo `raw_payload`. Una columna que se agregue en el futuro NO
-- entra sola: hay que sumarla al grant, igual que en `profiles`.
revoke select on public.eventos_facturacion from authenticated;
revoke select on public.eventos_facturacion from anon;

do $$
declare
  columnas text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into columnas
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'eventos_facturacion'
    and column_name <> 'raw_payload';

  execute format(
    'grant select (%s) on public.eventos_facturacion to authenticated',
    columnas
  );
end
$$;

-- Mismo criterio que el chequeo de `es_superadmin`: se verifica el resultado
-- efectivo y, si la columna sigue legible, se aborta todo.
do $$
begin
  if has_column_privilege('authenticated', 'public.eventos_facturacion', 'raw_payload', 'SELECT')
     or has_column_privilege('anon', 'public.eventos_facturacion', 'raw_payload', 'SELECT') then
    raise exception
      'ABORTADO: eventos_facturacion.raw_payload sigue legible para authenticated o anon.';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 5. Policies de lectura, una por tabla
-- ---------------------------------------------------------------------------
-- `to authenticated`: anon no tiene sesión y nunca puede ser superadmin.
--
-- `(select private.my_es_superadmin())` entre paréntesis y no a secas: así
-- Postgres la evalúa UNA vez por consulta (InitPlan) en lugar de una vez por
-- fila. Con 16 inmobiliarias no se nota; con eventos_facturacion creciendo
-- todos los meses, sí.
--
-- drop + create para que la migración se pueda volver a correr.

drop policy if exists inmobiliarias_select_superadmin on public.inmobiliarias;
create policy inmobiliarias_select_superadmin
  on public.inmobiliarias
  for select
  to authenticated
  using ((select private.my_es_superadmin()));

drop policy if exists eventos_facturacion_select_superadmin on public.eventos_facturacion;
create policy eventos_facturacion_select_superadmin
  on public.eventos_facturacion
  for select
  to authenticated
  using ((select private.my_es_superadmin()));

drop policy if exists profiles_select_superadmin on public.profiles;
create policy profiles_select_superadmin
  on public.profiles
  for select
  to authenticated
  using ((select private.my_es_superadmin()));
