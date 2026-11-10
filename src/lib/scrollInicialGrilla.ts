/**
 * Dónde arranca el scroll de la grilla horaria. Puro, y aparte a propósito: es una
 * regla de producto que se puede cambiar o revertir sin tocar el componente.
 *
 * - Si hoy se ve y ya pasaron las 7:00: una hora antes de la hora actual.
 * - Si no: media hora antes del primer evento si es más temprano que las 7:00; si
 *   no hay ninguno, a las 6:30.
 */
import { pxDeMinutos } from './escalaGrilla'

export const HORA_INICIAL_SCROLL = 7
/** Media hora de aire arriba del primer evento (o de las 7:00). */
export const AIRE_ARRIBA_MIN = 30
/** Cuánto antes de la hora actual queda esa hora, para ver lo que viene. */
export const ANTES_DE_AHORA_MIN = 60

interface EntradaScroll {
  /** Minutos del evento con hora más temprano de los días que se ven, o null si no hay. */
  primerEventoMin: number | null
  /** Minutos de la hora actual si hoy es uno de los días que se ven; null si no. */
  ahoraMin: number | null
}

/** Minutos que quedan arriba del todo de la zona visible. */
export function minutosInicialesDeScroll({ primerEventoMin, ahoraMin }: EntradaScroll): number {
  if (ahoraMin !== null && ahoraMin > HORA_INICIAL_SCROLL * 60) {
    return ahoraMin - ANTES_DE_AHORA_MIN
  }
  const primero = Math.min(primerEventoMin ?? Infinity, HORA_INICIAL_SCROLL * 60)
  return Math.max(0, primero - AIRE_ARRIBA_MIN)
}

export function scrollInicialPx(entrada: EntradaScroll): number {
  return pxDeMinutos(minutosInicialesDeScroll(entrada))
}
