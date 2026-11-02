-- APLICADA el 01/11/2026.

-- ============================================================================
-- Arreglo del CHECK `operacion_tramite_pasos_presupuesto_moneda_valida`
--
-- La versión de 20261101160000 era:
--
--   (presupuesto_monto is null and presupuesto_moneda is null)
--   or (presupuesto_monto is not null and presupuesto_moneda in ('USD', 'ARS'))
--
-- y dejaba pasar un monto con la moneda nula. Motivo: la lógica de SQL es de
-- tres valores. Con `presupuesto_moneda` nula, `presupuesto_moneda in ('USD',
-- 'ARS')` no da false sino NULL, y un CHECK solo rechaza la fila cuando la
-- condición da FALSE; si da NULL (o TRUE) la acepta. Así que
-- `monto is not null and NULL` daba NULL y la fila entraba.
--
-- La condición nueva pide `presupuesto_moneda is not null` de forma explícita
-- (esa comparación sí da true o false, nunca NULL), así que un monto sin
-- moneda da false y se rechaza.
--
-- Se encontró en las pruebas y se corrigió directamente en producción; este
-- archivo deja el arreglo versionado. No se edita el contenido de
-- 20261101160000 (que quedó como se aplicó, con el bug): el estado final lo
-- define esta migración.
-- ============================================================================

begin;

alter table public.operacion_tramite_pasos
  drop constraint operacion_tramite_pasos_presupuesto_moneda_valida;

alter table public.operacion_tramite_pasos
  add constraint operacion_tramite_pasos_presupuesto_moneda_valida
    check (
      (presupuesto_monto is null and presupuesto_moneda is null)
      or (
        presupuesto_monto is not null
        and presupuesto_moneda is not null
        and presupuesto_moneda in ('USD', 'ARS')
      )
    );

commit;
