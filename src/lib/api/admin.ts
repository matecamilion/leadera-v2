import { supabase } from '../supabase'
import { interpretarErrorSupabase } from '../errores'
import type { EstadoSuscripcion, Plan } from './suscripcion'

/**
 * Panel interno de LeadEra (/admin): cuentas y facturación de TODAS las
 * inmobiliarias.
 *
 * Alcance cerrado a tres tablas —`inmobiliarias`, `profiles` (sólo dueños) y
 * `eventos_facturacion` (sólo pagos aprobados)—. Nada de leads, propiedades,
 * operaciones ni interacciones: son datos de cada inmobiliaria y la RLS no se
 * los abre ni al superadmin.
 *
 * Que se vean todas las filas y no sólo las propias lo resuelve la RLS con las
 * policies `*_select_superadmin` (migración 20260922120000). Un usuario común
 * que llamara a esto recibiría sólo su inmobiliaria.
 *
 * Cada `select` lista sus columnas a propósito. En `eventos_facturacion`, un
 * `*` además fallaría: `raw_payload` no tiene grant de SELECT para
 * `authenticated`.
 */

export const ESTADOS: EstadoSuscripcion[] = ['TRIAL', 'ACTIVA', 'GRACIA', 'VENCIDA', 'CANCELADA']

export const ETIQUETA_ESTADO: Record<EstadoSuscripcion, string> = {
  TRIAL: 'Trial',
  ACTIVA: 'Activa',
  GRACIA: 'Gracia',
  VENCIDA: 'Vencida',
  CANCELADA: 'Cancelada',
}

/** Meses del gráfico de ingresos: se muestra lo que haya, entre estos topes. */
export const MESES_MINIMO = 6
export const MESES_MAXIMO = 12

/** Ventana de "por vencer": la misma de `vista_cuentas_en_riesgo`. */
const DIAS_RIESGO_TRIAL = 7
const UN_DIA_MS = 24 * 60 * 60 * 1000

export interface DuenoCuenta {
  nombre: string
  email: string
}

export interface CuentaAdmin {
  id: string
  nombre: string
  plan: Plan | null
  estado: EstadoSuscripcion
  creadaEl: string
  finTrial: string
  proximoCobro: string | null
  ultimoPagoFallido: string | null
  cancelacionSolicitada: boolean
  /** El dueño más antiguo. null si la cuenta se quedó sin ninguno. */
  dueno: DuenoCuenta | null
  /** Fecha del último pago aprobado dentro de la ventana que se trae. */
  ultimoPagoAprobado: string | null
}

export interface PagoAprobado {
  inmobiliariaId: string
  monto: number
  /** `null` se toma como ARS: es la única moneda en la que cobra LeadEra. */
  moneda: string
  fecha: string
}

export interface DatosPanelAdmin {
  cuentas: CuentaAdmin[]
  pagos: PagoAprobado[]
}

/**
 * Primer día del mes, `MESES_MAXIMO - 1` meses atrás: el piso de los pagos que
 * se traen. Acota la consulta —PostgREST corta en 1000 filas— a lo que el
 * gráfico puede llegar a mostrar.
 */
function inicioVentanaPagos(ahora: Date): Date {
  return new Date(ahora.getFullYear(), ahora.getMonth() - (MESES_MAXIMO - 1), 1)
}

export async function obtenerPanelAdmin(ahora: Date = new Date()): Promise<DatosPanelAdmin> {
  const [inmobiliarias, duenos, pagos] = await Promise.all([
    supabase
      .from('inmobiliarias')
      .select(
        'id, nombre, plan, estado_suscripcion, created_at, fecha_fin_trial, fecha_proximo_cobro, fecha_ultimo_pago_fallido, cancelacion_solicitada',
      )
      .order('nombre', { ascending: true }),

    // Más antiguo primero: el primero que aparece por inmobiliaria es el que
    // se muestra. Mismo criterio que `vista_cuentas_en_riesgo`.
    supabase
      .from('profiles')
      .select('inmobiliaria_id, nombre, apellido, email, created_at')
      .eq('rol', 'DUENO')
      .order('created_at', { ascending: true }),

    supabase
      .from('eventos_facturacion')
      .select('inmobiliaria_id, monto, moneda, created_at')
      .eq('tipo', 'pago_aprobado')
      .gte('created_at', inicioVentanaPagos(ahora).toISOString())
      .order('created_at', { ascending: true }),
  ])

  const fallo = inmobiliarias.error ?? duenos.error ?? pagos.error
  if (fallo) throw new Error(interpretarErrorSupabase(fallo, 'No se pudo cargar el panel.'))

  const duenoPorCuenta = new Map<string, DuenoCuenta>()
  for (const p of duenos.data ?? []) {
    if (duenoPorCuenta.has(p.inmobiliaria_id)) continue
    duenoPorCuenta.set(p.inmobiliaria_id, {
      nombre: `${p.nombre} ${p.apellido}`.trim(),
      email: p.email,
    })
  }

  const listaPagos: PagoAprobado[] = (pagos.data ?? [])
    .filter((p) => p.monto != null)
    .map((p) => ({
      inmobiliariaId: p.inmobiliaria_id,
      monto: Number(p.monto),
      moneda: p.moneda ?? 'ARS',
      fecha: p.created_at,
    }))

  // Vienen en orden ascendente: el último que se escribe es el más reciente.
  const ultimoPago = new Map<string, string>()
  for (const p of listaPagos) ultimoPago.set(p.inmobiliariaId, p.fecha)

  const cuentas: CuentaAdmin[] = (inmobiliarias.data ?? []).map((i) => ({
    id: i.id,
    nombre: i.nombre,
    plan: i.plan,
    estado: i.estado_suscripcion,
    creadaEl: i.created_at,
    finTrial: i.fecha_fin_trial,
    proximoCobro: i.fecha_proximo_cobro,
    ultimoPagoFallido: i.fecha_ultimo_pago_fallido,
    cancelacionSolicitada: i.cancelacion_solicitada,
    dueno: duenoPorCuenta.get(i.id) ?? null,
    ultimoPagoAprobado: ultimoPago.get(i.id) ?? null,
  }))

  return { cuentas, pagos: listaPagos }
}

/**
 * Conteos de uso de una inmobiliaria: sólo números, nunca filas.
 *
 * Sale del RPC `admin_metricas_inmobiliaria` (migración 20260922140000), que
 * valida adentro que quien llama sea superadmin. Sin eso, la base contesta
 * 42501 aunque alguien llame a esto a mano.
 */
export interface MetricasUsoCuenta {
  leadsTotal: number
  leadsNuevos30d: number
  propiedadesTotal: number
  operacionesTotal: number
  operacionesGanadas: number
  interaccionesTotal: number
  agentesTotal: number
  agentesActivos: number
  ultimaActividad: string | null
}

export async function obtenerMetricasCuenta(inmobiliariaId: string): Promise<MetricasUsoCuenta> {
  const { data, error } = await supabase.rpc('admin_metricas_inmobiliaria', {
    p_inmobiliaria_id: inmobiliariaId,
  })
  if (error) throw new Error(interpretarErrorSupabase(error, 'No se pudieron cargar las métricas.'))

  // Siempre vuelve una fila (los agregados sin filas dan 0), pero si no
  // viniera, ceros y no un crash.
  const f = data?.[0]
  return {
    leadsTotal: Number(f?.leads_total ?? 0),
    leadsNuevos30d: Number(f?.leads_nuevos_30d ?? 0),
    propiedadesTotal: Number(f?.propiedades_total ?? 0),
    operacionesTotal: Number(f?.operaciones_total ?? 0),
    operacionesGanadas: Number(f?.operaciones_ganadas ?? 0),
    interaccionesTotal: Number(f?.interacciones_total ?? 0),
    agentesTotal: Number(f?.agentes_total ?? 0),
    agentesActivos: Number(f?.agentes_activos ?? 0),
    ultimaActividad: f?.ultima_actividad ?? null,
  }
}

// ---------------------------------------------------------------------------
// Cálculos del panel. Puros: reciben `ahora` para poder probarlos.
// ---------------------------------------------------------------------------

export function contarPorEstado(cuentas: CuentaAdmin[]): Record<EstadoSuscripcion, number> {
  const conteo = { TRIAL: 0, ACTIVA: 0, GRACIA: 0, VENCIDA: 0, CANCELADA: 0 }
  for (const c of cuentas) conteo[c.estado] += 1
  return conteo
}

/** Cuentas por plan. `null` es la cuenta que todavía no eligió ninguno. */
export function contarPorPlan(cuentas: CuentaAdmin[]): Map<Plan | null, number> {
  const conteo = new Map<Plan | null, number>()
  for (const c of cuentas) conteo.set(c.plan, (conteo.get(c.plan) ?? 0) + 1)
  return conteo
}

/**
 * Mismo criterio que `vista_cuentas_en_riesgo`: trial que vence en menos de
 * 7 días (incluye el que ya venció y el cron todavía no pasó a VENCIDA), o
 * cuenta en GRACIA.
 */
export function estaPorVencer(cuenta: CuentaAdmin, ahora: Date = new Date()): boolean {
  if (cuenta.estado === 'GRACIA') return true
  if (cuenta.estado !== 'TRIAL') return false
  return new Date(cuenta.finTrial).getTime() < ahora.getTime() + DIAS_RIESGO_TRIAL * UN_DIA_MS
}

export interface IngresoDelPeriodo {
  /** Suma en ARS. */
  total: number
  cantidadPagos: number
  /** Pagos en otra moneda: no se suman, se avisan. Hoy tendría que ser 0. */
  enOtraMoneda: number
}

/** Pagos aprobados de los últimos 30 días, contados hacia atrás desde ahora. */
export function ingresoUltimos30Dias(
  pagos: PagoAprobado[],
  ahora: Date = new Date(),
): IngresoDelPeriodo {
  const desde = ahora.getTime() - 30 * UN_DIA_MS
  const resultado: IngresoDelPeriodo = { total: 0, cantidadPagos: 0, enOtraMoneda: 0 }
  for (const p of pagos) {
    if (new Date(p.fecha).getTime() < desde) continue
    if (p.moneda !== 'ARS') {
      resultado.enOtraMoneda += 1
      continue
    }
    resultado.total += p.monto
    resultado.cantidadPagos += 1
  }
  return resultado
}

export interface MesDeIngreso {
  /** `YYYY-MM`, en hora local. */
  clave: string
  /** Primer día del mes, para formatear la etiqueta. */
  inicio: Date
  total: number
  cantidadPagos: number
}

function claveMes(fecha: Date): string {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Pagos aprobados en ARS agrupados por mes calendario, del más viejo al actual.
 *
 * El rango no está fijo: arranca en el mes del primer pago y termina en el
 * mes en curso, con un mínimo de `MESES_MINIMO` —para que el gráfico no sea
 * una sola barra mientras hay poco historial— y un máximo de `MESES_MAXIMO`.
 * Con el tiempo se va estirando solo hasta el máximo.
 */
export function ingresosPorMes(pagos: PagoAprobado[], ahora: Date = new Date()): MesDeIngreso[] {
  const enArs = pagos.filter((p) => p.moneda === 'ARS')

  let meses = MESES_MINIMO
  if (enArs.length > 0) {
    const primero = new Date(Math.min(...enArs.map((p) => new Date(p.fecha).getTime())))
    const transcurridos =
      (ahora.getFullYear() - primero.getFullYear()) * 12 +
      (ahora.getMonth() - primero.getMonth()) +
      1
    meses = Math.min(MESES_MAXIMO, Math.max(MESES_MINIMO, transcurridos))
  }

  const serie: MesDeIngreso[] = []
  const indice = new Map<string, MesDeIngreso>()
  for (let i = meses - 1; i >= 0; i--) {
    const inicio = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1)
    const mes = { clave: claveMes(inicio), inicio, total: 0, cantidadPagos: 0 }
    serie.push(mes)
    indice.set(mes.clave, mes)
  }

  for (const p of enArs) {
    const mes = indice.get(claveMes(new Date(p.fecha)))
    if (!mes) continue
    mes.total += p.monto
    mes.cantidadPagos += 1
  }

  return serie
}

/** Días enteros desde una fecha hasta ahora. */
export function diasDesde(fecha: string, ahora: Date = new Date()): number {
  return Math.max(0, Math.floor((ahora.getTime() - new Date(fecha).getTime()) / UN_DIA_MS))
}

/**
 * La próxima fecha que importa de la cuenta: el fin del trial mientras está
 * en trial, el próximo cobro si paga. Una cuenta vencida o cancelada no tiene
 * próxima fecha.
 */
export function proximoHito(
  cuenta: CuentaAdmin,
): { etiqueta: string; fecha: string | null } | null {
  switch (cuenta.estado) {
    case 'TRIAL':
      return { etiqueta: 'Fin de trial', fecha: cuenta.finTrial }
    case 'ACTIVA':
    case 'GRACIA':
      return { etiqueta: 'Próximo cobro', fecha: cuenta.proximoCobro }
    default:
      return null
  }
}

/** Orden del listado: lo urgente arriba, después las que pagan, al final lo perdido. */
const PRIORIDAD_ESTADO: Record<EstadoSuscripcion, number> = {
  GRACIA: 0,
  TRIAL: 1,
  ACTIVA: 2,
  VENCIDA: 3,
  CANCELADA: 4,
}

export function ordenarCuentas(cuentas: CuentaAdmin[]): CuentaAdmin[] {
  return [...cuentas].sort(
    (a, b) =>
      PRIORIDAD_ESTADO[a.estado] - PRIORIDAD_ESTADO[b.estado] ||
      a.nombre.localeCompare(b.nombre, 'es'),
  )
}

const ARS = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

export function formatearArs(monto: number): string {
  return ARS.format(monto)
}

const ARS_COMPACTO = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  notation: 'compact',
  maximumFractionDigits: 1,
})

/** Para las etiquetas del gráfico, donde "$ 1.250.000" no entra. */
export function formatearArsCompacto(monto: number): string {
  return ARS_COMPACTO.format(monto)
}
