-- APLICADA el 01/11/2026
--
-- Teléfono de contacto de la persona (profiles.telefono).
--
-- Se pide en el registro independiente, para poder escribirle por WhatsApp, y se
-- edita en Mi cuenta. Va en `profiles` y no en `inmobiliarias`: es un dato de la
-- persona, no de la cuenta.
--
-- Formato guardado: internacional, `+` y de 8 a 15 dígitos (E.164, sin ceros a la
-- izquierda tras el `+`). La normalización la hace el código (Edge Function
-- `signup` y `actualizarDatosCuenta`); el CHECK es la red de seguridad de la base.
--
-- Permisos, según lo relevado en producción:
--   - SELECT es a nivel tabla para anon y authenticated, así que la columna nueva
--     se hereda sola. La RLS de SELECT NO cambia: la ve el equipo de la misma
--     inmobiliaria (`profiles_select_misma_inmobiliaria`) y el superadmin
--     (`profiles_select_superadmin`).
--   - UPDATE de `authenticated` es por columna: sin el grant de abajo, editar el
--     teléfono desde Mi cuenta falla con 42501. La policy `profiles_update_propio`
--     (id = auth.uid()) ya limita a la fila propia.
--   - No se tocan policies. INSERT no existe para el navegador: el teléfono del
--     alta lo escribe la Edge Function con service_role.
--
-- Idempotente. Todo en una transacción: si la verificación final falla, no queda
-- nada aplicado.

begin;

alter table public.profiles
  add column if not exists telefono text;

-- NULL se acepta de forma EXPLÍCITA: no se confía en que un CHECK que da NULL
-- (desconocido) deje pasar la fila.
alter table public.profiles
  drop constraint if exists profiles_telefono_formato;

alter table public.profiles
  add constraint profiles_telefono_formato
  check (
    telefono is null
    or (telefono ~ '^\+[1-9][0-9]{7,14}$')
  );

comment on column public.profiles.telefono is
  'Celular de contacto en formato internacional (+ y 8 a 15 dígitos). Nulo en cuentas anteriores al campo y en invitados.';

grant update (telefono) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Verificación: si algo no da, se aborta y no se aplica nada.
-- ---------------------------------------------------------------------------
do $$
declare
  cantidad_policies integer;
begin
  if not has_column_privilege('authenticated', 'public.profiles', 'telefono', 'UPDATE') then
    raise exception 'ABORTADO: authenticated no tiene UPDATE sobre profiles.telefono.';
  end if;

  if has_column_privilege('anon', 'public.profiles', 'telefono', 'UPDATE') then
    raise exception 'ABORTADO: anon tiene UPDATE sobre profiles.telefono.';
  end if;

  if has_column_privilege('authenticated', 'public.profiles', 'es_superadmin', 'UPDATE') then
    raise exception 'ABORTADO: authenticated tiene UPDATE sobre profiles.es_superadmin.';
  end if;

  if has_column_privilege('authenticated', 'public.profiles', 'rol', 'UPDATE') then
    raise exception 'ABORTADO: authenticated tiene UPDATE sobre profiles.rol.';
  end if;

  select count(*) into cantidad_policies
  from pg_policies
  where schemaname = 'public' and tablename = 'profiles';

  if cantidad_policies <> 3 then
    raise exception
      'ABORTADO: profiles tiene % policies y se esperaban exactamente 3.',
      cantidad_policies;
  end if;
end
$$;

commit;

-- ---------------------------------------------------------------------------
-- Prueba manual (NO forma parte de la migración). Correla aparte, después de
-- aplicarla. Todo termina en ROLLBACK: no deja nada escrito.
-- Reemplazá <MI_UUID> por el id de un usuario real y <OTRO_UUID> por el de otro
-- usuario de OTRA inmobiliaria (o cualquier otro perfil).
-- ---------------------------------------------------------------------------
-- begin;
--   set local role authenticated;
--   select set_config('request.jwt.claims', '{"sub":"<MI_UUID>","role":"authenticated"}', true);
--
--   -- 1. Su propio teléfono: tiene que andar (1 fila).
--   update public.profiles set telefono = '+5492235551234'
--     where id = '<MI_UUID>' returning id, telefono;
--
--   -- 2. El de otro usuario: 0 filas.
--   update public.profiles set telefono = '+5492235551234'
--     where id = '<OTRO_UUID>' returning id;
--
--   -- 3. Valor mal formado: tiene que fallar por profiles_telefono_formato (23514).
--   update public.profiles set telefono = '223 555-1234'
--     where id = '<MI_UUID>';
-- rollback;
--
-- begin;
--   -- 4. Anónimo: no ve ninguna fila.
--   set local role anon;
--   select count(*) from public.profiles;   -- debe dar 0
-- rollback;
