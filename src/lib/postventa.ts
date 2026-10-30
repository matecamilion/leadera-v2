import type { TipoOperacion } from './api/operaciones'

/**
 * Las tareas de postventa que se agendan al firmar la escritura.
 *
 * Todo acá trabaja con fechas de calendario `YYYY-MM-DD`, sin hora ni zona: se
 * suma con `Date.UTC` usado como calculadora, así que el resultado no depende
 * del huso de quien lo corre. Lo que sí depende de Buenos Aires es `hoy`, que
 * llega de afuera (`hoyEnArgentina`).
 */

function partes(fecha: string): [number, number, number] {
  const [a, m, d] = fecha.split('-').map(Number)
  return [a, m, d]
}

function aClave(anio: number, mes: number, dia: number): string {
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

/** La fecha `dias` días después (o antes, si es negativo). */
export function sumarDias(fecha: string, dias: number): string {
  const [a, m, d] = partes(fecha)
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10)
}

/**
 * La fecha `meses` meses después, conservando el día.
 *
 * Si el mes de destino no tiene ese día se queda en el último que tenga: el
 * 31/01 más un mes es el 28/02 (o 29 en bisiesto), no el 03/03 que da el
 * desborde de `Date`.
 */
export function sumarMeses(fecha: string, meses: number): string {
  const [a, m, d] = partes(fecha)
  const indice = m - 1 + meses
  const anio = a + Math.floor(indice / 12)
  const mes = ((indice % 12) + 12) % 12
  const ultimoDia = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate()
  return aClave(anio, mes + 1, Math.min(d, ultimoDia))
}

type Sustantivo = 'compra' | 'venta'

/** Cuándo y qué: un contacto de postventa. */
const PLAN_POSTVENTA: readonly {
  fecha: (escritura: string) => string
  titulo: (sustantivo: Sustantivo) => string
}[] = [
  {
    fecha: (e) => sumarDias(e, 1),
    titulo: () => 'Postventa: preguntar cómo quedó todo tras la escritura',
  },
  {
    fecha: (e) => sumarDias(e, 7),
    titulo: () => 'Postventa: seguimiento de la primera semana',
  },
  {
    fecha: (e) => sumarMeses(e, 1),
    titulo: (s) => `Postventa: cómo se viene sintiendo con la ${s}`,
  },
  {
    fecha: (e) => sumarMeses(e, 6),
    titulo: (s) => `Postventa: consultar cómo sigue todo a los 6 meses de la ${s}`,
  },
  {
    fecha: (e) => sumarMeses(e, 12),
    titulo: (s) => `Postventa: un año de la ${s}, pedir referidos`,
  },
]

export interface TareaPostventa {
  /** `YYYY-MM-DD`. */
  fecha: string
  titulo: string
}

/**
 * Las tareas de postventa de una escritura, de la más próxima a la más lejana.
 *
 * Las que caen antes de `hoy` se descartan: agendar algo ya vencido solo ensucia
 * Mi día. La que cae hoy se conserva. Con el nombre del cliente, cada título
 * termina en " — Nombre".
 */
export function tareasDePostventa({
  fechaEscritura,
  hoy,
  tipo,
  cliente,
}: {
  fechaEscritura: string
  hoy: string
  tipo: TipoOperacion
  cliente: string | null
}): TareaPostventa[] {
  const sustantivo: Sustantivo = tipo === 'COMPRA' ? 'compra' : 'venta'
  const sufijo = cliente ? ` — ${cliente}` : ''

  return PLAN_POSTVENTA.map((paso) => ({
    fecha: paso.fecha(fechaEscritura),
    titulo: `${paso.titulo(sustantivo)}${sufijo}`,
  })).filter((tarea) => tarea.fecha >= hoy)
}

/**
 * El aviso para quien acaba de marcar la escritura, o `null` si no hay nada que
 * decir (no se intentó generar: ya estaban hechas o el paso no era la escritura).
 */
export function avisoDePostventa(agendadas: number | null): string | null {
  if (agendadas === null) return null
  if (agendadas === 0) {
    return 'Escritura marcada. No se agendaron tareas de postventa porque las fechas ya pasaron.'
  }
  return agendadas === 1
    ? 'Se agendó 1 tarea de postventa'
    : `Se agendaron ${agendadas} tareas de postventa`
}
