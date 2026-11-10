/**
 * Textos de la línea de métricas de la ficha del lead.
 *
 * Funciones puras y sin supabase. Los días se cuentan por día calendario en
 * `America/Argentina/Buenos_Aires` y no por diferencia de milisegundos: un
 * lead contactado anoche a las 23:00 es "ayer" esta mañana aunque hayan pasado
 * ocho horas, y el reloj del navegador no tiene por qué estar en esa zona.
 */

const ZONA = 'America/Argentina/Buenos_Aires'

const PARTES_DE_FECHA = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** El día calendario de un instante en Buenos Aires, como `{ a, m, d }`. */
function diaEnBuenosAires(valor: string | Date): { a: number; m: number; d: number } {
  const partes = PARTES_DE_FECHA.formatToParts(typeof valor === 'string' ? new Date(valor) : valor)
  const buscar = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value)
  return { a: buscar('year'), m: buscar('month'), d: buscar('day') }
}

/** Número de día absoluto de un día calendario, para restar sin zonas de por medio. */
function numeroDeDia({ a, m, d }: { a: number; m: number; d: number }): number {
  return Math.round(Date.UTC(a, m - 1, d) / 86_400_000)
}

/** Días calendario entre dos instantes, en Buenos Aires. Negativo si `hasta` es anterior. */
export function diasEntre(desde: string | Date, hasta: string | Date): number {
  return numeroDeDia(diaEnBuenosAires(hasta)) - numeroDeDia(diaEnBuenosAires(desde))
}

/** Días calendario desde `fecha` hasta ahora (nunca negativo). */
export function diasDesde(fecha: string | Date, ahora: Date = new Date()): number {
  return Math.max(0, diasEntre(fecha, ahora))
}

/** "hoy", "ayer" o "hace N días". */
export function textoHace(dias: number): string {
  if (dias <= 0) return 'hoy'
  if (dias === 1) return 'ayer'
  return `hace ${dias} días`
}

/** "Último: hace 3 días", o "Todavía sin contactar" si nunca hubo contacto. */
export function textoUltimoContacto(
  fechaUltimoContacto: string | null,
  ahora: Date = new Date(),
): string {
  if (!fechaUltimoContacto) return 'Todavía sin contactar'
  return `Último: ${textoHace(diasDesde(fechaUltimoContacto, ahora))}`
}
