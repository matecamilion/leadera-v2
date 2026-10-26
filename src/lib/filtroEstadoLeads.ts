import type { FiltroEstado } from './api/leads'

/**
 * Los valores de `?estado=` que entiende el listado de leads.
 *
 * `nuevos` es "nunca contactado" (por `fecha_primer_contacto_real`), y
 * `sin_clasificar` es otra cosa: leads con `estado` null, que nadie marcó como
 * caliente, tibio, frío ni inactivo. Pueden coincidir pero no son lo mismo.
 */
export const FILTROS_ESTADO_VALIDOS: FiltroEstado[] = [
  'CALIENTE',
  'TIBIO',
  'FRIO',
  'INACTIVO',
  'GANADO',
  'nuevos',
  'sin_clasificar',
]

/** `?estado=` saneado: lo que no es un valor conocido se ignora (no filtra). */
export function leerFiltroEstado(valor: string | null): FiltroEstado | undefined {
  return FILTROS_ESTADO_VALIDOS.find((f) => f === valor)
}

/**
 * Los parámetros de la URL con `estado` puesto o quitado, sin tocar el resto.
 * `undefined` borra el parámetro: "Todos" es la URL sin `?estado=`.
 */
export function conEstado(previos: URLSearchParams, estado: FiltroEstado | undefined): URLSearchParams {
  const proximos = new URLSearchParams(previos)
  if (estado) proximos.set('estado', estado)
  else proximos.delete('estado')
  return proximos
}

/** Lo que se agrega al contador de resultados para este filtro, o `null` si no suma nada. */
export function sufijoDelFiltro(estado: FiltroEstado | undefined): string | null {
  return estado === 'sin_clasificar' ? 'sin clasificar' : null
}
