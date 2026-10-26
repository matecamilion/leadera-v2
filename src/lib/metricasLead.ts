/**
 * Textos de las tarjetas de métricas de la ficha del lead.
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

function conNumero(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`
}

export interface ConteosInteracciones {
  total: number
  llamadas: number
  whatsapps: number
  emails: number
  reuniones: number
}

/**
 * "3 llamadas · 2 WhatsApp · 1 mail · 6 otras".
 *
 * Solo las partes que no son cero, en el orden llamadas, WhatsApp, mails,
 * reuniones. "Otras" es lo que queda del total (notas, seguimientos,
 * consultas). Sin interacciones, "Sin interacciones".
 */
export function desgloseInteracciones(c: ConteosInteracciones): string {
  if (c.total <= 0) return 'Sin interacciones'

  const partes: string[] = []
  if (c.llamadas > 0) partes.push(conNumero(c.llamadas, 'llamada', 'llamadas'))
  if (c.whatsapps > 0) partes.push(`${c.whatsapps} WhatsApp`)
  if (c.emails > 0) partes.push(conNumero(c.emails, 'mail', 'mails'))
  if (c.reuniones > 0) partes.push(conNumero(c.reuniones, 'reunión', 'reuniones'))

  const otras = Math.max(0, c.total - c.llamadas - c.whatsapps - c.emails - c.reuniones)
  if (otras > 0) partes.push(conNumero(otras, 'otra', 'otras'))

  return partes.join(' · ')
}

/** `YYYY-MM-DD` (una columna `date`) como `dd/mm`. */
function diaMes(fecha: string): string {
  const [, mes, dia] = fecha.split('-')
  return `${dia}/${mes}`
}

/**
 * "Próxima: 28/10 · 15:30", sin la hora si no hay. Sin próxima: "N agendadas"
 * (la agendada puede estar vencida y no ser "próxima") o "Sin visitas agendadas".
 */
export function textoProximaVisita({
  fecha,
  hora,
  agendadas,
}: {
  fecha: string | null
  hora: string | null
  agendadas: number
}): string {
  if (fecha) {
    const base = `Próxima: ${diaMes(fecha)}`
    return hora ? `${base} · ${hora.slice(0, 5)}` : base
  }
  if (agendadas > 0) return conNumero(agendadas, 'agendada', 'agendadas')
  return 'Sin visitas agendadas'
}

/** `dd/mm/aaaa` del día calendario en Buenos Aires. */
export function fechaCompleta(valor: string | Date): string {
  const { a, m, d } = diaEnBuenosAires(valor)
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${a}`
}

/** "Primer contacto a los 3 días", o "Ingresó el dd/mm/aaaa" si todavía no hubo. */
export function textoEnCartera(
  fechaIngreso: string,
  fechaPrimerContacto: string | null,
): string {
  if (!fechaPrimerContacto) return `Ingresó el ${fechaCompleta(fechaIngreso)}`
  const dias = Math.max(0, diasEntre(fechaIngreso, fechaPrimerContacto))
  if (dias === 0) return 'Primer contacto el mismo día'
  if (dias === 1) return 'Primer contacto al día siguiente'
  return `Primer contacto a los ${dias} días`
}
