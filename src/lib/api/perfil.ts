import { supabase } from '../supabase'
import { TOPE_META_MENSUAL } from '../validaciones'
import type { EstadoLead, OrigenLead } from './leads'
import type { Database } from '../../types/database'
import {
  diasDelPeriodo,
  type DiaEvolucion,
  type PeriodoEvolucion,
} from '../graficoUtils'
import { interpretarErrorSupabase } from '../errores'

/** Los estados que cuentan como cartera activa. `null` también entra. */
const ESTADOS_ACTIVOS: EstadoLead[] = ['CALIENTE', 'TIBIO', 'FRIO']

/** Una propiedad se considera frenada después de estos días sin tocarse. */
export const DIAS_SIN_MOVIMIENTO = 15

export interface TotalPorMoneda {
  moneda: string
  total: number
}

export interface ConteoOrigen {
  origen: OrigenLead
  cantidad: number
  porcentaje: number
}

export interface PropiedadFrenada {
  id: string
  direccion: string
  diasSinMovimiento: number
}

export interface MetricasPerfil {
  /** Cartera viva: excluye GANADO e INACTIVO. */
  activos: number
  calientes: number
  tibios: number
  frios: number
  ganadosMes: number
  perdidosMes: number
  nuevosDelMes: number
  interacciones7d: number
  /** Porcentaje, o `null` si todavía no hay ningún lead contactado. */
  tasaConversion: number | null
  /** Promedio de días entre alta y primer contacto, o `null` si no hay datos. */
  tiempoRespuestaDias: number | null
  origenes: ConteoOrigen[]
  valorPipelineAbierto: TotalPorMoneda[]
  propiedadesSinMovimiento: PropiedadFrenada[]
  metaMensualGanados: number
  /** Días que quedan del mes contando hoy. */
  diasRestantesMes: number
}

/** Primer instante del mes en curso y del siguiente, en hora local. */
export function limitesDelMes(ahora: Date = new Date()): { inicio: string; fin: string } {
  const inicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1)
  const fin = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1)
  return { inicio: inicio.toISOString(), fin: fin.toISOString() }
}

/**
 * Días que faltan para terminar el mes, contando hoy.
 *
 * Se cuenta hoy porque el ritmo necesario es "cuántos cierres por día de acá
 * en adelante": si hoy todavía se puede cerrar, hoy suma. Nunca da 0, así que
 * la división del ritmo no necesita guarda aparte.
 */
export function diasRestantesDelMes(ahora: Date = new Date()): number {
  const ultimoDia = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0).getDate()
  return ultimoDia - ahora.getDate() + 1
}

function contar(promesa: { count: number | null; error: unknown }): number {
  return promesa.count ?? 0
}

/**
 * Métricas personales del agente logueado.
 *
 * TODO lo de acá va filtrado por `agente_id = usuario actual`, incluso si el
 * usuario es DUEÑO: esta pantalla es "mi perfil", no el panel de la
 * inmobiliaria. RLS ya acota a la inmobiliaria; el filtro por agente es lo
 * que hace que las cifras sean personales.
 */
export async function obtenerMetricasPerfil(): Promise<MetricasPerfil> {
  const { data: userData, error: errorUser } = await supabase.auth.getUser()
  if (errorUser || !userData.user) throw new Error('Tu sesión expiró. Volvé a entrar.')

  const agenteId = userData.user.id
  const { inicio: inicioMes, fin: finMes } = limitesDelMes()

  const hace7Dias = new Date()
  hace7Dias.setDate(hace7Dias.getDate() - 7)

  const corteSinMovimiento = new Date()
  corteSinMovimiento.setDate(corteSinMovimiento.getDate() - DIAS_SIN_MOVIMIENTO)

  const leadsDelAgente = () => supabase.from('leads').select('id', { count: 'exact', head: true }).eq('agente_id', agenteId)

  const [
    activos,
    calientes,
    tibios,
    frios,
    ganadosMes,
    perdidosMes,
    nuevosDelMes,
    interacciones7d,
    leadsGanados,
    leadsContactados,
    tiempos,
    origenes,
    pipeline,
    propiedades,
    perfil,
  ] = await Promise.all([
    // Cartera activa: sin estado (= nuevo) o en alguna temperatura.
    leadsDelAgente().or(
      `estado.is.null,estado.in.(${ESTADOS_ACTIVOS.join(',')})`,
    ),
    leadsDelAgente().eq('estado', 'CALIENTE'),
    leadsDelAgente().eq('estado', 'TIBIO'),
    leadsDelAgente().eq('estado', 'FRIO'),

    supabase
      .from('operaciones')
      .select('id', { count: 'exact', head: true })
      .eq('agente_id', agenteId)
      .eq('estado', 'CERRADA_GANADA')
      .gte('fecha_cierre', inicioMes)
      .lt('fecha_cierre', finMes),

    // Aproximado: no hay historial de cambios de estado, así que no se puede
    // saber CUÁNDO una operación pasó a CANCELADA. Se usa `updated_at` como
    // proxy, lo que sobrecuenta si una operación cancelada hace meses se
    // editó este mes, y subcuenta si se canceló este mes y nada la volvió a
    // tocar (esto último no pasa: cancelarla ya escribe updated_at). Para que
    // sea exacto haría falta una tabla de eventos de operación.
    supabase
      .from('operaciones')
      .select('id', { count: 'exact', head: true })
      .eq('agente_id', agenteId)
      .eq('estado', 'CANCELADA')
      .gte('updated_at', inicioMes)
      .lt('updated_at', finMes),

    leadsDelAgente().gte('fecha_ingreso', inicioMes).lt('fecha_ingreso', finMes),

    supabase
      .from('interacciones')
      .select('id', { count: 'exact', head: true })
      .eq('agente_id', agenteId)
      .gte('fecha', hace7Dias.toISOString()),

    // Numerador y denominador de la tasa de conversión.
    leadsDelAgente().eq('estado', 'GANADO'),
    leadsDelAgente().not('fecha_primer_contacto_real', 'is', null),

    // Para el tiempo de respuesta hace falta el par de fechas, no un conteo.
    supabase
      .from('leads')
      .select('fecha_ingreso, fecha_primer_contacto_real')
      .eq('agente_id', agenteId)
      .not('fecha_primer_contacto_real', 'is', null),

    supabase.from('leads').select('origen').eq('agente_id', agenteId),

    supabase
      .from('operaciones')
      .select('monto, moneda')
      .eq('agente_id', agenteId)
      .in('estado', ['PUBLICADA', 'RESERVADA', 'EN_NEGOCIACION']),

    supabase
      .from('propiedades')
      .select('id, direccion, updated_at')
      .eq('agente_id', agenteId)
      .eq('estado', 'DISPONIBLE')
      .lt('updated_at', corteSinMovimiento.toISOString())
      .order('updated_at', { ascending: true }),

    supabase
      .from('profiles')
      .select('meta_mensual_ganados')
      .eq('id', agenteId)
      .single(),
  ])

  const fallo =
    activos.error ??
    calientes.error ??
    tibios.error ??
    frios.error ??
    ganadosMes.error ??
    perdidosMes.error ??
    nuevosDelMes.error ??
    interacciones7d.error ??
    leadsGanados.error ??
    leadsContactados.error ??
    tiempos.error ??
    origenes.error ??
    pipeline.error ??
    propiedades.error ??
    perfil.error
  if (fallo) throw new Error(interpretarErrorSupabase(fallo, 'No se pudieron cargar tus métricas.'))

  const contactados = contar(leadsContactados)

  return {
    activos: contar(activos),
    calientes: contar(calientes),
    tibios: contar(tibios),
    frios: contar(frios),
    ganadosMes: contar(ganadosMes),
    perdidosMes: contar(perdidosMes),
    nuevosDelMes: contar(nuevosDelMes),
    interacciones7d: contar(interacciones7d),
    // Sin leads contactados la tasa no es 0%, es "todavía no se sabe".
    tasaConversion: contactados === 0 ? null : (contar(leadsGanados) / contactados) * 100,
    tiempoRespuestaDias: promedioDiasRespuesta(tiempos.data ?? []),
    origenes: agruparOrigenes(origenes.data ?? []),
    valorPipelineAbierto: sumarPorMoneda(pipeline.data ?? []),
    propiedadesSinMovimiento: aPropiedadesFrenadas(propiedades.data ?? []),
    metaMensualGanados: perfil.data?.meta_mensual_ganados ?? 5,
    diasRestantesMes: diasRestantesDelMes(),
  }
}

const MS_POR_DIA = 86_400_000

function promedioDiasRespuesta(
  filas: { fecha_ingreso: string; fecha_primer_contacto_real: string | null }[],
): number | null {
  const dias = filas
    .filter((f) => f.fecha_primer_contacto_real != null)
    .map(
      (f) =>
        (new Date(f.fecha_primer_contacto_real!).getTime() -
          new Date(f.fecha_ingreso).getTime()) /
        MS_POR_DIA,
    )
    // Un contacto anterior al alta sólo puede venir de una carga a mano con
    // fecha vieja; contarlo como negativo bajaría el promedio sin sentido.
    .filter((d) => Number.isFinite(d) && d >= 0)

  if (dias.length === 0) return null
  return dias.reduce((a, b) => a + b, 0) / dias.length
}

function agruparOrigenes(filas: { origen: OrigenLead }[]): ConteoOrigen[] {
  const porOrigen = new Map<OrigenLead, number>()
  for (const fila of filas) {
    porOrigen.set(fila.origen, (porOrigen.get(fila.origen) ?? 0) + 1)
  }

  const total = filas.length
  return [...porOrigen.entries()]
    .map(([origen, cantidad]) => ({
      origen,
      cantidad,
      porcentaje: total === 0 ? 0 : Math.round((cantidad / total) * 100),
    }))
    .sort((a, b) => b.cantidad - a.cantidad)
}

/** Mismo criterio que el Kanban: nunca se suma USD con ARS. */
function sumarPorMoneda(filas: { monto: number | null; moneda: string }[]): TotalPorMoneda[] {
  const porMoneda = new Map<string, number>()
  for (const fila of filas) {
    if (fila.monto == null) continue
    porMoneda.set(fila.moneda, (porMoneda.get(fila.moneda) ?? 0) + fila.monto)
  }
  return [...porMoneda.entries()]
    .map(([moneda, total]) => ({ moneda, total }))
    .sort((a, b) => b.total - a.total)
}

function aPropiedadesFrenadas(
  filas: { id: string; direccion: string; updated_at: string }[],
): PropiedadFrenada[] {
  const ahora = Date.now()
  return filas.map((fila) => ({
    id: fila.id,
    direccion: fila.direccion,
    diasSinMovimiento: Math.floor((ahora - new Date(fila.updated_at).getTime()) / MS_POR_DIA),
  }))
}

type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

/** Guarda la meta del mes en el profile del agente logueado. */
export async function actualizarMetaMensual(nuevaMeta: number): Promise<number> {
  const { data: userData, error: errorUser } = await supabase.auth.getUser()
  if (errorUser || !userData.user) throw new Error('Tu sesión expiró. Volvé a entrar.')

  const meta = Math.trunc(nuevaMeta)
  if (!Number.isFinite(meta) || meta < 1) {
    throw new Error('La meta tiene que ser un número mayor a 0.')
  }
  // Techo de cordura: la barra de progreso divide por este número, así que una
  // meta desmedida la deja clavada en 0% y el panel deja de decir nada. Hoy no
  // hay formulario que llame a esto, así que la validación vive acá y no en una
  // pantalla; cuando exista, conviene que muestre el mismo tope.
  if (meta > TOPE_META_MENSUAL) {
    throw new Error(`La meta no puede ser mayor a ${TOPE_META_MENSUAL}.`)
  }

  const cambio: ProfileUpdate = { meta_mensual_ganados: meta }

  const { data, error } = await supabase
    .from('profiles')
    .update(cambio)
    .eq('id', userData.user.id)
    .select('meta_mensual_ganados')

  if (error) throw new Error(interpretarErrorSupabase(error, 'No se pudo guardar la meta.'))
  // Un UPDATE que RLS bloquea vuelve 200 con lista vacía, no error.
  if (!data || data.length === 0) throw new Error('No tenés permiso para cambiar tu meta.')

  return data[0].meta_mensual_ganados
}

// ---------------------------------------------------------------------------
// Embudo de conversión (Fase 6b)
// ---------------------------------------------------------------------------

/** Operaciones que ya implican una oferta sobre la mesa. */
const ESTADOS_CON_OFERTA = ['EN_NEGOCIACION', 'RESERVADA', 'CERRADA_GANADA'] as const

export interface Embudo {
  contactados: number
  calificados: number
  visita: number
  oferta: number
  cerrado: number
}

/** Devuelve los `lead_id` distintos y no nulos de un resultado de PostgREST. */
function leadsUnicos(filas: { lead_id: string | null }[] | null): Set<string> {
  const set = new Set<string>()
  for (const fila of filas ?? []) {
    if (fila.lead_id) set.add(fila.lead_id)
  }
  return set
}

/**
 * Las 5 etapas del embudo, siempre del agente logueado.
 *
 * Las dos primeras salen de un `count` sobre leads. Las tres últimas NO pueden
 * hacerlo: se cuentan leads únicos, y un mismo lead puede tener varias
 * operaciones o varias visitas, así que un `count` sobre esas tablas contaría
 * filas y no personas. Por eso se traen los `lead_id` y se deduplican acá.
 *
 * "Visita" salía antes de unir dos tablas: interacciones tipo VISITA más
 * eventos de operación tipo VISITA. Desde que los eventos de operación SON
 * interacciones (con `operacion_id`), las dos ramas son la misma fila y alcanza
 * con una sola query; que la visita esté atada o no a una operación no cambia
 * que el lead la tuvo. CONSULTA nunca contó para esta etapa y sigue sin contar.
 */
export async function obtenerEmbudo(): Promise<Embudo> {
  const { data: userData, error: errorUser } = await supabase.auth.getUser()
  if (errorUser || !userData.user) throw new Error('Tu sesión expiró. Volvé a entrar.')

  const agenteId = userData.user.id

  const [contactados, calificados, conVisita, conOferta, cerradas] =
    await Promise.all([
      supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('agente_id', agenteId)
        .not('fecha_primer_contacto_real', 'is', null),

      supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('agente_id', agenteId)
        .not('estado', 'is', null),

      supabase
        .from('interacciones')
        .select('lead_id')
        .eq('agente_id', agenteId)
        .eq('tipo', 'VISITA'),

      supabase
        .from('operaciones')
        .select('lead_id')
        .eq('agente_id', agenteId)
        .in('estado', ESTADOS_CON_OFERTA),

      supabase
        .from('operaciones')
        .select('lead_id')
        .eq('agente_id', agenteId)
        .eq('estado', 'CERRADA_GANADA'),
    ])

  const fallo =
    contactados.error ??
    calificados.error ??
    conVisita.error ??
    conOferta.error ??
    cerradas.error
  if (fallo) throw new Error(interpretarErrorSupabase(fallo, 'No se pudo cargar tu embudo.'))

  return {
    contactados: contactados.count ?? 0,
    calificados: calificados.count ?? 0,
    visita: leadsUnicos(conVisita.data).size,
    oferta: leadsUnicos(conOferta.data).size,
    cerrado: leadsUnicos(cerradas.data).size,
  }
}

// ---------------------------------------------------------------------------
// Evolución temporal (Fase 6b)
// ---------------------------------------------------------------------------

/**
 * Serie diaria de nuevos / ganados / perdidos.
 *
 * La función SQL es SECURITY INVOKER y filtra por `auth.uid()`, así que ya
 * viene acotada al agente logueado: no hace falta —ni se puede— pasarle un id.
 * Devuelve un día por fila, incluidos los que están en cero.
 */
export async function obtenerEvolucion(
  periodo: PeriodoEvolucion,
): Promise<DiaEvolucion[]> {
  const { data, error } = await supabase.rpc('obtener_evolucion_agente', {
    dias: diasDelPeriodo(periodo),
  })

  if (error) throw new Error(interpretarErrorSupabase(error, 'No se pudo cargar tu evolución.'))
  return data ?? []
}

// ---------------------------------------------------------------------------
// Configuración de la cuenta
// ---------------------------------------------------------------------------

/** Mínimo que pide el signup; el cambio de contraseña usa la misma regla. */
export const LARGO_MINIMO_PASSWORD = 8

export interface DatosCuenta {
  nombre: string
  apellido: string
}

/**
 * Guarda nombre y apellido del agente logueado.
 *
 * El email y el rol no se tocan desde acá: el email es la identidad de auth y
 * el rol lo define quien invita, no el propio usuario.
 */
export async function actualizarDatosCuenta(datos: DatosCuenta): Promise<DatosCuenta> {
  const { data: userData, error: errorUser } = await supabase.auth.getUser()
  if (errorUser || !userData.user) throw new Error('Tu sesión expiró. Volvé a entrar.')

  const nombre = datos.nombre.trim()
  const apellido = datos.apellido.trim()
  if (!nombre) throw new Error('El nombre no puede quedar vacío.')
  if (!apellido) throw new Error('El apellido no puede quedar vacío.')

  const cambio: ProfileUpdate = { nombre, apellido }

  const { data, error } = await supabase
    .from('profiles')
    .update(cambio)
    .eq('id', userData.user.id)
    .select('nombre, apellido')

  if (error) throw new Error(interpretarErrorSupabase(error, 'No se pudieron guardar tus datos.'))
  // Un UPDATE que RLS bloquea vuelve 200 con lista vacía, no error.
  if (!data || data.length === 0) {
    throw new Error('No tenés permiso para cambiar tus datos.')
  }

  return data[0]
}

export interface CambioPassword {
  actual: string
  nueva: string
}

/**
 * Cambia la contraseña del usuario logueado.
 *
 * Antes del update revalidamos la actual con un signInWithPassword: la API de
 * Supabase acepta `updateUser({ password })` con sólo tener sesión válida, así
 * que sin este paso una sesión abierta y desatendida alcanzaría para tomar la
 * cuenta. El re-login es sobre el mismo usuario, así que sólo refresca los
 * tokens; no cambia de sesión ni dispara un SIGNED_OUT.
 */
export async function cambiarPassword({ actual, nueva }: CambioPassword): Promise<void> {
  const { data: userData, error: errorUser } = await supabase.auth.getUser()
  const email = userData.user?.email
  if (errorUser || !email) throw new Error('Tu sesión expiró. Volvé a entrar.')

  if (nueva.length < LARGO_MINIMO_PASSWORD) {
    throw new Error(`La contraseña nueva tiene que tener al menos ${LARGO_MINIMO_PASSWORD} caracteres.`)
  }
  if (nueva === actual) {
    throw new Error('La contraseña nueva tiene que ser distinta de la actual.')
  }

  const { error: errorLogin } = await supabase.auth.signInWithPassword({
    email,
    password: actual,
  })
  if (errorLogin) throw new Error('La contraseña actual no es correcta.')

  const { error } = await supabase.auth.updateUser({ password: nueva })
  if (error) throw new Error(interpretarErrorSupabase(error, 'No se pudo cambiar la contraseña.'))
}
