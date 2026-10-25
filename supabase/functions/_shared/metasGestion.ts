/**
 * Copia de METAS_SEMANALES en src/lib/detalleGestion.ts. Si cambia una,
 * cambiar la otra.
 *
 * Las funciones de Deno no pueden importar desde `src/` (mismo motivo que
 * `cobro.ts` y `telefono.ts`). `src/lib/metasGestion.test.ts` falla si los
 * valores dejan de coincidir.
 */
export const METAS_GESTION = { verdes: 15, preListingBuying: 3, nuevosContactos: 1 } as const
