-- ============================================================================
-- Links de consulta — paso previo: nuevo origen de lead
--
-- Va en su propio archivo y FUERA de una transacción: un valor agregado con
-- `ALTER TYPE ... ADD VALUE` no se puede usar en la misma transacción que lo
-- crea. La migración siguiente (20261001120100_consultas.sql) lo usa y verifica
-- que exista antes de arrancar.
--
-- Correr ESTE archivo primero, solo, y después el otro.
--
-- `if not exists`: se puede volver a correr sin error.
-- ============================================================================

alter type public.origen_lead add value if not exists 'LINK_CONSULTA';
