/**
 * El cálculo del reporte semanal, compartido por las dos funciones que lo usan:
 * `calcular-reporte-semanal` (devuelve los números) y
 * `enviar-reportes-semanales` (los mete en la plantilla y manda el mail).
 *
 * Vive acá y no adentro de una de las dos para que el mail y lo que se ve al
 * pedir las métricas a mano no puedan divergir.
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { PLANTILLA_REPORTE_SEMANAL } from './plantillaReporteSemanal.ts'

/** Huso del negocio. Argentina no tiene horario de verano: siempre UTC-3. */
export const ZONA = 'America/Argentina/Buenos_Aires'

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

export interface Semana {
  /** `YYYY-MM-DD` del lunes. */
  desde: string
  /** `YYYY-MM-DD` del domingo. */
  hasta: string
}

export interface Metricas {
  contactados: number
  nuevos: number
  visitas: number
  seguimientos_cumplidos: number
  seguimientos_vencidos: number
  operaciones: number
}

export interface ReporteSemanal {
  agente_id: string
  semana: Semana
  semana_previa: Semana
  metricas: Metricas
  metricas_previas: Metricas
  /** Lo que entra en la plantilla, ya formateado. */
  variables: Record<string, string>
}

// ---------------------------------------------------------------------------
// Fechas
// ---------------------------------------------------------------------------

/** `YYYY-MM-DD` del instante, en hora argentina. */
export function hoyEnZona(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(ahora)
}

function sumarDias(fecha: string, dias: number): string {
  const [a, m, d] = fecha.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10)
}

/** 0 = lunes … 6 = domingo. */
function diaDeSemana(fecha: string): number {
  const [a, m, d] = fecha.split('-').map(Number)
  return (new Date(Date.UTC(a, m - 1, d)).getUTCDay() + 6) % 7
}

/**
 * La última semana COMPLETA antes de `hoy`: de lunes a domingo.
 *
 * El cron corre un lunes a la mañana, así que la semana que reporta es la que
 * terminó ayer. Si se llama un miércoles —una prueba a mano—, sigue devolviendo
 * el lunes-domingo anterior y no una semana a medio andar: un reporte que
 * cambia según el día en que se pide no se puede comparar con el de al lado.
 */
export function semanaAnterior(hoy: string): Semana {
  const lunesDeEstaSemana = sumarDias(hoy, -diaDeSemana(hoy))
  const desde = sumarDias(lunesDeEstaSemana, -7)
  return { desde, hasta: sumarDias(desde, 6) }
}

export function semanaPrevia(semana: Semana): Semana {
  return { desde: sumarDias(semana.desde, -7), hasta: sumarDias(semana.hasta, -7) }
}

/**
 * "15 al 21 de septiembre", o "29 de septiembre al 5 de octubre" cuando la
 * semana cruza de mes: repetir el mes sólo cuando cambia evita el "15 de
 * septiembre al 21 de septiembre", que se lee peor.
 */
export function rangoLegible(semana: Semana): string {
  const [, mesDesde, diaDesde] = semana.desde.split('-').map(Number)
  const [, mesHasta, diaHasta] = semana.hasta.split('-').map(Number)

  if (mesDesde === mesHasta) {
    return `${diaDesde} al ${diaHasta} de ${MESES[mesHasta - 1]}`
  }
  return `${diaDesde} de ${MESES[mesDesde - 1]} al ${diaHasta} de ${MESES[mesHasta - 1]}`
}

// ---------------------------------------------------------------------------
// Formato de los cambios
// ---------------------------------------------------------------------------

/**
 * El cambio de una métrica contra la semana anterior.
 *
 * Los dos casos de borde son los que rompen un porcentaje:
 *  - La semana pasada fue 0 y esta hay actividad: dividir por cero da infinito,
 *    así que se dice "Nuevo".
 *  - Las dos semanas en 0: no hay nada que comparar y un "0%" sugeriría que se
 *    midió algo. Va un guión.
 */
export function formatearCambio(actual: number, previo: number): string {
  if (previo === 0) return actual === 0 ? '—' : 'Nuevo'

  const porcentaje = Math.round(((actual - previo) / previo) * 100)
  if (porcentaje === 0) return '0%'
  return porcentaje > 0 ? `↑ +${porcentaje}%` : `↓ ${porcentaje}%`
}

/**
 * El cambio "general" de la semana, el número grande de arriba.
 *
 * Es el cambio porcentual de la suma de las cuatro métricas de acción:
 * contactados + nuevos + visitas + operaciones que avanzaron.
 *
 * Suma simple y sin pesos a propósito: cualquier ponderación —"una visita vale
 * tres llamadas"— sería una opinión escondida adentro de un número que el
 * agente no puede auditar. Los seguimientos quedan afuera porque cumplidos y
 * vencidos tiran para lados opuestos y sumarlos mezclaría lo bueno con lo malo.
 */
export function actividadTotal(m: Metricas): number {
  return m.contactados + m.nuevos + m.visitas + m.operaciones
}

// ---------------------------------------------------------------------------
// Cálculo
// ---------------------------------------------------------------------------

async function metricasDe(
  admin: SupabaseClient,
  agenteId: string,
  semana: Semana,
): Promise<Metricas> {
  const { data, error } = await admin.rpc('metricas_semanales', {
    p_agente_id: agenteId,
    p_desde: semana.desde,
    p_hasta: semana.hasta,
  })

  if (error) throw new Error(`No se pudieron calcular las métricas: ${error.message}`)

  // El RPC devuelve una fila; sin datos del agente, devuelve ceros igual.
  const fila = (Array.isArray(data) ? data[0] : data) as Metricas | undefined
  return {
    contactados: fila?.contactados ?? 0,
    nuevos: fila?.nuevos ?? 0,
    visitas: fila?.visitas ?? 0,
    seguimientos_cumplidos: fila?.seguimientos_cumplidos ?? 0,
    seguimientos_vencidos: fila?.seguimientos_vencidos ?? 0,
    operaciones: fila?.operaciones ?? 0,
  }
}

/**
 * El reporte de un agente: los números de la semana, los de la anterior y las
 * variables ya listas para la plantilla.
 *
 * `unsubscribeUrl` se pasa desde afuera porque sólo la función que manda el
 * mail sabe firmar el token; pedir las métricas a mano no necesita un link de
 * baja y no tiene por qué generar uno válido.
 */
export async function armarReporte(
  admin: SupabaseClient,
  agente: { id: string; nombre: string | null },
  hoy: string,
  unsubscribeUrl = '',
): Promise<ReporteSemanal> {
  const semana = semanaAnterior(hoy)
  const previa = semanaPrevia(semana)

  const [metricas, metricasPrevias] = await Promise.all([
    metricasDe(admin, agente.id, semana),
    metricasDe(admin, agente.id, previa),
  ])

  const variables: Record<string, string> = {
    // Sólo el nombre de pila: el saludo es "¡Buenos días, Martina!".
    agent_name: (agente.nombre ?? '').trim().split(/\s+/)[0] || 'agente',
    week_range: rangoLegible(semana),
    weekly_activity_change: formatearCambio(
      actividadTotal(metricas),
      actividadTotal(metricasPrevias),
    ),
    contacted_leads: String(metricas.contactados),
    contacted_leads_change: formatearCambio(metricas.contactados, metricasPrevias.contactados),
    new_leads: String(metricas.nuevos),
    new_leads_change: formatearCambio(metricas.nuevos, metricasPrevias.nuevos),
    visits_completed: String(metricas.visitas),
    visits_change: formatearCambio(metricas.visitas, metricasPrevias.visitas),
    followups_completed: String(metricas.seguimientos_cumplidos),
    followups_overdue: String(metricas.seguimientos_vencidos),
    operations_advanced: String(metricas.operaciones),
    operations_change: formatearCambio(metricas.operaciones, metricasPrevias.operaciones),
    unsubscribe_url: unsubscribeUrl,
  }

  return {
    agente_id: agente.id,
    semana,
    semana_previa: previa,
    metricas,
    metricas_previas: metricasPrevias,
    variables,
  }
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

/**
 * Reemplaza `{{variable}}` por su valor.
 *
 * Una sola pasada con regex y no un `replace` por variable: así un valor que
 * contenga `{{algo}}` no se vuelve a expandir en la pasada siguiente.
 *
 * Todo lo que entra va escapado: los números salen del RPC, pero `agent_name`
 * es texto que el agente escribió, y un apellido con `<` rompería el HTML del
 * mail.
 */
export function renderizar(variables: Record<string, string>): string {
  return PLANTILLA_REPORTE_SEMANAL.replace(/\{\{(\w+)\}\}/g, (original, clave: string) => {
    const valor = variables[clave]
    return valor === undefined ? original : escaparHtml(valor)
  })
}

function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
