-- ============================================================================
-- Importar leads: lote de importación
--
-- Qué hace:
--   leads.importacion_id (uuid, nullable): identifica la importación que creó el
--   lead. Null = lead cargado de otra forma (a mano, link de consulta) o
--   importado antes de que existiera esta columna. Desde ahora "fue importado"
--   se decide por esta columna, no por origen = 'IMPORTACION': el origen pasa a
--   ser la fuente real del lead (ZonaProp, Argenprop, etc.).
--
-- Lo que NO hace, a propósito:
--   - Sin FK: la tabla `importaciones` llega en la Fase B.
--   - No toca RLS, policies ni triggers.
--   - No rellena la columna en los leads existentes.
--
-- Idempotente. Orden: después de 20261029120000_origen_portales.sql y antes de
-- 20261029120200_importar_leads_origen.sql y 20261029120300_metricas_semanales_importados.sql.
-- ============================================================================

begin;

alter table public.leads
  add column if not exists importacion_id uuid;

comment on column public.leads.importacion_id is
  'Id de la importación que creó el lead (lo manda el front, uno por archivo). Null si no vino de una importación o es anterior a esta columna. Sin FK hasta que exista la tabla importaciones.';

create index if not exists leads_importacion_id_idx
  on public.leads (importacion_id)
  where importacion_id is not null;

commit;
