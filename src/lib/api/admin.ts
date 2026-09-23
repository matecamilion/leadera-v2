import { supabase } from '../supabase'
import { interpretarErrorSupabase } from '../errores'
import { ETIQUETA_METODO, type EstadoSuscripcion, type MetodoCobro, type Plan } from './suscripcion'

export { ETIQUETA_METODO }
export type { MetodoCobro }

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

/**
 * Los tipos de `eventos_facturacion` que cuentan como ingreso.
 *
 * `pago_manual` lo escribe `admin_registrar_pago_manual`; sin el, la plata
 * cobrada por transferencia no aparecería ni en el ingreso de 30 días ni en
 * el gráfico mensual, que es justo lo que este panel mira.
 */
const TIPOS_DE_INGRESO = ['pago_aprobado', 'pago_manual']

/** Ventana de "por vencer": la misma de `vista_cuentas_en_riesgo`. */
const DIAS_RIESGO_TRIAL = 7
const UN_DIA_MS = 24 * 60 * 60 * 1000

export interface DuenoCuenta {
  nombre: string
  email: string
}

/**
 * Para qué es la cuenta.
 *
 * Sólo CLIENTE es plata real. INTERNA (LeadEra usándose a sí misma) y TESTING
 * quedan fuera de todas las métricas del panel: contarlas haría que el ingreso
 * y la cantidad de clientes digan cualquier cosa.
 */
export type TipoCuenta = 'CLIENTE' | 'INTERNA' | 'TESTING'

export const TIPOS_CUENTA: { valor: TipoCuenta; label: string }[] = [
  { valor: 'CLIENTE', label: 'Cliente' },
  { valor: 'INTERNA', label: 'Interna' },
  { valor: 'TESTING', label: 'Testing' },
]

export const ETIQUETA_TIPO_CUENTA: Record<TipoCuenta, string> = {
  CLIENTE: 'Cliente',
  INTERNA: 'Interna',
  TESTING: 'Testing',
}

/** Días que se puede extender un trial de una vez, igual que el RPC. */
export const DIAS_TRIAL_MIN = 1
export const DIAS_TRIAL_MAX = 60

/** Formas de pago que acepta `admin_registrar_pago_manual`. */
export const METODOS_PAGO_MANUAL = [
  { valor: 'TRANSFERENCIA', label: 'Transferencia' },
  { valor: 'EFECTIVO', label: 'Efectivo' },
  { valor: 'OTRO', label: 'Otro' },
] as const

export type MetodoPagoManual = (typeof METODOS_PAGO_MANUAL)[number]['valor']

/** Los plazos que ofrece el modal de cobro. */
export const MESES_PAGO = [1, 3, 6] as const

/** Desde acá se avisa que el vencimiento está cerca. */
export const DIAS_AVISO_VENCIMIENTO = 7

export interface CuentaAdmin {
  id: string
  nombre: string
  plan: Plan | null
  estado: EstadoSuscripcion
  tipoCuenta: TipoCuenta
  metodoCobro: MetodoCobro
  /** Sólo para cuentas manuales: hasta cuándo cubre el último pago. */
  accesoPagadoHasta: string | null
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
  id: string
  inmobiliariaId: string
  monto: number
  /** `null` se toma como ARS: es la única moneda en la que cobra LeadEra. */
  moneda: string
  fecha: string
}

export interface DatosPanelAdmin {
  /** TODAS las cuentas, incluidas las internas y de testing. El listado las
   *  muestra según el toggle, y el detalle tiene que poder abrir cualquiera. */
  cuentas: CuentaAdmin[]
  /**
   * Sólo los pagos que cuentan como ingreso: de cuentas CLIENTE y sin anular.
   *
   * El filtro vive acá y no en cada cálculo de más abajo para que ninguno
   * tenga que acordarse de aplicarlo. Lo que alimenta el detalle de una cuenta
   * —su historial de cobros— sale de `historialCobros`, que no filtra nada.
   */
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
  const [inmobiliarias, duenos, pagos, anulaciones] = await Promise.all([
    supabase
      .from('inmobiliarias')
      .select(
        'id, nombre, plan, estado_suscripcion, tipo_cuenta, metodo_cobro, acceso_pagado_hasta, created_at, fecha_fin_trial, fecha_proximo_cobro, fecha_ultimo_pago_fallido, cancelacion_solicitada',
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
      .select('id, inmobiliaria_id, monto, moneda, created_at')
      // Los dos tipos que son plata entrada: el cobro automatico de Mercado
      // Pago y el pago manual que registra el superadmin.
      .in('tipo', TIPOS_DE_INGRESO)
      .gte('created_at', inicioVentanaPagos(ahora).toISOString())
      .order('created_at', { ascending: true }),

    // Las anulaciones, para descontar de los ingresos los pagos dados de baja.
    // Se piden sin acotar por fecha: una anulación de hoy puede apuntar a un
    // pago de hace once meses, que sí entra en el gráfico.
    supabase
      .from('eventos_facturacion')
      .select('evento_relacionado_id')
      .eq('tipo', 'pago_anulado')
      .not('evento_relacionado_id', 'is', null),
  ])

  const fallo = inmobiliarias.error ?? duenos.error ?? pagos.error ?? anulaciones.error
  if (fallo) throw new Error(interpretarErrorSupabase(fallo, 'No se pudo cargar el panel.'))

  const anulados = new Set(
    (anulaciones.data ?? []).map((a) => a.evento_relacionado_id).filter((id): id is string => !!id),
  )

  const duenoPorCuenta = new Map<string, DuenoCuenta>()
  for (const p of duenos.data ?? []) {
    if (duenoPorCuenta.has(p.inmobiliaria_id)) continue
    duenoPorCuenta.set(p.inmobiliaria_id, {
      nombre: `${p.nombre} ${p.apellido}`.trim(),
      email: p.email,
    })
  }

  const listaPagos: PagoAprobado[] = (pagos.data ?? [])
    .filter((p) => p.monto != null && !anulados.has(p.id))
    .map((p) => ({
      id: p.id,
      inmobiliariaId: p.inmobiliaria_id,
      monto: Number(p.monto),
      moneda: p.moneda ?? 'ARS',
      fecha: p.created_at,
    }))

  // Vienen en orden ascendente: el último que se escribe es el más reciente.
  // Se arma con TODOS los pagos y no sólo con los de clientes: el detalle de
  // una cuenta interna también muestra cuándo pagó por última vez.
  const ultimoPago = new Map<string, string>()
  for (const p of listaPagos) ultimoPago.set(p.inmobiliariaId, p.fecha)

  const cuentas: CuentaAdmin[] = (inmobiliarias.data ?? []).map((i) => ({
    id: i.id,
    nombre: i.nombre,
    plan: i.plan,
    estado: i.estado_suscripcion,
    tipoCuenta: (i.tipo_cuenta === 'INTERNA' || i.tipo_cuenta === 'TESTING'
      ? i.tipo_cuenta
      : 'CLIENTE') as TipoCuenta,
    metodoCobro: (i.metodo_cobro === 'MANUAL' ? 'MANUAL' : 'MERCADO_PAGO') as MetodoCobro,
    accesoPagadoHasta: i.acceso_pagado_hasta,
    creadaEl: i.created_at,
    finTrial: i.fecha_fin_trial,
    proximoCobro: i.fecha_proximo_cobro,
    ultimoPagoFallido: i.fecha_ultimo_pago_fallido,
    cancelacionSolicitada: i.cancelacion_solicitada,
    dueno: duenoPorCuenta.get(i.id) ?? null,
    ultimoPagoAprobado: ultimoPago.get(i.id) ?? null,
  }))

  // Las métricas miran sólo a los clientes. El listado recibe todo.
  const idsDeClientes = new Set(
    cuentas.filter((c) => c.tipoCuenta === 'CLIENTE').map((c) => c.id),
  )

  return {
    cuentas,
    pagos: listaPagos.filter((p) => idsDeClientes.has(p.inmobiliariaId)),
  }
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

/**
 * Registra un pago manual y extiende el acceso de la cuenta.
 *
 * Todo el trabajo lo hace el RPC `admin_registrar_pago_manual` (migración
 * 20260923120000): valida superadmin, bloquea la cuenta con FOR UPDATE,
 * calcula el vencimiento nuevo, actualiza `inmobiliarias` y deja el evento.
 * Acá no se replica ninguna de esas reglas.
 */
export interface PagoManualInput {
  inmobiliariaId: string
  plan: Plan
  meses: number
  monto: number
  /** `YYYY-MM-DD`, como lo devuelve un <input type="date">. */
  fechaPago: string
  metodo: MetodoPagoManual
  nota?: string
}

/** Devuelve el nuevo `acceso_pagado_hasta`, en ISO. */
export async function registrarPagoManual(input: PagoManualInput): Promise<string> {
  const { data, error } = await supabase.rpc('admin_registrar_pago_manual', {
    p_inmobiliaria_id: input.inmobiliariaId,
    p_plan: input.plan,
    p_meses: input.meses,
    p_monto: input.monto,
    p_fecha_pago: input.fechaPago,
    p_metodo: input.metodo,
    p_nota: input.nota ?? '',
  })

  if (error) throw new Error(mensajeDelRpc(error, 'No se pudo registrar el pago.'))
  return data as string
}

export interface AjusteVencimientoInput {
  inmobiliariaId: string
  /** Valor de un <input type="datetime-local"> o una fecha ISO. */
  nuevoHasta: string
  nota: string
}

export async function ajustarVencimiento(input: AjusteVencimientoInput): Promise<void> {
  const { error } = await supabase.rpc('admin_ajustar_vencimiento', {
    p_inmobiliaria_id: input.inmobiliariaId,
    p_nuevo_hasta: new Date(input.nuevoHasta).toISOString(),
    p_nota: input.nota,
  })

  if (error) throw new Error(mensajeDelRpc(error, 'No se pudo ajustar el vencimiento.'))
}

/**
 * El mensaje del RPC, tal cual lo redactó la base.
 *
 * `interpretarErrorSupabase` reescribe los errores pensando en el agente, y acá
 * perderíamos justo lo que el RPC se tomó el trabajo de explicar ("La cuenta
 * tiene una suscripción activa de Mercado Pago…"). Se cae al respaldo sólo si
 * no vino mensaje.
 */
function mensajeDelRpc(error: { message?: string }, respaldo: string): string {
  const mensaje = error.message?.trim()
  return mensaje ? mensaje : respaldo
}

/** Un movimiento de cobro de la cuenta, para el historial del detalle. */
export interface MovimientoCobro {
  id: string
  fecha: string
  tipo: string
  etiqueta: string
  detalle: string | null
  monto: number | null
  moneda: string
  /** true en un `pago_manual` que después se anuló. */
  anulado: boolean
  /** Se puede anular: es un pago manual que todavía no lo está. */
  anulable: boolean
}

/**
 * Cómo se lee cada tipo de evento en el historial del panel.
 *
 * `raw_payload` no se pide: no tiene grant de SELECT para `authenticated`
 * desde la migración 20260922120000, y un select que lo incluya falla entero
 * con 42501.
 */
const ETIQUETA_EVENTO: Record<string, string> = {
  pago_manual: 'Pago manual',
  pago_anulado: 'Pago anulado',
  ajuste_vencimiento: 'Ajuste de vencimiento',
  trial_extendido: 'Trial extendido',
  cuenta_suspendida: 'Cuenta suspendida',
  tipo_cuenta_cambiado: 'Tipo de cuenta',
  pago_aprobado: 'Pago de Mercado Pago',
  webhook_ignorado_cuenta_manual: 'Webhook de MP ignorado',
}

const TOPE_HISTORIAL_COBROS = 30

export async function historialCobros(inmobiliariaId: string): Promise<MovimientoCobro[]> {
  const { data, error } = await supabase
    .from('eventos_facturacion')
    .select('id, created_at, tipo, detalle, monto, moneda, evento_relacionado_id')
    .eq('inmobiliaria_id', inmobiliariaId)
    .in('tipo', Object.keys(ETIQUETA_EVENTO))
    .order('created_at', { ascending: false })
    .limit(TOPE_HISTORIAL_COBROS)

  if (error) {
    throw new Error(interpretarErrorSupabase(error, 'No se pudo cargar el historial de cobros.'))
  }

  const filas = data ?? []
  // Qué pagos quedaron anulados, según a quién apuntan las anulaciones de esta
  // misma lista. Una anulación siempre es posterior al pago, así que si el
  // pago entró en el tope, su anulación también.
  const anulados = new Set(
    filas
      .filter((f) => f.tipo === 'pago_anulado' && f.evento_relacionado_id)
      .map((f) => f.evento_relacionado_id as string),
  )

  return filas.map((fila) => ({
    id: fila.id,
    fecha: fila.created_at,
    tipo: fila.tipo,
    etiqueta: ETIQUETA_EVENTO[fila.tipo] ?? fila.tipo,
    detalle: fila.detalle,
    monto: fila.monto === null ? null : Number(fila.monto),
    moneda: fila.moneda ?? 'ARS',
    anulado: anulados.has(fila.id),
    anulable: fila.tipo === 'pago_manual' && !anulados.has(fila.id),
  }))
}

// ---------------------------------------------------------------------------
// Acciones de gestión (migración 20260924120000)
// ---------------------------------------------------------------------------
// Las cuatro pasan por RPC SECURITY DEFINER que validan superadmin adentro:
// `inmobiliarias` y `eventos_facturacion` no tienen policies de UPDATE ni de
// INSERT para `authenticated`, así que no hay otra forma de escribirlas desde
// el navegador. Los mensajes de error vienen redactados de la base y se
// muestran tal cual.

export async function setTipoCuenta(inmobiliariaId: string, tipo: TipoCuenta): Promise<void> {
  const { error } = await supabase.rpc('admin_set_tipo_cuenta', {
    p_inmobiliaria_id: inmobiliariaId,
    p_tipo: tipo,
  })
  if (error) throw new Error(mensajeDelRpc(error, 'No se pudo cambiar el tipo de cuenta.'))
}

export async function anularPago(eventoId: string, nota: string): Promise<void> {
  const { error } = await supabase.rpc('admin_anular_pago', {
    p_evento_id: eventoId,
    p_nota: nota,
  })
  if (error) throw new Error(mensajeDelRpc(error, 'No se pudo anular el pago.'))
}

/** Devuelve la fecha nueva de fin de trial, en ISO. */
export async function extenderTrial(
  inmobiliariaId: string,
  dias: number,
  nota: string,
): Promise<string> {
  const { data, error } = await supabase.rpc('admin_extender_trial', {
    p_inmobiliaria_id: inmobiliariaId,
    p_dias: dias,
    p_nota: nota,
  })
  if (error) throw new Error(mensajeDelRpc(error, 'No se pudo extender el trial.'))
  return data as string
}

export async function suspenderCuenta(inmobiliariaId: string, nota: string): Promise<void> {
  const { error } = await supabase.rpc('admin_suspender_cuenta', {
    p_inmobiliaria_id: inmobiliariaId,
    p_nota: nota,
  })
  if (error) throw new Error(mensajeDelRpc(error, 'No se pudo suspender la cuenta.'))
}

/**
 * Se le puede extender el trial: cuentas de Mercado Pago en prueba o vencidas.
 * Mismo criterio que `admin_extender_trial`, para no ofrecer un botón que la
 * base va a rechazar.
 */
export function puedeExtenderTrial(cuenta: CuentaAdmin): boolean {
  return (
    cuenta.metodoCobro === 'MERCADO_PAGO' &&
    (cuenta.estado === 'TRIAL' || cuenta.estado === 'VENCIDA')
  )
}

/** Se puede suspender: cualquier cuenta que no esté ya vencida. */
export function puedeSuspender(cuenta: CuentaAdmin): boolean {
  return cuenta.estado !== 'VENCIDA'
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
  // Una cuenta manual no tiene próximo cobro: tiene un acceso pagado que se
  // termina. Vale también en VENCIDA o CANCELADA, donde la fecha sigue
  // diciendo algo ("venció el 3/9") en vez de un guion.
  if (cuenta.metodoCobro === 'MANUAL') {
    return { etiqueta: 'Acceso pagado hasta', fecha: cuenta.accesoPagadoHasta }
  }

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

/**
 * La fecha hasta la que la cuenta tiene el servicio cubierto.
 *
 * Las dos vías de cobro la guardan en columnas distintas y a propósito: la
 * manual en `acceso_pagado_hasta`, la de Mercado Pago en `fecha_proximo_cobro`
 * (que MP reescribe en cada cobro). El panel las muestra en una sola columna
 * porque para quien mira son lo mismo: hasta cuándo está paga.
 */
export function fechaDeVencimiento(cuenta: CuentaAdmin): string | null {
  return cuenta.metodoCobro === 'MANUAL' ? cuenta.accesoPagadoHasta : cuenta.proximoCobro
}

/** Días enteros que faltan. Negativo si ya pasó; null si no hay fecha. */
export function diasHastaVencimiento(
  cuenta: CuentaAdmin,
  ahora: Date = new Date(),
): number | null {
  const fecha = fechaDeVencimiento(cuenta)
  if (!fecha) return null
  const ms = new Date(fecha).getTime() - ahora.getTime()
  if (Number.isNaN(ms)) return null
  return Math.ceil(ms / UN_DIA_MS)
}

export type AlertaCobro = 'vencida' | 'gracia' | 'por_vencer'

/**
 * El aviso que corresponde a la cuenta, o null si no hay nada que avisar.
 *
 * El orden importa: una cuenta vencida también tiene los días en negativo, y
 * mostrarle "Por vencer" sería quedarse corto.
 */
export function alertaDeCobro(cuenta: CuentaAdmin, ahora: Date = new Date()): AlertaCobro | null {
  if (cuenta.estado === 'VENCIDA') return 'vencida'
  if (cuenta.estado === 'GRACIA') return 'gracia'

  const dias = diasHastaVencimiento(cuenta, ahora)
  if (dias !== null && dias <= DIAS_AVISO_VENCIMIENTO) return 'por_vencer'
  return null
}

export const ETIQUETA_ALERTA: Record<AlertaCobro, string> = {
  vencida: 'Vencida',
  gracia: 'En gracia',
  por_vencer: 'Por vencer',
}
