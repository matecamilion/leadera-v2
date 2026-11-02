-- APLICADA el 01/11/2026.

-- ============================================================================
-- Trámite: nombre de la escribanía y su presupuesto
--
-- Pedido de un agente: en la parte de escritura quiere cargar el nombre de la
-- escribanía y cuánto presupuestó. Las escribanías y los presupuestos ya eran
-- pasos del checklist (PRESUPUESTOS_PEDIDOS, ESCRIBANIA_ELEGIDA) pero solo como
-- casilla con fecha.
--
-- Los datos van en `operacion_tramite_pasos`, en la fila del paso
-- ESCRIBANIA_ELEGIDA, con el mismo patrón que `fecha_prevista` y
-- `postventa_generada_at` (que solo pueden tener valor en la fila ESCRITURA):
--
--   escribania_nombre   Nombre de la escribanía. Texto libre, 1 a 200 caracteres.
--   presupuesto_monto   Lo que presupuestó la escribanía. >= 0.
--   presupuesto_moneda  'USD' o 'ARS'. Obligatoria si hay monto; nula si no.
--
-- Todo es opcional: se puede cargar el nombre sin monto y al revés. Las tres
-- columnas son nulas por defecto, así que las filas que ya existen no cambian.
--
-- Guardar estos datos NO completa el paso: la fila puede tener datos y
-- `fecha_completado` nula (paso pendiente). La casilla sigue siendo manual.
--
-- Permisos: no hay RLS ni grants nuevos. Las policies de la tabla son por fila
-- (misma condición que `operaciones_update`) y el grant es a nivel tabla
-- (`select, insert, update`), así que las columnas nuevas heredan ambos. Como el
-- trámite no depende del estado de la operación, estos datos se pueden editar
-- con la operación cerrada.
--
-- `presupuesto_monto` es numeric(14,2): hasta 999.999.999.999,99. El front no
-- muestra decimales (`formatearMonto`).
-- ============================================================================

begin;

-- 0. Precondiciones -----------------------------------------------------------

do $$
begin
  if to_regclass('public.operacion_tramite_pasos') is null then
    raise exception 'ABORTADO: falta public.operacion_tramite_pasos.';
  end if;

  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'operacion_tramite_pasos'
       and column_name in ('escribania_nombre', 'presupuesto_monto', 'presupuesto_moneda')
  ) then
    raise exception 'ABORTADO: operacion_tramite_pasos ya tiene alguna de las columnas nuevas.';
  end if;
end
$$;

-- 1. Columnas -----------------------------------------------------------------

alter table public.operacion_tramite_pasos
  add column escribania_nombre  text,
  add column presupuesto_monto  numeric(14, 2),
  add column presupuesto_moneda text;

-- 2. Restricciones ------------------------------------------------------------

alter table public.operacion_tramite_pasos
  -- Solo la fila de la escribanía elegida puede llevar estos datos.
  add constraint operacion_tramite_pasos_escribania_solo_su_paso
    check (
      paso = 'ESCRIBANIA_ELEGIDA'
      or (
        escribania_nombre is null
        and presupuesto_monto is null
        and presupuesto_moneda is null
      )
    ),
  -- Un nombre vacío no se guarda: el cliente manda null.
  add constraint operacion_tramite_pasos_escribania_nombre_valido
    check (
      escribania_nombre is null
      or length(btrim(escribania_nombre)) between 1 and 200
    ),
  add constraint operacion_tramite_pasos_presupuesto_no_negativo
    check (presupuesto_monto is null or presupuesto_monto >= 0),
  -- Moneda solo cuando hay monto, y siempre que lo hay.
  add constraint operacion_tramite_pasos_presupuesto_moneda_valida
    check (
      (presupuesto_monto is null and presupuesto_moneda is null)
      or (presupuesto_monto is not null and presupuesto_moneda in ('USD', 'ARS'))
    );

comment on column public.operacion_tramite_pasos.escribania_nombre is
  'Solo ESCRIBANIA_ELEGIDA: nombre de la escribanía. Opcional. Cargarlo no completa el paso.';

comment on column public.operacion_tramite_pasos.presupuesto_monto is
  'Solo ESCRIBANIA_ELEGIDA: lo que presupuestó la escribanía (>= 0). Opcional; con monto, presupuesto_moneda es obligatoria.';

comment on column public.operacion_tramite_pasos.presupuesto_moneda is
  'Solo ESCRIBANIA_ELEGIDA: USD o ARS. Nula si no hay presupuesto_monto.';

-- 3. Verificación final -------------------------------------------------------
-- No se agregó ni se tocó ninguna policy ni grant; esto confirma que siguen
-- como estaban.

do $$
declare
  p text;
begin
  if (select count(*) from pg_policies
       where schemaname = 'public' and tablename = 'operacion_tramite_pasos') <> 3 then
    raise exception 'ABORTADO: operacion_tramite_pasos no tiene exactamente 3 policies.';
  end if;

  foreach p in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE'] loop
    if has_table_privilege('anon', 'public.operacion_tramite_pasos', p) then
      raise exception 'ABORTADO: anon tiene % sobre operacion_tramite_pasos.', p;
    end if;
  end loop;

  if has_table_privilege('authenticated', 'public.operacion_tramite_pasos', 'DELETE') then
    raise exception 'ABORTADO: authenticated puede borrar en operacion_tramite_pasos.';
  end if;

  if (select count(*) from information_schema.columns
       where table_schema = 'public'
         and table_name = 'operacion_tramite_pasos'
         and column_name in ('escribania_nombre', 'presupuesto_monto', 'presupuesto_moneda')) <> 3 then
    raise exception 'ABORTADO: faltan columnas nuevas en operacion_tramite_pasos.';
  end if;
end
$$;

commit;

-- ============================================================================
-- PRUEBA (después de aplicar; termina en rollback y no deja nada)
-- Reemplazar <OPERACION> por el id de una operación VENTA/COMPRA existente y
-- <INMO> por su inmobiliaria_id.
--
-- begin;
-- -- OK: nombre sin monto
-- insert into public.operacion_tramite_pasos (inmobiliaria_id, operacion_id, paso, escribania_nombre)
--   values ('<INMO>', '<OPERACION>', 'ESCRIBANIA_ELEGIDA', 'Escribanía Pérez');
-- -- OK: monto con moneda en la misma fila
-- update public.operacion_tramite_pasos
--    set presupuesto_monto = 1500, presupuesto_moneda = 'USD'
--  where operacion_id = '<OPERACION>' and paso = 'ESCRIBANIA_ELEGIDA';
-- -- FALLA (23514): monto sin moneda
-- update public.operacion_tramite_pasos set presupuesto_moneda = null
--  where operacion_id = '<OPERACION>' and paso = 'ESCRIBANIA_ELEGIDA';
-- -- FALLA (23514): moneda inválida / monto negativo / datos en otro paso
-- --   update ... set presupuesto_moneda = 'EUR' ...
-- --   update ... set presupuesto_monto = -1 ...
-- --   insert ... (paso 'ESCRITURA', escribania_nombre 'X') ...
-- rollback;
-- ============================================================================
