import { supabase } from '../supabase'
import { interpretarErrorSupabase } from '../errores'
import {
  ETIQUETA_METODO,
  PLANES,
  type BloqueoMotivo,
  type EstadoSuscripcion,
  type MetodoCobro,
  type Plan,
  type PrecioPlan,
} from './suscripcion'

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

/**
 * El estado tal como se le muestra a quien administra. Suma uno que no existe en
 * la base: SUSPENDIDA es una cuenta VENCIDA con una suspensión del
 * administrador. Para el panel es otra cosa que una vencida —hay que
 * reactivarla, no cobrarla—, así que se ve, se filtra y se cuenta aparte.
 */
export type EstadoVisible = EstadoSuscripcion | 'SUSPENDIDA'

export const ESTADOS_VISIBLES: EstadoVisible[] = [
  'TRIAL',
  'ACTIVA',
  'GRACIA',
  'VENCIDA',
  'SUSPENDIDA',
  'CANCELADA',
]

export const ETIQUETA_ESTADO: Record<EstadoVisible, string> = {
  TRIAL: 'Trial',
  ACTIVA: 'Activa',
  GRACIA: 'Gracia',
  VENCIDA: 'Vencida',
  SUSPENDIDA: 'Suspendida',
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

/** Zona en la que se cuentan y se muestran los días del panel. */
const ZONA_AR = 'America/Argentina/Buenos_Aires'
const UN_DIA_MS = 24 * 60 * 60 * 1000

export interface DuenoCuenta {
  nombre: string
  email: string
  /** Celular en formato internacional. null en cuentas anteriores al campo. */
  telefono: string | null
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
  /**
   * SUSPENSION_ADMIN mientras haya una suspensión abierta; null si no. Una
   * cuenta VENCIDA con motivo está suspendida; sin motivo, vencida.
   */
  bloqueoMotivo: BloqueoMotivo | null
  tipoCuenta: TipoCuenta
  metodoCobro: MetodoCobro
  /** Tiene una suscripción cargada en Mercado Pago (viva o no). */
  tieneSuscripcionMp: boolean
  /** Sólo para cuentas manuales: hasta cuándo cubre el último pago. */
  accesoPagadoHasta: string | null
  creadaEl: string
  /** Cuándo empezó la prueba. */
  inicioTrial: string
  finTrial: string
  proximoCobro: string | null
  ultimoPagoFallido: string | null
  cancelacionSolicitada: boolean
  /** Tope de usuarios activos del plan. null es "sin tope". */
  limiteUsuarios: number | null
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
        'id, nombre, plan, estado_suscripcion, tipo_cuenta, metodo_cobro, acceso_pagado_hasta, created_at, fecha_inicio_trial, fecha_fin_trial, fecha_proximo_cobro, fecha_ultimo_pago_fallido, cancelacion_solicitada, limite_usuarios, bloqueo_motivo, mp_preapproval_id',
      )
      .order('nombre', { ascending: true }),

    // Más antiguo primero: el primero que aparece por inmobiliaria es el que
    // se muestra. Mismo criterio que `vista_cuentas_en_riesgo`.
    supabase
      .from('profiles')
      .select('inmobiliaria_id, nombre, apellido, email, telefono, created_at')
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
      telefono: p.telefono,
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
    bloqueoMotivo: i.bloqueo_motivo === 'SUSPENSION_ADMIN' ? 'SUSPENSION_ADMIN' : null,
    tieneSuscripcionMp: i.mp_preapproval_id !== null,
    tipoCuenta: (i.tipo_cuenta === 'INTERNA' || i.tipo_cuenta === 'TESTING'
      ? i.tipo_cuenta
      : 'CLIENTE') as TipoCuenta,
    metodoCobro: (i.metodo_cobro === 'MANUAL' ? 'MANUAL' : 'MERCADO_PAGO') as MetodoCobro,
    accesoPagadoHasta: i.acceso_pagado_hasta,
    creadaEl: i.created_at,
    inicioTrial: i.fecha_inicio_trial,
    finTrial: i.fecha_fin_trial,
    proximoCobro: i.fecha_proximo_cobro,
    ultimoPagoFallido: i.fecha_ultimo_pago_fallido,
    cancelacionSolicitada: i.cancelacion_solicitada,
    limiteUsuarios: i.limite_usuarios,
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

/** Un evento de `eventos_facturacion` de la cuenta: alimenta la línea de tiempo y el resumen de cobros. */
export interface EventoCuenta {
  id: string
  fecha: string
  tipo: string
  etiqueta: string
  detalle: string | null
  monto: number | null
  moneda: string
  /** El evento al que se refiere: una anulación apunta al pago que anula. */
  relacionadoId: string | null
}

/**
 * Los tipos de evento que muestra la ficha de la cuenta y cómo se llama cada
 * uno. Son también los únicos que se piden: `precio_actualizado`,
 * `error_actualizacion_precio` y `suscripcion_sin_cambio` son ruido del sistema
 * (uno por semana y por cuenta de Mercado Pago) y taparían lo importante.
 *
 * `raw_payload` no se pide: no tiene grant de SELECT para `authenticated`
 * desde la migración 20260922120000, y un select que lo incluya falla entero
 * con 42501.
 */
const ETIQUETA_EVENTO: Record<string, string> = {
  pago_aprobado: 'Pago de Mercado Pago',
  pago_manual: 'Pago manual',
  pago_anulado: 'Pago anulado',
  pago_rechazado: 'Pago rechazado',
  suscripcion_cancelada: 'Suscripción cancelada',
  cancelacion_solicitada: 'Cancelación solicitada',
  trial_extendido: 'Trial extendido',
  ajuste_vencimiento: 'Ajuste de vencimiento',
  cuenta_suspendida: 'Cuenta suspendida',
  cuenta_vencida_manual: 'Cuenta marcada como vencida',
  cuenta_reactivada: 'Cuenta reactivada',
  tipo_cuenta_cambiado: 'Tipo de cuenta',
  webhook_ignorado_cuenta_manual: 'Webhook de MP ignorado',
}

/** Todos los eventos de la cuenta, el más reciente primero. Son pocos por cuenta. */
export async function historialCobros(inmobiliariaId: string): Promise<EventoCuenta[]> {
  const { data, error } = await supabase
    .from('eventos_facturacion')
    .select('id, created_at, tipo, detalle, monto, moneda, evento_relacionado_id')
    .eq('inmobiliaria_id', inmobiliariaId)
    .in('tipo', Object.keys(ETIQUETA_EVENTO))
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(interpretarErrorSupabase(error, 'No se pudo cargar el historial de cobros.'))
  }

  return (data ?? []).map((fila) => ({
    id: fila.id,
    fecha: fila.created_at,
    tipo: fila.tipo,
    etiqueta: ETIQUETA_EVENTO[fila.tipo] ?? fila.tipo,
    detalle: fila.detalle,
    monto: fila.monto === null ? null : Number(fila.monto),
    moneda: fila.moneda ?? 'ARS',
    relacionadoId: fila.evento_relacionado_id,
  }))
}

/** Los ids de los pagos que tienen una anulación. Misma regla que `obtenerPanelAdmin`. */
export function idsAnulados(eventos: EventoCuenta[]): Set<string> {
  const ids = new Set<string>()
  for (const e of eventos) {
    if (e.tipo === 'pago_anulado' && e.relacionadoId) ids.add(e.relacionadoId)
  }
  return ids
}

export interface ResumenDeCobros {
  /** Lo cobrado en ARS, sin los pagos anulados. */
  total: number
  /** Pagos vigentes, en cualquier moneda. */
  cantidad: number
  /** `total` dividido los pagos en ARS. null si no hay ninguno. */
  ticketPromedio: number | null
  primerPago: string | null
  ultimoPago: string | null
  /** Días calendario (hora de Argentina) del alta de la cuenta al primer pago. */
  diasHastaPrimerPago: number | null
  /** Pagos en otra moneda: cuentan en `cantidad` pero no se suman a `total`. */
  enOtraMoneda: number
}

/**
 * Lo que pagó una cuenta en toda su vida: pagos de Mercado Pago y manuales,
 * menos los anulados. No suma entre monedas: sólo el ARS entra en `total` y en
 * el ticket; los pagos en otra moneda se cuentan aparte.
 */
export function resumenDeCobros(eventos: EventoCuenta[], creadaEl: string): ResumenDeCobros {
  const anulados = idsAnulados(eventos)
  const resumen: ResumenDeCobros = {
    total: 0,
    cantidad: 0,
    ticketPromedio: null,
    primerPago: null,
    ultimoPago: null,
    diasHastaPrimerPago: null,
    enOtraMoneda: 0,
  }
  let pagosEnArs = 0

  for (const e of eventos) {
    if (!TIPOS_DE_INGRESO.includes(e.tipo) || e.monto === null || anulados.has(e.id)) continue

    resumen.cantidad += 1
    if (e.moneda === 'ARS') {
      resumen.total += e.monto
      pagosEnArs += 1
    } else {
      resumen.enOtraMoneda += 1
    }

    const t = new Date(e.fecha).getTime()
    if (resumen.primerPago === null || t < new Date(resumen.primerPago).getTime()) resumen.primerPago = e.fecha
    if (resumen.ultimoPago === null || t > new Date(resumen.ultimoPago).getTime()) resumen.ultimoPago = e.fecha
  }

  if (pagosEnArs > 0) resumen.ticketPromedio = resumen.total / pagosEnArs
  if (resumen.primerPago !== null) {
    const dias = diasHastaFechaAR(resumen.primerPago, new Date(creadaEl))
    resumen.diasHastaPrimerPago = dias === null ? null : Math.max(0, dias)
  }
  return resumen
}

/** Hasta cuántos días sin actividad una cuenta cuenta como "activa". */
export const DIAS_ACTIVIDAD_ACTIVA = 7
/** Hasta cuántos, como "baja". Pasado esto, "dormida". */
export const DIAS_ACTIVIDAD_BAJA = 30

export type NivelDeActividad = 'activa' | 'baja' | 'dormida' | 'sin_actividad'

export const ETIQUETA_ACTIVIDAD: Record<NivelDeActividad, string> = {
  activa: 'Activa',
  baja: 'Baja',
  dormida: 'Dormida',
  sin_actividad: 'Sin actividad',
}

/**
 * Cuánto usa LeadEra la cuenta, según el día de su última actividad (hora de
 * Argentina): activa hasta 7 días, baja de 8 a 30, dormida pasado eso. Sin
 * ninguna actividad registrada nunca, "sin actividad".
 */
export function nivelDeActividad(
  ultimaActividad: string | null,
  ahora: Date = new Date(),
): { nivel: NivelDeActividad; dias: number | null } {
  if (!ultimaActividad) return { nivel: 'sin_actividad', dias: null }
  const hasta = diasHastaFechaAR(ultimaActividad, ahora)
  if (hasta === null) return { nivel: 'sin_actividad', dias: null }

  const dias = Math.max(0, -hasta)
  if (dias <= DIAS_ACTIVIDAD_ACTIVA) return { nivel: 'activa', dias }
  if (dias <= DIAS_ACTIVIDAD_BAJA) return { nivel: 'baja', dias }
  return { nivel: 'dormida', dias }
}

export interface ProgresoDeTrial {
  /** Día en que va, contando el de alta como el 1. Nunca pasa de `total`. */
  dia: number
  /** Duración de la prueba en días calendario, extensiones incluidas. */
  total: number
  /** Días que faltan para el fin. 0 el último día. */
  diasRestantes: number
}

/** "Día X de N" de una prueba en curso. null si la cuenta no está en TRIAL o sus fechas no cierran. */
export function progresoDeTrial(cuenta: CuentaAdmin, ahora: Date = new Date()): ProgresoDeTrial | null {
  if (cuenta.estado !== 'TRIAL') return null
  const inicio = new Date(cuenta.inicioTrial)
  const total = diasHastaFechaAR(cuenta.finTrial, inicio)
  const transcurridos = diasHastaFechaAR(ahora.toISOString(), inicio)
  const restantes = diasHastaFechaAR(cuenta.finTrial, ahora)
  if (total === null || transcurridos === null || restantes === null || total < 1) return null

  return {
    dia: Math.min(total, Math.max(1, transcurridos + 1)),
    total,
    diasRestantes: Math.max(0, restantes),
  }
}

/** "Hoy", "hace 1 día", "hace N días" o "hace N meses", en hora de Argentina. */
export function haceCuantoAR(fecha: string, ahora: Date = new Date()): string {
  const hasta = diasHastaFechaAR(fecha, ahora)
  if (hasta === null) return '—'
  const dias = Math.max(0, -hasta)
  if (dias === 0) return 'Hoy'
  if (dias < 30) return dias === 1 ? 'hace 1 día' : `hace ${dias} días`
  const meses = Math.floor(dias / 30)
  return meses === 1 ? 'hace 1 mes' : `hace ${meses} meses`
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

/**
 * Pasa la cuenta a VENCIDA a mano, por falta de pago. No es una suspensión: no
 * abre ningún bloqueo y se levanta como un vencimiento (con un pago, un ajuste
 * de vencimiento o una extensión de prueba). La nota es opcional y el cliente
 * la puede ver.
 */
export async function marcarVencida(inmobiliariaId: string, nota?: string): Promise<void> {
  const { error } = await supabase.rpc('admin_marcar_vencida', {
    p_inmobiliaria_id: inmobiliariaId,
    p_nota: nota?.trim() || undefined,
  })
  if (error) throw new Error(mensajeDelRpc(error, 'No se pudo marcar la cuenta como vencida.'))
}

/** Levanta una suspensión. Devuelve el estado en que quedó la cuenta. */
export async function reactivarCuenta(inmobiliariaId: string, nota: string): Promise<EstadoSuscripcion> {
  const { data, error } = await supabase.rpc('admin_reactivar_cuenta', {
    p_inmobiliaria_id: inmobiliariaId,
    p_nota: nota,
  })
  if (error) throw new Error(mensajeDelRpc(error, 'No se pudo reactivar la cuenta.'))
  return data as EstadoSuscripcion
}

/** Una suspensión de una cuenta, vigente o ya levantada. */
export interface BloqueoCuenta {
  id: string
  motivo: string
  /** La nota interna. Sólo la ve el superadmin: el cliente no la lee. */
  nota: string
  /** El estado en que estaba la cuenta cuando se la suspendió. */
  estadoAnterior: EstadoSuscripcion
  bloqueadoEl: string
  /** null si el autor no quedó registrado o su perfil ya no existe. */
  bloqueadoPorNombre: string | null
  levantadoEl: string | null
  levantadoPorNombre: string | null
  notaReactivacion: string | null
}

/** El historial de suspensiones de la cuenta, la más reciente primero. */
export async function obtenerBloqueosCuenta(inmobiliariaId: string): Promise<BloqueoCuenta[]> {
  const { data, error } = await supabase.rpc('admin_bloqueos_cuenta', {
    p_inmobiliaria_id: inmobiliariaId,
  })
  if (error) throw new Error(interpretarErrorSupabase(error, 'No se pudo cargar la suspensión.'))

  return (data ?? []).map((f) => ({
    id: f.id,
    motivo: f.motivo,
    nota: f.nota,
    estadoAnterior: f.estado_anterior,
    bloqueadoEl: f.bloqueado_at,
    bloqueadoPorNombre: f.bloqueado_por_nombre,
    levantadoEl: f.levantado_at,
    levantadoPorNombre: f.levantado_por_nombre,
    notaReactivacion: f.nota_reactivacion,
  }))
}

/** La suspensión abierta, si hay. Es la que no tiene fecha de levantamiento. */
export function bloqueoVigente(bloqueos: BloqueoCuenta[]): BloqueoCuenta | null {
  return bloqueos.find((b) => b.levantadoEl === null) ?? null
}

/**
 * Las precondiciones de `admin_suspender_cuenta`, una por una, para no ofrecer
 * un botón que la base va a rechazar. null si se puede.
 *
 * "Suspensión abierta" se lee de `bloqueoMotivo`: la base lo mantiene junto con
 * la fila de `bloqueos_cuenta`.
 */
export function motivoNoSuspender(cuenta: CuentaAdmin): string | null {
  if (cuenta.bloqueoMotivo !== null) return 'La cuenta ya está suspendida.'
  if (cuenta.estado === 'CANCELADA') return 'La cuenta está cancelada: ya no tiene acceso.'
  if (
    cuenta.metodoCobro === 'MERCADO_PAGO' &&
    cuenta.tieneSuscripcionMp &&
    (cuenta.estado === 'ACTIVA' || cuenta.estado === 'GRACIA')
  ) {
    return 'Tiene una suscripción de Mercado Pago vigente: hay que cancelarla en Mercado Pago antes de suspenderla.'
  }
  return null
}

/** Se puede suspender: ver `motivoNoSuspender`. */
export function puedeSuspender(cuenta: CuentaAdmin): boolean {
  return motivoNoSuspender(cuenta) === null
}

/**
 * Se puede marcar como vencida: una cuenta manual en ACTIVA o GRACIA, o una
 * prueba sin suscripción de Mercado Pago, y sin suspensión abierta. Mismo
 * criterio que `admin_marcar_vencida`.
 */
export function puedeMarcarVencida(cuenta: CuentaAdmin): boolean {
  if (cuenta.bloqueoMotivo !== null) return false
  return (
    (cuenta.metodoCobro === 'MANUAL' &&
      (cuenta.estado === 'ACTIVA' || cuenta.estado === 'GRACIA')) ||
    (cuenta.estado === 'TRIAL' && !cuenta.tieneSuscripcionMp)
  )
}

/** Se puede reactivar sólo con una suspensión abierta, como `admin_reactivar_cuenta`. */
export function puedeReactivar(cuenta: CuentaAdmin): boolean {
  return cuenta.bloqueoMotivo !== null
}

/** Si la cuenta es una VENCIDA con una suspensión del administrador. */
export function esSuspendida(cuenta: CuentaAdmin): boolean {
  return cuenta.estado === 'VENCIDA' && cuenta.bloqueoMotivo === 'SUSPENSION_ADMIN'
}

/** El estado como se muestra: una suspendida no se ve como vencida. */
export function estadoVisible(cuenta: CuentaAdmin): EstadoVisible {
  return esSuspendida(cuenta) ? 'SUSPENDIDA' : cuenta.estado
}

/**
 * La cuenta figura suspendida pero ya no está VENCIDA: algo cambió su estado
 * por fuera de las acciones del panel, típicamente un cobro de Mercado Pago que
 * el webhook aplicó. Hasta que no haya un resguardo en la base, la suspensión
 * puede revertirse sola.
 */
export function hayIncoherenciaDeBloqueo(cuenta: CuentaAdmin): boolean {
  return cuenta.bloqueoMotivo !== null && cuenta.estado !== 'VENCIDA'
}

// ---------------------------------------------------------------------------
// Cálculos del panel. Puros: reciben `ahora` para poder probarlos.
// ---------------------------------------------------------------------------

export function contarPorEstado(cuentas: CuentaAdmin[]): Record<EstadoSuscripcion, number> {
  const conteo = { TRIAL: 0, ACTIVA: 0, GRACIA: 0, VENCIDA: 0, CANCELADA: 0 }
  for (const c of cuentas) conteo[c.estado] += 1
  return conteo
}

/** Lo mismo con las suspendidas aparte de las vencidas, como se ven en el listado. */
export function contarPorEstadoVisible(cuentas: CuentaAdmin[]): Record<EstadoVisible, number> {
  const conteo = { TRIAL: 0, ACTIVA: 0, GRACIA: 0, VENCIDA: 0, SUSPENDIDA: 0, CANCELADA: 0 }
  for (const c of cuentas) conteo[estadoVisible(c)] += 1
  return conteo
}

/** Cuentas por plan. `null` es la cuenta que todavía no eligió ninguno. */
export function contarPorPlan(cuentas: CuentaAdmin[]): Map<Plan | null, number> {
  const conteo = new Map<Plan | null, number>()
  for (const c of cuentas) conteo.set(c.plan, (conteo.get(c.plan) ?? 0) + 1)
  return conteo
}

// ---------------------------------------------------------------------------
// Días calendario en hora de Argentina
// ---------------------------------------------------------------------------
// Un vencimiento es un DÍA, no un instante: el acceso de una cuenta manual rige
// hasta el fin del día D (ver la regla 4 de `procesar_transiciones_suscripcion`),
// venza a las 00:30 o a las 23:50. Por eso los días se cuentan por fecha en
// Argentina y no dividiendo milisegundos, que daría un número distinto según la
// hora a la que se mire.

const FORMATO_DIA_AR = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA_AR,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const FORMATO_FECHA_AR = new Intl.DateTimeFormat('es-AR', {
  timeZone: ZONA_AR,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

/** El día de un instante, como número de días desde el 01/01/1970, en hora de Argentina. */
function diaAR(fecha: string | Date): number | null {
  const f = typeof fecha === 'string' ? new Date(fecha) : fecha
  if (Number.isNaN(f.getTime())) return null
  const [anio, mes, dia] = FORMATO_DIA_AR.format(f).split('-').map(Number)
  return Date.UTC(anio, mes - 1, dia) / UN_DIA_MS
}

/**
 * Días calendario entre hoy y el día de `fecha`, en hora de Argentina. 0 es
 * hoy, 1 es mañana y un número negativo, que ya pasó. null si la fecha no se
 * puede leer.
 */
export function diasHastaFechaAR(fecha: string, ahora: Date = new Date()): number | null {
  const destino = diaAR(fecha)
  const hoy = diaAR(ahora)
  return destino === null || hoy === null ? null : destino - hoy
}

/** dd/mm/aaaa en hora de Argentina, o '—' si no hay fecha. */
export function formatearFechaAR(fecha: string | null): string {
  if (!fecha) return '—'
  const f = new Date(fecha)
  return Number.isNaN(f.getTime()) ? '—' : FORMATO_FECHA_AR.format(f)
}

// ---------------------------------------------------------------------------
// Cobranza: qué requiere acción
// ---------------------------------------------------------------------------

/**
 * Días que faltan para que la cuenta pierda el acceso, o null si la cuenta no
 * entra en la definición de "por vencer":
 *   - TRIAL: hasta el fin de la prueba.
 *   - MANUAL en ACTIVA: hasta el fin del día de `acceso_pagado_hasta`.
 * Una cuenta de Mercado Pago ACTIVA no entra: su cobro es automático. Una en
 * GRACIA tampoco: tiene su propio grupo.
 *
 * Puede ser negativo: la fecha ya pasó y el cron todavía no movió la cuenta a
 * VENCIDA. Se la sigue contando, porque sigue pendiente.
 */
function diasParaVencer(cuenta: CuentaAdmin, ahora: Date): number | null {
  const fecha = fechaLimiteDeAcceso(cuenta)
  return fecha === null ? null : diasHastaFechaAR(fecha, ahora)
}

/** La fecha que cuenta como vencimiento para `estaPorVencer`, o null si no aplica. */
function fechaLimiteDeAcceso(cuenta: CuentaAdmin): string | null {
  if (cuenta.estado === 'TRIAL') return cuenta.finTrial
  if (cuenta.estado === 'ACTIVA' && cuenta.metodoCobro === 'MANUAL') return cuenta.accesoPagadoHasta
  return null
}

/**
 * La definición única de "por vencer": vence en los próximos 7 días (contando
 * hoy). La usan el KPI, la columna "Vence en" de la tabla y el bloque
 * "Requiere acción".
 */
export function estaPorVencer(cuenta: CuentaAdmin, ahora: Date = new Date()): boolean {
  const dias = diasParaVencer(cuenta, ahora)
  return dias !== null && dias <= DIAS_AVISO_VENCIMIENTO
}

export interface CuentaPorVencer {
  cuenta: CuentaAdmin
  /** El fin de la prueba o el fin del acceso pagado. */
  fecha: string
  /** Días calendario hasta `fecha`. Negativo si ya pasó y el cron no la movió. */
  dias: number
}

/** Las que `estaPorVencer`, la que vence antes primero. */
export function cuentasPorVencer(
  cuentas: CuentaAdmin[],
  ahora: Date = new Date(),
): CuentaPorVencer[] {
  const resultado: CuentaPorVencer[] = []
  for (const cuenta of cuentas) {
    const fecha = fechaLimiteDeAcceso(cuenta)
    const dias = diasParaVencer(cuenta, ahora)
    if (fecha === null || dias === null || dias > DIAS_AVISO_VENCIMIENTO) continue
    resultado.push({ cuenta, fecha, dias })
  }
  return resultado.sort((a, b) => a.dias - b.dias || a.cuenta.nombre.localeCompare(b.cuenta.nombre, 'es'))
}

export interface MrrAPrecioDeLista {
  /** Suma mensual en ARS a precio de lista. */
  total: number
  /** Cuántas cuentas entraron en la suma. */
  contadas: number
  /** ACTIVA de clientes que no se pudieron valuar: sin plan o sin precio de lista. */
  sinPrecio: number
}

/**
 * Lo que facturan por mes las cuentas CLIENTE en ACTIVA, a precio de lista.
 *
 * Es precio de lista y no lo cobrado: no hay precio pactado por cuenta. Una
 * ACTIVA sin plan, o con un plan que no tiene precio cargado, no suma y se
 * cuenta aparte en `sinPrecio`.
 */
export function mrrAPrecioDeLista(cuentas: CuentaAdmin[], precios: PrecioPlan[]): MrrAPrecioDeLista {
  const lista = new Map(precios.map((p) => [p.plan, p.precio_ars]))
  const resultado: MrrAPrecioDeLista = { total: 0, contadas: 0, sinPrecio: 0 }

  for (const cuenta of cuentas) {
    if (cuenta.tipoCuenta !== 'CLIENTE' || cuenta.estado !== 'ACTIVA') continue
    const precio = cuenta.plan ? (lista.get(cuenta.plan) ?? null) : null
    if (precio === null) {
      resultado.sinPrecio += 1
      continue
    }
    resultado.total += precio
    resultado.contadas += 1
  }
  return resultado
}

/**
 * Días calendario que lleva vencida una cuenta manual, contados desde el día
 * siguiente al de `acceso_pagado_hasta`: 0 el día en que el cron la cortó.
 *
 * null si no se puede saber: no es manual, no está VENCIDA, no tiene fecha, o
 * la fecha todavía no pasó (una suspensión a mano de una cuenta con acceso
 * vigente).
 */
export function diasVencida(cuenta: CuentaAdmin, ahora: Date = new Date()): number | null {
  if (cuenta.estado !== 'VENCIDA' || cuenta.metodoCobro !== 'MANUAL') return null
  if (!cuenta.accesoPagadoHasta) return null
  const hasta = diasHastaFechaAR(cuenta.accesoPagadoHasta, ahora)
  if (hasta === null) return null
  const dias = -hasta - 1
  return dias >= 0 ? dias : null
}

/** "hoy", "hace 1 día" o "hace N días", para completar "Vencida …". */
export function textoVencidaHace(dias: number): string {
  if (dias === 0) return 'hoy'
  return dias === 1 ? 'hace 1 día' : `hace ${dias} días`
}

/** Los días que faltan para una fecha: "Hoy", "1 día", "N días", y "Hace N días" si ya pasó. */
export function textoDiasHasta(dias: number): string {
  if (dias === 0) return 'Hoy'
  if (dias === 1) return '1 día'
  if (dias === -1) return 'Hace 1 día'
  return dias < 0 ? `Hace ${-dias} días` : `${dias} días`
}

export interface VencidaPorRecuperar {
  cuenta: CuentaAdmin
  plan: Plan | null
  /** Precio mensual de lista del plan. null si no tiene plan o precio. */
  montoLista: number | null
  /** El `acceso_pagado_hasta` con el que venció. */
  vencimiento: string | null
  /** Ver `diasVencida`. */
  diasVencida: number | null
}

/**
 * Las cuentas manuales de clientes que ya pagaron alguna vez y hoy están
 * vencidas: las que hay que ir a cobrar. Una prueba que venció sin que nadie
 * pagara no entra: no es plata que se perdió, es alguien que no se convirtió.
 *
 * "Pagaron alguna vez" mira `pagos`, que trae los últimos 12 meses y sin los
 * pagos anulados. La más reciente primero.
 */
export function vencidasPorRecuperar(
  cuentas: CuentaAdmin[],
  pagos: PagoAprobado[],
  precios: PrecioPlan[],
  ahora: Date = new Date(),
): VencidaPorRecuperar[] {
  const conPagos = new Set(pagos.map((p) => p.inmobiliariaId))
  const lista = new Map(precios.map((p) => [p.plan, p.precio_ars]))
  const instante = (v: VencidaPorRecuperar) =>
    v.vencimiento ? new Date(v.vencimiento).getTime() : Number.NEGATIVE_INFINITY

  return cuentas
    .filter(
      (c) =>
        c.tipoCuenta === 'CLIENTE' &&
        c.metodoCobro === 'MANUAL' &&
        c.estado === 'VENCIDA' &&
        conPagos.has(c.id),
    )
    .map((cuenta) => ({
      cuenta,
      plan: cuenta.plan,
      montoLista: cuenta.plan ? (lista.get(cuenta.plan) ?? null) : null,
      vencimiento: cuenta.accesoPagadoHasta,
      diasVencida: diasVencida(cuenta, ahora),
    }))
    .sort((a, b) => instante(b) - instante(a))
}

export interface GraciaMercadoPago {
  cuenta: CuentaAdmin
  /** Días calendario desde que falló el cobro. null si no hay fecha. */
  diasDesdeFallo: number | null
}

/**
 * Cuentas de clientes con Mercado Pago cuyo último cobro falló. Las manuales
 * no tienen gracia. El fallo más viejo primero, que es el más cerca de vencer.
 */
export function graciaMercadoPago(cuentas: CuentaAdmin[], ahora: Date = new Date()): GraciaMercadoPago[] {
  return cuentas
    .filter(
      (c) => c.tipoCuenta === 'CLIENTE' && c.metodoCobro === 'MERCADO_PAGO' && c.estado === 'GRACIA',
    )
    .map((cuenta) => {
      const hasta = cuenta.ultimoPagoFallido ? diasHastaFechaAR(cuenta.ultimoPagoFallido, ahora) : null
      return { cuenta, diasDesdeFallo: hasta === null ? null : -hasta }
    })
    .sort(
      (a, b) =>
        (b.diasDesdeFallo ?? Number.NEGATIVE_INFINITY) - (a.diasDesdeFallo ?? Number.NEGATIVE_INFINITY),
    )
}

/** Ventana, tope y umbral de "Nuevo" de la sección Registros recientes. */
export const DIAS_REGISTROS_RECIENTES = 7
export const MAX_REGISTROS_RECIENTES = 20
export const HORAS_REGISTRO_NUEVO = 48

const UNA_HORA_MS = 60 * 60 * 1000

export interface RegistrosRecientes {
  /** Cuántas cuentas se registraron en la ventana, sin el tope de la lista. */
  total: number
  /** Las más nuevas primero, hasta `MAX_REGISTROS_RECIENTES`. */
  lista: CuentaAdmin[]
}

/**
 * Las cuentas creadas en los últimos 7 días, más nuevas primero.
 *
 * Sólo CLIENTE: una cuenta interna o de testing no es alguien a quien escribirle.
 * El creador de cada cuenta es `dueno` (el DUENO más antiguo), así que los
 * miembros invitados nunca aparecen.
 */
export function registrosRecientes(
  cuentas: CuentaAdmin[],
  ahora: Date = new Date(),
): RegistrosRecientes {
  const desde = ahora.getTime() - DIAS_REGISTROS_RECIENTES * UN_DIA_MS
  const enVentana = cuentas
    .filter((c) => c.tipoCuenta === 'CLIENTE' && new Date(c.creadaEl).getTime() >= desde)
    .sort((a, b) => new Date(b.creadaEl).getTime() - new Date(a.creadaEl).getTime())
  return { total: enVentana.length, lista: enVentana.slice(0, MAX_REGISTROS_RECIENTES) }
}

/** true si la cuenta se creó hace menos de 48 horas. */
export function esRegistroNuevo(cuenta: CuentaAdmin, ahora: Date = new Date()): boolean {
  return (
    ahora.getTime() - new Date(cuenta.creadaEl).getTime() < HORAS_REGISTRO_NUEVO * UNA_HORA_MS
  )
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

// ---------------------------------------------------------------------------
// Listado de cuentas: filtros, búsqueda y orden
// ---------------------------------------------------------------------------

/** Una cuenta sin plan es una que se registró sin elegir ninguno. */
export type FiltroPlan = Plan | 'SIN_PLAN'

export interface FiltrosCuentas {
  /** Lo que se tipeó, tal cual: se recorta recién al comparar. */
  texto: string
  /** Vacío es "todos los estados". */
  estados: EstadoVisible[]
  plan: FiltroPlan | null
  metodo: MetodoCobro | null
  /** Suma las cuentas INTERNA y TESTING, que por defecto quedan afuera. */
  incluirInternas: boolean
}

export const FILTROS_VACIOS: FiltrosCuentas = {
  texto: '',
  estados: [],
  plan: null,
  metodo: null,
  incluirInternas: false,
}

/** Si hay algún filtro puesto, el toggle de internas incluido. */
export function hayFiltros(filtros: FiltrosCuentas): boolean {
  return (
    filtros.texto.trim() !== '' ||
    filtros.estados.length > 0 ||
    filtros.plan !== null ||
    filtros.metodo !== null ||
    filtros.incluirInternas
  )
}

/** Minúsculas y sin tildes ni otras marcas: "Agustín" y "agustin" son lo mismo. */
function normalizarTexto(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()
}

/**
 * Las cuentas que cumplen todos los filtros a la vez.
 *
 * El texto busca en el nombre de la inmobiliaria y en el nombre y el email de
 * su dueño. Cada palabra tiene que aparecer en alguno de los tres, así
 * "juan perez" encuentra a "Pérez, Juan" aunque estén en otro orden.
 */
export function filtrarCuentas(cuentas: CuentaAdmin[], filtros: FiltrosCuentas): CuentaAdmin[] {
  const palabras = normalizarTexto(filtros.texto).split(/\s+/).filter(Boolean)

  return cuentas.filter((c) => {
    if (!filtros.incluirInternas && c.tipoCuenta !== 'CLIENTE') return false
    if (filtros.estados.length > 0 && !filtros.estados.includes(estadoVisible(c))) return false
    if (filtros.plan !== null && (c.plan ?? 'SIN_PLAN') !== filtros.plan) return false
    if (filtros.metodo !== null && c.metodoCobro !== filtros.metodo) return false

    if (palabras.length > 0) {
      const pajar = normalizarTexto(`${c.nombre} ${c.dueno?.nombre ?? ''} ${c.dueno?.email ?? ''}`)
      if (!palabras.every((p) => pajar.includes(p))) return false
    }
    return true
  })
}

export type CriterioOrden = 'prioridad' | 'nombre' | 'alta' | 'vence'

export const CRITERIOS_ORDEN: { valor: CriterioOrden; label: string }[] = [
  { valor: 'prioridad', label: 'Prioridad de cobranza' },
  { valor: 'nombre', label: 'Nombre' },
  { valor: 'alta', label: 'Alta más reciente' },
  { valor: 'vence', label: 'Vencimiento más próximo' },
]

function comparar(a: number, b: number): number {
  return a < b ? -1 : a > b ? 1 : 0
}

function instante(fecha: string | null): number {
  return fecha === null ? Number.NaN : new Date(fecha).getTime()
}

/**
 * Desde cuándo está vencida una cuenta, para ordenar las vencidas. Las manuales
 * vencen con su acceso pagado; las de Mercado Pago, con el último cobro que
 * falló o, si nunca pagaron, con el fin de la prueba.
 */
function fechaDeVencida(cuenta: CuentaAdmin): string | null {
  return cuenta.metodoCobro === 'MANUAL'
    ? (cuenta.accesoPagadoHasta ?? cuenta.finTrial)
    : (cuenta.ultimoPagoFallido ?? cuenta.finTrial)
}

/**
 * El orden de cobranza: primero lo que ya se perdió y lo que hay que ir a
 * buscar. Devuelve [grupo, desempate dentro del grupo].
 *   0 vencida (la que venció más recientemente primero) · 1 gracia ·
 *   2 por vencer (la más cercana primero) · 3 trial · 4 activa · 5 cancelada
 */
function clavePrioridad(cuenta: CuentaAdmin, ahora: Date): [number, number] {
  switch (cuenta.estado) {
    case 'VENCIDA': {
      const t = instante(fechaDeVencida(cuenta))
      return [0, Number.isNaN(t) ? Number.POSITIVE_INFINITY : -t]
    }
    case 'GRACIA':
      return [1, 0]
    case 'TRIAL':
    case 'ACTIVA': {
      const dias = diasParaVencer(cuenta, ahora)
      if (dias !== null && dias <= DIAS_AVISO_VENCIMIENTO) return [2, dias]
      return [cuenta.estado === 'TRIAL' ? 3 : 4, 0]
    }
    case 'CANCELADA':
      return [5, 0]
  }
}

/**
 * Ordena sin tocar la lista original. En todos los criterios el empate se
 * resuelve por nombre.
 *   prioridad  ver `clavePrioridad`
 *   nombre     alfabético
 *   alta       la más reciente primero
 *   vence      la fecha de la columna "Vence" más próxima primero (lo ya
 *              vencido, antes que nada); sin fecha, al final
 */
export function ordenarCuentas(
  cuentas: CuentaAdmin[],
  criterio: CriterioOrden = 'prioridad',
  ahora: Date = new Date(),
): CuentaAdmin[] {
  const porNombre = (a: CuentaAdmin, b: CuentaAdmin) => a.nombre.localeCompare(b.nombre, 'es')

  return [...cuentas].sort((a, b) => {
    switch (criterio) {
      case 'nombre':
        return porNombre(a, b)
      case 'alta':
        return comparar(instante(b.creadaEl), instante(a.creadaEl)) || porNombre(a, b)
      case 'vence': {
        const ta = instante(fechaDeVencimiento(a))
        const tb = instante(fechaDeVencimiento(b))
        if (Number.isNaN(ta) !== Number.isNaN(tb)) return Number.isNaN(ta) ? 1 : -1
        return (Number.isNaN(ta) ? 0 : comparar(ta, tb)) || porNombre(a, b)
      }
      case 'prioridad': {
        const [ga, da] = clavePrioridad(a, ahora)
        const [gb, db] = clavePrioridad(b, ahora)
        return comparar(ga, gb) || comparar(da, db) || porNombre(a, b)
      }
    }
  })
}

// Filtros en la URL: parámetros simples, para que el listado se conserve al
// entrar a una ficha y volver. Lo que está en su valor por defecto no se escribe.
// ?q=texto &estado=VENCIDA,SUSPENDIDA,GRACIA &plan=SOLO|AGENCIA_CHICA|AGENCIA_GRANDE|SIN_PLAN
// &metodo=MANUAL|MERCADO_PAGO &internas=1 &orden=nombre|alta|vence

/** Lee filtros y orden de la URL. Lo que no se reconoce se ignora. */
export function filtrosDesdeUrl(params: URLSearchParams): {
  filtros: FiltrosCuentas
  orden: CriterioOrden
} {
  const pedidos = new Set((params.get('estado') ?? '').split(','))
  const plan = params.get('plan')
  const metodo = params.get('metodo')
  const orden = params.get('orden')

  return {
    filtros: {
      texto: params.get('q') ?? '',
      estados: ESTADOS_VISIBLES.filter((e) => pedidos.has(e)),
      plan: plan === 'SIN_PLAN' || PLANES.some((p) => p === plan) ? (plan as FiltroPlan) : null,
      metodo: metodo === 'MANUAL' || metodo === 'MERCADO_PAGO' ? metodo : null,
      incluirInternas: params.get('internas') === '1',
    },
    orden: CRITERIOS_ORDEN.find((c) => c.valor === orden)?.valor ?? 'prioridad',
  }
}

/** Lo inverso de `filtrosDesdeUrl`. */
export function urlDesdeFiltros(filtros: FiltrosCuentas, orden: CriterioOrden): URLSearchParams {
  const params = new URLSearchParams()
  if (filtros.texto.trim() !== '') params.set('q', filtros.texto)
  if (filtros.estados.length > 0) params.set('estado', filtros.estados.join(','))
  if (filtros.plan !== null) params.set('plan', filtros.plan)
  if (filtros.metodo !== null) params.set('metodo', filtros.metodo)
  if (filtros.incluirInternas) params.set('internas', '1')
  if (orden !== 'prioridad') params.set('orden', orden)
  return params
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
 * La fecha hasta la que la cuenta tiene el servicio cubierto: el fin de la
 * prueba mientras está en TRIAL y, después, la del último pago.
 *
 * Las dos vías de cobro la guardan en columnas distintas y a propósito: la
 * manual en `acceso_pagado_hasta`, la de Mercado Pago en `fecha_proximo_cobro`
 * (que MP reescribe en cada cobro). El panel las muestra en una sola columna
 * porque para quien mira son lo mismo: hasta cuándo está paga.
 */
export function fechaDeVencimiento(cuenta: CuentaAdmin): string | null {
  if (cuenta.estado === 'TRIAL') return cuenta.finTrial
  return cuenta.metodoCobro === 'MANUAL' ? cuenta.accesoPagadoHasta : cuenta.proximoCobro
}

/** Días calendario (hora de Argentina) que faltan. Negativo si ya pasó; null si no hay fecha. */
export function diasHastaVencimiento(
  cuenta: CuentaAdmin,
  ahora: Date = new Date(),
): number | null {
  const fecha = fechaDeVencimiento(cuenta)
  return fecha ? diasHastaFechaAR(fecha, ahora) : null
}

export type AlertaCobro = 'vencida' | 'gracia' | 'por_vencer'

/**
 * El aviso que corresponde a la cuenta, o null si no hay nada que avisar.
 *
 * "Por vencer" sale de `estaPorVencer`, la misma definición que el KPI y el
 * bloque "Requiere acción".
 */
export function alertaDeCobro(cuenta: CuentaAdmin, ahora: Date = new Date()): AlertaCobro | null {
  if (cuenta.estado === 'VENCIDA') return 'vencida'
  if (cuenta.estado === 'GRACIA') return 'gracia'
  return estaPorVencer(cuenta, ahora) ? 'por_vencer' : null
}

export const ETIQUETA_ALERTA: Record<AlertaCobro, string> = {
  vencida: 'Vencida',
  gracia: 'En gracia',
  por_vencer: 'Por vencer',
}
