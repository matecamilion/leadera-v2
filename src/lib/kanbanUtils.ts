import type { TotalPorMoneda } from './api/operaciones'

/** A partir de cuántos días sin moverse una operación se considera trabada. */
export const DIAS_PARA_TRABADA = 7

/**
 * Una operación está trabada si hace más de una semana que no cambia.
 *
 * `updated_at` lo mantiene un trigger de la base en cada cambio de estado, así
 * que mide "hace cuánto que esto no avanza", no hace cuánto se creó.
 */
export function esOperacionTrabada(updatedAt: string): boolean {
  const fecha = new Date(updatedAt)
  if (Number.isNaN(fecha.getTime())) return false
  const dias = (Date.now() - fecha.getTime()) / 86_400_000
  return dias > DIAS_PARA_TRABADA
}

/** Días enteros desde el último movimiento, para el texto del badge. */
export function diasSinMovimiento(updatedAt: string): number {
  const fecha = new Date(updatedAt)
  if (Number.isNaN(fecha.getTime())) return 0
  return Math.floor((Date.now() - fecha.getTime()) / 86_400_000)
}

const MONTOS = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 })

// `sumarMontosColumna` vivía acá y sumaba los montos de las filas cargadas.
// Se borró cuando el tablero pasó a recortar las columnas cerradas a 30 filas:
// desde entonces esa suma era parcial mientras el contador de al lado mostraba
// el total real, y dejarla disponible era una invitación a volver a usarla.
// Ahora los montos salen de `suma_montos_por_estado`, que agrega sobre todas
// las operaciones del estado.

export function formatearTotal({ moneda, total }: TotalPorMoneda): string {
  return `${moneda} ${MONTOS.format(total)}`
}

// Los links de contacto vivían acá, que fue donde hicieron falta primero.
// Ahora que los usa media app se mudaron a `lib/telefono.ts`, con la
// normalización del 0 y el 15 que esta versión no tenía.
