/**
 * Datos de cobro por transferencia, para los mails.
 *
 * Copia de `src/lib/config.ts` (ALIAS_TRANSFERENCIA, TITULAR_TRANSFERENCIA) y
 * de los nombres comerciales de `DETALLE_PLAN` en `src/lib/api/suscripcion.ts`:
 * las Edge Functions se despliegan sólo con `supabase/functions/`, así que no
 * pueden importar nada de `src/`. Si cambia alguno de los dos lados, cambiar
 * el otro.
 */
export const ALIAS_TRANSFERENCIA = 'leadera'
export const TITULAR_TRANSFERENCIA = 'Mateo Camilion'

export const NOMBRE_PLAN: Record<string, string> = {
  SOLO: 'Solo',
  AGENCIA_CHICA: 'Agencia Chica',
  AGENCIA_GRANDE: 'Agencia Grande',
}

const ARS = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

/** Mismo formato que `formatearArs` del panel admin. */
export function formatearArs(monto: number): string {
  return ARS.format(monto)
}
