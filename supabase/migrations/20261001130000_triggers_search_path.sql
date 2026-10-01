-- ============================================================================
-- Triggers de leads/propiedades/interacciones con search_path fijo
--
-- Por qué: verificar_limite_leads(), verificar_limite_propiedades() y
-- actualizar_fechas_contacto() no tenían search_path propio y referencian
-- tablas sin calificar con esquema. Heredan el search_path de quien dispara el
-- trigger: desde el navegador es `public` y anda, pero cuando el insert lo
-- hace una función con `set search_path = ''` (las RPCs de consultas de
-- 20261001120100, p. ej. consulta_crear_lead) no encuentran las tablas y
-- fallan. Apareció en la prueba de aceptar_consulta de E1.
--
-- Fijarlo en `public` deja el comportamiento igual al de siempre para los
-- llamados desde el navegador y lo hace independiente de quién dispare el
-- trigger. Ya aplicado en producción a mano; este archivo lo deja registrado.
-- ============================================================================

begin;
alter function public.verificar_limite_leads()       set search_path = public;
alter function public.verificar_limite_propiedades() set search_path = public;
alter function public.actualizar_fechas_contacto()   set search_path = public;
commit;
