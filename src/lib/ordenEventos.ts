/**
 * Orden cronológico de los eventos de un día.
 *
 * Una sola regla para el panel del día, la grilla, Mi día y el detalle de un
 * lead, así una misma agenda no se ordena distinto según dónde se mire.
 *
 * Fecha y hora son locales (de pared): no hay zonas horarias acá.
 *
 * Criterio dentro de un día:
 *  1. Por hora, comparada en MINUTOS desde medianoche (no como texto): acepta
 *     `HH:MM`, `HH:MM:SS` y los mezcla. Los segundos no cuentan.
 *  2. Los eventos sin hora (todo el día) van primero o últimos, según `sinHora`.
 *     Cada lista elige: el panel los quiere arriba; Mi día y las celdas de la
 *     grilla, que cortan a N y muestran "+N", los quieren al final para que no
 *     escondan una visita con hora.
 *  3. Desempate: visita, después seguimiento, después tarea; luego `created_at`
 *     (el más antiguo primero; sin dato, al final); y si todo empata, el orden
 *     original (el sort es estable).
 *
 * Completados y cancelados NO se mueven acá: se ordenan como cualquier otro.
 */

export type PosicionSinHora = 'primero' | 'ultimo'

/** Minutos desde medianoche, o null si no hay hora (o no se entiende). */
export function minutosDelDia(hora: string | null | undefined): number | null {
  if (!hora) return null
  const partes = /^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(hora.trim())
  if (!partes) return null
  const h = Number(partes[1])
  const m = Number(partes[2])
  if (h > 23 || m > 59) return null
  return h * 60 + m
}

/** De cada elemento, lo que hace falta para ordenarlo. */
export interface CamposOrden<T> {
  hora(item: T): string | null | undefined
  /** Menor primero. Para desempatar entre tipos distintos. */
  rango?(item: T): number
  creado?(item: T): string | null | undefined
}

function instante(valor: string | null | undefined): number {
  if (!valor) return Number.POSITIVE_INFINITY
  const t = Date.parse(valor)
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t
}

function compararDentroDelDia<T>(
  a: T,
  b: T,
  campos: CamposOrden<T>,
  sinHora: PosicionSinHora,
): number {
  const ma = minutosDelDia(campos.hora(a))
  const mb = minutosDelDia(campos.hora(b))

  if (ma !== mb) {
    if (ma === null) return sinHora === 'primero' ? -1 : 1
    if (mb === null) return sinHora === 'primero' ? 1 : -1
    return ma - mb
  }

  const ra = campos.rango?.(a) ?? 0
  const rb = campos.rango?.(b) ?? 0
  if (ra !== rb) return ra - rb

  const ca = instante(campos.creado?.(a))
  const cb = instante(campos.creado?.(b))
  if (ca === cb) return 0
  return ca < cb ? -1 : 1
}

/** Ordena los eventos de UN día. Devuelve una copia; no muta la entrada. */
export function ordenarEventosDelDia<T>(
  items: readonly T[],
  campos: CamposOrden<T>,
  sinHora: PosicionSinHora,
): T[] {
  return items
    .map((item, indice) => ({ item, indice }))
    .sort((a, b) => compararDentroDelDia(a.item, b.item, campos, sinHora) || a.indice - b.indice)
    .map(({ item }) => item)
}

/** Lo mínimo que se le pide a un evento del calendario (`EventoCalendario`). */
export interface EventoOrdenable {
  tipo: 'TAREA' | 'SEGUIMIENTO' | 'VISITA'
  hora?: string | null
  raw: unknown
}

const RANGO_TIPO: Record<EventoOrdenable['tipo'], number> = {
  VISITA: 0,
  SEGUIMIENTO: 1,
  TAREA: 2,
}

/** `ordenarEventosDelDia` para los eventos del calendario. */
export function ordenarEventosCalendario<T extends EventoOrdenable>(
  eventos: readonly T[],
  sinHora: PosicionSinHora,
): T[] {
  return ordenarEventosDelDia(
    eventos,
    {
      hora: (e) => e.hora,
      rango: (e) => RANGO_TIPO[e.tipo],
      // Los seguimientos no tienen `created_at`: quedan después de los que sí.
      creado: (e) => (e.raw as { created_at?: string | null } | null)?.created_at,
    },
    sinHora,
  )
}

/**
 * Orden de una lista que cruza días (las tareas de un lead): por fecha y,
 * dentro de la fecha, con el criterio del día (sin hora primero).
 */
export function ordenarPorFechaYHora<T extends { fecha: string }>(
  items: readonly T[],
  campos: CamposOrden<T>,
): T[] {
  return items
    .map((item, indice) => ({ item, indice }))
    .sort((a, b) => {
      if (a.item.fecha !== b.item.fecha) return a.item.fecha < b.item.fecha ? -1 : 1
      return compararDentroDelDia(a.item, b.item, campos, 'primero') || a.indice - b.indice
    })
    .map(({ item }) => item)
}
