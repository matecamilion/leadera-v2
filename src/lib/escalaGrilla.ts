/**
 * La escala de la grilla horaria: cuánto mide una hora en pantalla y dónde cae un
 * momento del día. Puro. La grilla y la línea de la hora actual usan la misma.
 */
import { MINUTOS_DEL_DIA } from './columnasSuperpuestas'

/** Alto de una hora en pantalla. El eje completo son 24 de estas. */
export const PX_POR_HORA = 56
export const ALTO_TOTAL = (MINUTOS_DEL_DIA / 60) * PX_POR_HORA
/** Grosor de la línea de la hora actual. */
export const GROSOR_LINEA_AHORA = 2

/** Px desde arriba del eje para `minutos` desde las 00:00. */
export function pxDeMinutos(minutos: number): number {
  return (minutos / 60) * PX_POR_HORA
}

/**
 * Dónde va el borde de arriba de la línea de la hora actual: centrada en el
 * instante y sin salirse del eje (a las 23:59 el redondeo la dejaría fuera).
 */
export function posicionLineaAhora(minutos: number): number {
  const centrada = Math.round(pxDeMinutos(minutos)) - GROSOR_LINEA_AHORA / 2
  return Math.min(Math.max(centrada, 0), ALTO_TOTAL - GROSOR_LINEA_AHORA)
}
