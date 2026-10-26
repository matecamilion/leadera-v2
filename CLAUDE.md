## Atribución y asignación de leads (26/10/2026)

Principio: `leads.agente_id` = de quién es el lead (cartera, atribución, metas de gestión, reporte semanal). `leads.asignado_a` = quién lo trabaja (agenda, seguimientos, carga por miembro, "Míos"). `interacciones.agente_id` sigue siendo el autor real de la interacción y no cambia.

Modelo de cuentas: cada cuenta es un agente individual (plan Solo, típicamente de una franquicia) o una inmobiliaria con varios agentes (Chica/Grande). En Solo el rol DUENO equivale al agente. Cada agente tiene hasta 2 asistentes (`profiles.asiste_a` apunta a un único agente). El diseño debe servir en ambos tipos de cuenta.

Base de datos (ya aplicado en producción, NO volver a ejecutar):
- Fase 1: columna `leads.asignado_a` uuid NOT NULL → profiles, índice (inmobiliaria_id, asignado_a), backfill (asignado_a = agente_id; los leads de un asistente inactivo quedaron asignados a su agente) y trigger `leads_normalizar_asignacion`.
- Fase 2: se movió `agente_id` al agente en los leads cargados por asistentes (cuentas de Bautista Camilion y Century 21 Cavalca/Hansel; la cuenta Romina Ducid está dada de baja y quedó afuera). Tabla de respaldo `leads_backup_fase2` (RLS activada, sin policies). El trigger se reemplazó por la versión final.
- Trigger `leads_normalizar_asignacion` (BEFORE INSERT OR UPDATE OF asignado_a, agente_id): si inserta un asistente, `agente_id` pasa a su `asiste_a` y `asignado_a` queda con el asistente; un asistente no puede cambiar el `agente_id` de un lead; `asignado_a` debe ser el agente del lead o un asistente suyo (`asiste_a = agente_id`), de la misma inmobiliaria y activo. Mensajes: "asignado_a debe ser el agente del lead o uno de sus asistentes", "asignado_a debe ser un miembro activo", "Un asistente no puede cambiar el agente de un lead". Todos llegan como P0001.
- Las migraciones de Fase 1 y Fase 2 se aplicaron pegando el SQL en el SQL Editor y TODAVÍA NO están como archivos en `supabase/migrations` (pendiente versionarlas).
- RLS de `leads` (no modificada): el DUENO ve todo su inmobiliaria; el AGENTE ve `agente_id = auth.uid()`; el ASISTENTE ve los leads de su agente (`my_asiste_a()`) y los propios. INSERT solo valida `inmobiliaria_id`. Por eso la normalización de `agente_id` vive en el trigger y no en la policy.

Front:
- Regla de alta: `src/lib/atribucionLead.ts` → `atribucionDeAlta(perfil, asignadoA?)`: `agente_id = asiste_a ?? id`; `asignado_a = id` (el valor elegido solo para DUENO/AGENTE). `crearLead` la usa. `NuevoLead.tsx` tiene el campo "Asignar a" solo para DUENO/AGENTE con al menos un asistente activo.
- Filtro "Míos": `src/lib/alcanceLeads.ts` (helper puro con tests). Solo el ASISTENTE lo tiene (chip, default activado, `?mios=0` para ver todos). DUENO y AGENTE ven siempre todos los leads y nunca filtran por `asignado_a` (decisión de producto: no perder el rastro de leads por un filtro olvidado). Aplica a listado, `contarLeads`, badge del sidebar, Mi día y export.
- Columna "Asignado a" en listado y cards: se muestra al asistente y a cuentas con al menos un asistente activo (`mostrarAsignado`, separado de `mostrarChipMios`).
- Estado vacío para asistente sin leads asignados: `src/lib/sinLeadsAsignados.ts` y `src/components/leads/EstadoSinAsignados.tsx` (con botón "Ver todos los leads").
- Selector en la ficha: `src/components/leads/AsignadoA.tsx`, opciones de `src/lib/opcionesAsignacion.ts`; `asignarLead` en `src/lib/api/leads.ts` traduce P0001 a "No se puede asignar a ese miembro." (`MENSAJE_ASIGNACION_RECHAZADA`). Solo DUENO/AGENTE pueden cambiar la asignación (solo en UI; la RLS permite UPDATE al asistente).
- Lecturas que pasaron a `asignado_a`: seguimientos del calendario (`tareas.ts`), conteos de carga y stats por miembro (`equipo.ts`), y Perfil/Estadísticas del ASISTENTE (helper `columnaDeLeads` en `perfil.ts`: `asignado_a` para ASISTENTE, `agente_id` para el resto).
- Métricas de gestión (`resumen_gestion*`, `metricas_semanales`, reporte semanal) siguen atribuyendo por `leads.agente_id` (cartera del agente) y no cambiaron.

Reglas para trabajar en esto:
- No se aplican migraciones desde Claude Code: Mateo pega el SQL en el SQL Editor. Tampoco tocar RLS/policies sin pedido explícito.
- Al regenerar `database.ts` hay que conservar los alias manuales del final y los overrides de `estado`/`recurrencia`. Generar a un archivo temporal con `Out-File -Encoding utf8`; en Windows PowerShell 5.1 eso agrega BOM, así que hay que sacarlo después: la primera línea tiene que ser exactamente `export type Json =`.
- `ComboboxLead` (carga rápida) crea el lead asignado a quien lo carga.

Pendiente de esta línea:
- Asignación masiva de leads (seleccionar varios en el listado).
- Misma atribución en propiedades, operaciones y búsquedas (todavía guardan el `agente_id` del asistente que las carga; hay ~21 filas de Bautista a nombre de asistentes). Las `crear_*` RPC no están en el repo.
- "Quitar del equipo" (soft delete con reasignación de leads al agente) y reasignación de leads entre agentes en planes de agencia.
- Versionar las migraciones de Fase 1 y Fase 2 como archivos.
- Contadores por temperatura en los chips del listado.
