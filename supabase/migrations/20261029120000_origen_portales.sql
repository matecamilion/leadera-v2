-- ============================================================================
-- Importar leads — paso previo: orígenes de portales inmobiliarios
--
-- Va en su propio archivo y FUERA de una transacción: un valor agregado con
-- `ALTER TYPE ... ADD VALUE` no se puede usar en la misma transacción que lo
-- crea. La migración siguiente (20261029120100_importar_leads_origen.sql) los
-- usa y verifica que existan antes de arrancar.
--
-- Correr ESTE archivo primero, solo, y después el otro.
--
-- `if not exists`: se puede volver a correr sin error.
-- ============================================================================

alter type public.origen_lead add value if not exists 'ZONAPROP';
alter type public.origen_lead add value if not exists 'ARGENPROP';
alter type public.origen_lead add value if not exists 'MERCADO_LIBRE';
