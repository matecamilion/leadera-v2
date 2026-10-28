/**
 * Meses como claves `YYYY-MM`. Funciones puras, sin React ni Supabase.
 *
 * Mismo criterio que `lib/calendario`: nada de `new Date('2026-10-01')`, que se
 * interpreta como UTC y en GMT-3 cae en el día anterior. Las claves se comparan
 * como texto (el formato ordena igual que el calendario) y los nombres se arman
 * desde una fecha local.
 */

import { desdeClaveDia } from './calendario'

const FORMATO_MES = /^(\d{4})-(0[1-9]|1[0-2])$/

/** El mes de una fecha `YYYY-MM-DD`. */
export function mesDeFecha(fecha: string): string {
  return fecha.slice(0, 7)
}

export function mesAnterior(mes: string): string {
  const [ano, numero] = mes.split('-').map(Number)
  return numero === 1 ? `${ano - 1}-12` : `${ano}-${String(numero - 1).padStart(2, '0')}`
}

export function mesSiguiente(mes: string): string {
  const [ano, numero] = mes.split('-').map(Number)
  return numero === 12 ? `${ano + 1}-01` : `${ano}-${String(numero + 1).padStart(2, '0')}`
}

/** ¿`mes` es posterior a `actual`? */
export function esMesFuturo(mes: string, actual: string): boolean {
  return mes > actual
}

/**
 * `?mes=` saneado.
 *
 * Viene de la URL, así que puede ser cualquier cosa: si no es un `YYYY-MM`, o es
 * posterior al mes actual (no puede haber reservas a futuro), cae en el actual.
 */
export function leerMes(valor: string | null, actual: string): string {
  if (!valor || !FORMATO_MES.test(valor) || esMesFuturo(valor, actual)) return actual
  return valor
}

/** "octubre", o "octubre 2026" con `conAno`. */
export function nombreDelMes(mes: string, conAno = false): string {
  const nombre = desdeClaveDia(`${mes}-01`).toLocaleDateString('es-AR', { month: 'long' })
  return conAno ? `${nombre} ${mes.slice(0, 4)}` : nombre
}

/** dd/mm/aaaa de una fecha `YYYY-MM-DD`, o "—" si no hay. */
export function formatearClaveDia(fecha: string | null): string {
  if (!fecha) return '—'
  return desdeClaveDia(fecha).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}
