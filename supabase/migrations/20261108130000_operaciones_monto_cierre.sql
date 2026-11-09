-- Valor de cierre de las operaciones.
--
-- Una operación puede cerrarse por un valor distinto del publicado (publicada
-- en 150, cerrada en 140). El monto publicado (`monto`) no se pisa: el valor
-- de cierre va aparte, en `monto_cierre`, en la misma moneda de la operación.
--
-- Tres piezas:
--   1. La columna `monto_cierre`.
--   2. `proteger_operacion_cerrada()`: la regla vive acá, en la base, para que
--      ningún camino (RPC, UPDATE directo, script) cierre una operación sin su
--      valor. Reemplaza la vieja exigencia de `monto > 0` al cerrar.
--   3. El RPC `cerrar_operacion_ganada`: cambia el estado y guarda el valor en
--      una sola transacción.
--
-- No toca RLS, policies ni los demás triggers de `operaciones`. Las 11
-- operaciones ya cerradas quedan con monto_cierre = null (sin backfill).
--
-- Idempotente: correrla dos veces deja todo igual.

begin;

-- ---------------------------------------------------------------------------
-- 0. Precondición
-- ---------------------------------------------------------------------------
-- El RPC estampa `fecha_cierre` con now(), que solo es correcto si la columna
-- es timestamptz (el front la estampa con un instante ISO completo). Si fuera
-- `date`, now() se convertiría con la zona de la sesión (UTC) y el día de
-- cierre se correría después de las 21:00 de Argentina: mejor frenar.

do $$
begin
  if (select data_type
        from information_schema.columns
       where table_schema = 'public'
         and table_name = 'operaciones'
         and column_name = 'fecha_cierre') is distinct from 'timestamp with time zone' then
    raise exception 'ABORTADO: operaciones.fecha_cierre no es timestamptz.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. Columna monto_cierre
-- ---------------------------------------------------------------------------
-- numeric(14,2) como los demás importes en pesos y dólares. Null = no se cerró
-- con valor (abierta, cancelada o cerrada antes de esta migración).

alter table public.operaciones
  add column if not exists monto_cierre numeric(14, 2);

alter table public.operaciones
  drop constraint if exists operaciones_monto_cierre_check;
alter table public.operaciones
  add constraint operaciones_monto_cierre_check
    check (monto_cierre is null or monto_cierre > 0);

comment on column public.operaciones.monto_cierre is
  'Valor al que se cerró la operación, en la misma moneda que `moneda`. Se escribe solo en la transición a CERRADA_GANADA (lo exige proteger_operacion_cerrada) y se conserva al reabrir. Distinto de `monto`, que es el valor publicado y no se pisa. Null en abiertas, canceladas y cerradas anteriores a esta columna.';

-- ---------------------------------------------------------------------------
-- 2. Trigger function: proteger_operacion_cerrada
-- ---------------------------------------------------------------------------
-- Solo se reemplaza la función; el trigger operaciones_proteger_cerrada
-- (BEFORE UPDATE) sigue apuntando a ella.
--
--   a. Pasar a CERRADA_GANADA exige un valor de cierre válido. Reemplaza la
--      vieja regla sobre `monto`: el monto publicado puede ser null y la
--      operación se cierra igual.
--   b. `monto_cierre` solo cambia en esa transición: no se edita después ni se
--      carga fuera de un cierre. Al reabrir se conserva; al volver a cerrar se
--      reescribe.
--   c. El congelamiento de una operación cerrada o cancelada es el que ya
--      existía, sin cambios.
--
-- `set search_path = ''`: el cuerpo no usa objetos sin calificar, así que no
-- depende de quién dispare el trigger.

create or replace function public.proteger_operacion_cerrada()
returns trigger
language plpgsql
set search_path = ''
as $$
BEGIN
  -- Cierre ganado: exige valor de cierre válido
  IF NEW.estado = 'CERRADA_GANADA' AND OLD.estado != 'CERRADA_GANADA' THEN
    IF NEW.monto_cierre IS NULL OR NEW.monto_cierre <= 0 THEN
      RAISE EXCEPTION 'No se puede cerrar como ganada sin cargar el valor de cierre.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- monto_cierre solo cambia en la transición a CERRADA_GANADA
  IF NEW.monto_cierre IS DISTINCT FROM OLD.monto_cierre
     AND NOT (NEW.estado = 'CERRADA_GANADA' AND OLD.estado != 'CERRADA_GANADA') THEN
    RAISE EXCEPTION 'El valor de cierre solo se carga al cerrar la operación como ganada.'
      USING ERRCODE = 'P0001';
  END IF;

  -- Lo que ya existía: bloquear edición de campos de negocio una vez cerrada/cancelada
  IF OLD.estado IN ('CERRADA_GANADA', 'CANCELADA') THEN
    IF NEW.titulo IS DISTINCT FROM OLD.titulo
       OR NEW.monto IS DISTINCT FROM OLD.monto
       OR NEW.moneda IS DISTINCT FROM OLD.moneda
       OR NEW.notas IS DISTINCT FROM OLD.notas
       OR NEW.tipo IS DISTINCT FROM OLD.tipo
       OR NEW.lead_id IS DISTINCT FROM OLD.lead_id
       OR NEW.propiedad_id IS DISTINCT FROM OLD.propiedad_id
       OR NEW.busqueda_id IS DISTINCT FROM OLD.busqueda_id
    THEN
      RAISE EXCEPTION 'No se puede editar una operación cerrada o cancelada. Reabrila primero.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. RPC cerrar_operacion_ganada
-- ---------------------------------------------------------------------------
-- Cambia el estado y guarda el valor de cierre en una sola sentencia: nunca
-- queda una operación cerrada sin su valor. La regla de fondo la sigue
-- aplicando el trigger de arriba; el RPC valida el rango para dar un mensaje
-- claro antes de tocar nada.
--
-- SECURITY INVOKER: corre como el usuario y la policy operaciones_update decide
-- quién puede (dueño, agente de la operación o su asistente). Una operación
-- ajena no se ve, y por eso el mensaje de "no se pudo cerrar" cubre los tres
-- casos: no existe, ya está cerrada o no hay permiso.
--
-- Se cierra desde cualquier estado distinto de CERRADA_GANADA (incluida
-- CANCELADA), igual que hasta ahora. `fecha_cierre` se estampa solo si estaba
-- vacía: al volver a cerrar una operación reabierta se respeta la anterior.
--
-- Tope 10.000.000: el mismo TOPE_PRECIO del front (src/lib/validaciones.ts).

create or replace function public.cerrar_operacion_ganada(
  p_operacion_id uuid,
  p_monto_cierre numeric
)
returns public.operaciones
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_op public.operaciones;
begin
  if p_monto_cierre is null or p_monto_cierre < 1 or p_monto_cierre > 10000000 then
    raise exception 'El valor de cierre tiene que estar entre 1 y 10.000.000.'
      using errcode = 'P0001';
  end if;

  update public.operaciones
     set estado       = 'CERRADA_GANADA',
         monto_cierre = p_monto_cierre,
         fecha_cierre = coalesce(fecha_cierre, now())
   where id = p_operacion_id
     and estado <> 'CERRADA_GANADA'
  returning * into v_op;

  if not found then
    raise exception 'No se pudo cerrar la operación: no existe, ya está cerrada o no tenés permiso.'
      using errcode = 'P0001';
  end if;

  return v_op;
end;
$$;

revoke all on function public.cerrar_operacion_ganada(uuid, numeric) from public, anon;
grant execute on function public.cerrar_operacion_ganada(uuid, numeric) to authenticated;

comment on function public.cerrar_operacion_ganada(uuid, numeric) is
  'Cierra una operación como ganada y guarda su valor de cierre en una sola transacción. Desde cualquier estado distinto de CERRADA_GANADA. Valor entre 1 y 10.000.000, en la moneda de la operación. SECURITY INVOKER: rige operaciones_update. Estampa fecha_cierre solo si estaba vacía.';

commit;
