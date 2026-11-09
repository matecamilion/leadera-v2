/**
 * Cómo se dibujan en la grilla horaria los eventos de UN día. Puro.
 *
 * Las visitas y tareas no tienen hora de fin: la duración que se ve es fija y
 * cosmética, no se guarda en ningún lado. Los eventos sin hora no van en la grilla
 * sino en la franja "todo el día".
 */
import { columnasSuperpuestas, MINUTOS_DEL_DIA } from './columnasSuperpuestas'
import { minutosDelDia, ordenarEventosCalendario, type EventoOrdenable } from './ordenEventos'

/** Minutos que ocupa el bloque de cada tipo de evento. */
export const DURACION_VISUAL_MIN: Record<EventoOrdenable['tipo'], number> = {
  VISITA: 45,
  SEGUIMIENTO: 30,
  TAREA: 30,
}

export interface BloqueDia<T> {
  evento: T
  /** Minutos desde las 00:00. */
  inicio: number
  /** Minutos desde las 00:00, recortado a las 24:00. */
  fin: number
  /** Columna dentro de su grupo de superpuestos, desde 0. */
  columna: number
  /** Cuántas columnas tiene ese grupo. */
  columnas: number
}

export interface DiaEnGrilla<T> {
  /** Con hora: van posicionados en la grilla. */
  bloques: BloqueDia<T>[]
  /** Sin hora (o con una hora ilegible): van en la franja "todo el día". */
  todoElDia: T[]
}

/**
 * Reparte los eventos de un día entre la grilla y la franja "todo el día".
 *
 * El orden es el de siempre (`ordenarEventosCalendario`, lo de todo el día al
 * final), así que el reparto en columnas es estable y lo que se ve coincide con el
 * orden del panel. Un bloque que cruzaría la medianoche se recorta a las 24:00. Un
 * evento con hora que no se entiende no se pierde: pasa a "todo el día".
 */
export function bloquesDelDia<T extends EventoOrdenable>(eventos: readonly T[]): DiaEnGrilla<T> {
  const conHora: { evento: T; inicio: number; fin: number }[] = []
  const todoElDia: T[] = []

  for (const evento of ordenarEventosCalendario(eventos, 'ultimo')) {
    const inicio = minutosDelDia(evento.hora)
    if (inicio === null) {
      todoElDia.push(evento)
      continue
    }
    const fin = Math.min(inicio + DURACION_VISUAL_MIN[evento.tipo], MINUTOS_DEL_DIA)
    conHora.push({ evento, inicio, fin })
  }

  const ubicaciones = columnasSuperpuestas(conHora)
  const bloques = conHora.map((b, i) => ({ ...b, ...ubicaciones[i] }))

  return { bloques, todoElDia }
}
