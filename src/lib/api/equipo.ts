import { supabase } from '../supabase'
import { limitesDelMes } from './perfil'
import type { EstadoLead, Lead } from './leads'
import type { Database } from '../../types/database'

export type RolAgente = Database['public']['Enums']['rol_agente']
export type Profile = Database['public']['Tables']['profiles']['Row']

/** Los estados que cuentan como cartera activa. Mismo criterio que el perfil. */
const ESTADOS_ACTIVOS: EstadoLead[] = ['CALIENTE', 'TIBIO', 'FRIO']

export const ROLES: { valor: RolAgente; label: string }[] = [
  { valor: 'DUENO', label: 'Dueño' },
  { valor: 'AGENTE', label: 'Agente' },
  { valor: 'ASISTENTE', label: 'Asistente' },
]

export function etiquetaRol(rol: RolAgente): string {
  return ROLES.find((r) => r.valor === rol)?.label ?? rol
}

export interface Miembro {
  id: string
  nombre: string
  apellido: string
  email: string
  rol: RolAgente
  activo: boolean
  /** Nombre completo del agente al que asiste, si es ASISTENTE. */
  asisteA: { id: string; nombre: string } | null
  /** Leads en cartera viva asignados a esta persona. */
  leadsActivos: number
}

interface FilaProfile {
  id: string
  nombre: string
  apellido: string
  email: string
  rol: RolAgente
  activo: boolean
  asiste_a: string | null
}

function nombreCompleto(p: { nombre: string; apellido: string }): string {
  return `${p.nombre} ${p.apellido}`.trim()
}

/**
 * Miembros que el usuario puede ver, según su rol.
 *
 * Un DUENO ve toda la inmobiliaria. Un AGENTE ve únicamente a su propio
 * asistente —la lista queda vacía si todavía no tiene—, porque el resto del
 * equipo no es asunto suyo. Un ASISTENTE no debería llegar acá: la pantalla lo
 * redirige antes, y de todos modos RLS le devolvería poco y nada.
 *
 * RLS acota por inmobiliaria en el server; el filtro por rol de acá es sobre
 * qué se muestra, no una barrera de seguridad.
 */
export async function listarEquipo(rol: RolAgente, miId: string): Promise<Miembro[]> {
  let query = supabase
    .from('profiles')
    .select('id, nombre, apellido, email, rol, activo, asiste_a')

  if (rol === 'AGENTE') {
    query = query.eq('asiste_a', miId)
  }

  const { data, error } = await query.order('rol').order('nombre')
  if (error) throw new Error(`No se pudo cargar el equipo: ${error.message}`)

  const perfiles = (data ?? []) as FilaProfile[]
  if (perfiles.length === 0) return []

  // Los conteos de leads salen de una sola lectura: traer `agente_id` de la
  // cartera viva y agrupar en memoria. Es una consulta en vez de una por
  // persona, y para el tamaño de un equipo el costo es despreciable.
  const { data: leads, error: errorLeads } = await supabase
    .from('leads')
    .select('agente_id')
    .or(`estado.is.null,estado.in.(${ESTADOS_ACTIVOS.join(',')})`)

  if (errorLeads) throw new Error(`No se pudo contar los leads: ${errorLeads.message}`)

  const porAgente = new Map<string, number>()
  for (const lead of leads ?? []) {
    if (lead.agente_id) porAgente.set(lead.agente_id, (porAgente.get(lead.agente_id) ?? 0) + 1)
  }

  // Para resolver "asiste a" hace falta el nombre del asistido, que puede no
  // estar en la lista visible (el caso del AGENTE, que sólo ve a su asistente).
  const nombresPorId = new Map(perfiles.map((p) => [p.id, nombreCompleto(p)]))
  const faltantes = [
    ...new Set(
      perfiles
        .map((p) => p.asiste_a)
        .filter((id): id is string => !!id && !nombresPorId.has(id)),
    ),
  ]

  if (faltantes.length > 0) {
    const { data: extra } = await supabase
      .from('profiles')
      .select('id, nombre, apellido')
      .in('id', faltantes)
    for (const p of extra ?? []) nombresPorId.set(p.id, nombreCompleto(p))
  }

  return perfiles.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    apellido: p.apellido,
    email: p.email,
    rol: p.rol,
    activo: p.activo,
    asisteA: p.asiste_a
      ? { id: p.asiste_a, nombre: nombresPorId.get(p.asiste_a) ?? 'Otro agente' }
      : null,
    leadsActivos: porAgente.get(p.id) ?? 0,
  }))
}

// ---------------------------------------------------------------------------
// Estadísticas del equipo
// ---------------------------------------------------------------------------

export interface StatsAgente {
  activos: number
  calientes: number
  nuevosDelMes: number
  ganadosMes: number
  /** Porcentaje, o `null` si nadie fue contactado todavía. */
  tasaConversion: number | null
  interacciones7d: number
}

export interface FilaStatsAgente extends StatsAgente {
  agenteId: string
  nombre: string
}

export interface StatsEquipo {
  totales: StatsAgente
  porAgente: FilaStatsAgente[]
}

/** Acumulador mutable mientras se recorren las filas. */
interface Acumulador {
  activos: number
  calientes: number
  nuevosDelMes: number
  ganadosMes: number
  ganados: number
  contactados: number
  interacciones7d: number
}

function acumuladorVacio(): Acumulador {
  return {
    activos: 0,
    calientes: 0,
    nuevosDelMes: 0,
    ganadosMes: 0,
    ganados: 0,
    contactados: 0,
    interacciones7d: 0,
  }
}

function aStats(a: Acumulador): StatsAgente {
  return {
    activos: a.activos,
    calientes: a.calientes,
    nuevosDelMes: a.nuevosDelMes,
    ganadosMes: a.ganadosMes,
    // Sin contactados la tasa no es 0%, es "todavía no se sabe".
    tasaConversion: a.contactados === 0 ? null : (a.ganados / a.contactados) * 100,
    interacciones7d: a.interacciones7d,
  }
}

/**
 * Métricas de toda la inmobiliaria más el desglose por agente.
 *
 * Mismas definiciones que el perfil personal (Fase 6a), pero sumadas sobre el
 * equipo entero. En vez de repetir las ~8 queries por cada agente, se traen
 * las filas crudas una sola vez y se agregan en memoria: son tres lecturas
 * fijas, no una por persona.
 *
 * Sin columna de tareas: eso llega en la Fase 7b.
 */
export async function obtenerStatsEquipo(): Promise<StatsEquipo> {
  const { inicio: inicioMes, fin: finMes } = limitesDelMes()
  const hace7Dias = new Date()
  hace7Dias.setDate(hace7Dias.getDate() - 7)

  const [perfiles, leads, operaciones, interacciones] = await Promise.all([
    supabase.from('profiles').select('id, nombre, apellido, rol').order('nombre'),
    supabase
      .from('leads')
      .select('agente_id, estado, fecha_ingreso, fecha_primer_contacto_real'),
    supabase
      .from('operaciones')
      .select('agente_id, estado, fecha_cierre')
      .eq('estado', 'CERRADA_GANADA')
      .gte('fecha_cierre', inicioMes)
      .lt('fecha_cierre', finMes),
    supabase
      .from('interacciones')
      .select('agente_id')
      .gte('fecha', hace7Dias.toISOString()),
  ])

  const fallo = perfiles.error ?? leads.error ?? operaciones.error ?? interacciones.error
  if (fallo) throw new Error(`No se pudieron cargar las métricas del equipo: ${fallo.message}`)

  const totales = acumuladorVacio()
  const porAgente = new Map<string, Acumulador>()
  const dame = (id: string) => {
    let a = porAgente.get(id)
    if (!a) {
      a = acumuladorVacio()
      porAgente.set(id, a)
    }
    return a
  }

  for (const lead of leads.data ?? []) {
    const destinos = lead.agente_id ? [totales, dame(lead.agente_id)] : [totales]

    const esActivo = lead.estado == null || ESTADOS_ACTIVOS.includes(lead.estado)
    const esDelMes = lead.fecha_ingreso >= inicioMes && lead.fecha_ingreso < finMes

    for (const d of destinos) {
      if (esActivo) d.activos++
      if (lead.estado === 'CALIENTE') d.calientes++
      if (lead.estado === 'GANADO') d.ganados++
      if (lead.fecha_primer_contacto_real != null) d.contactados++
      if (esDelMes) d.nuevosDelMes++
    }
  }

  for (const op of operaciones.data ?? []) {
    totales.ganadosMes++
    if (op.agente_id) dame(op.agente_id).ganadosMes++
  }

  for (const inter of interacciones.data ?? []) {
    totales.interacciones7d++
    if (inter.agente_id) dame(inter.agente_id).interacciones7d++
  }

  // Sólo agentes y dueños en el desglose: un asistente no tiene cartera propia.
  const filas = (perfiles.data ?? [])
    .filter((p) => p.rol !== 'ASISTENTE')
    .map((p) => ({
      agenteId: p.id,
      nombre: nombreCompleto(p),
      ...aStats(porAgente.get(p.id) ?? acumuladorVacio()),
    }))

  return { totales: aStats(totales), porAgente: filas }
}

// ---------------------------------------------------------------------------
// Leads del equipo (sólo DUENO)
// ---------------------------------------------------------------------------

export interface LeadDelEquipo extends Lead {
  agente: { nombre: string; apellido: string } | null
}

export interface LeadsEquipoResult {
  data: LeadDelEquipo[]
  count: number
}

/**
 * Todos los leads de la inmobiliaria, con el agente asignado.
 *
 * Sólo tiene sentido para un DUENO —la pantalla no muestra la tab a nadie
 * más—, pero la barrera real es RLS: un agente que llame a esto igual recibe
 * únicamente lo que su policy le permite.
 */
export async function listarLeadsDelEquipo(
  page: number,
  pageSize: number,
): Promise<LeadsEquipoResult> {
  const desde = (page - 1) * pageSize

  const { data, error, count } = await supabase
    .from('leads')
    .select('*, agente:profiles!leads_agente_id_fkey(nombre, apellido)', { count: 'exact' })
    .order('fecha_ingreso', { ascending: false })
    .range(desde, desde + pageSize - 1)

  if (error) throw new Error(`No se pudieron cargar los leads del equipo: ${error.message}`)

  return { data: (data ?? []) as unknown as LeadDelEquipo[], count: count ?? 0 }
}

// ---------------------------------------------------------------------------
// Activar / desactivar
// ---------------------------------------------------------------------------

export interface CupoEquipo {
  usados: number
  /**
   * Lugares del plan, o `null` si no se pudo leer.
   *
   * Hoy `inmobiliarias` no tiene policy de SELECT para usuarios autenticados,
   * así que la fila vuelve vacía y el límite queda desconocido. Se modela como
   * `null` a propósito: tratarlo como 0 haría que la UI dijera "sin cupo" y
   * bloqueara el botón de invitar cuando en realidad hay lugar de sobra.
   *
   * Quien decide de verdad es la Edge Function `crear-invitacion`, que lo
   * calcula con el cliente admin. Esto es sólo el cartelito informativo.
   */
  limite: number | null
}

/** Cuántos lugares del plan están ocupados. */
export async function obtenerCupo(): Promise<CupoEquipo> {
  const [inmobiliaria, conteo] = await Promise.all([
    supabase.from('inmobiliarias').select('limite_usuarios').maybeSingle(),
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
  ])

  if (conteo.error) throw new Error(`No se pudo leer el cupo: ${conteo.error.message}`)

  return {
    usados: conteo.count ?? 0,
    limite: inmobiliaria.data?.limite_usuarios ?? null,
  }
}

/** Llama a la Edge Function que banea/desbanea y actualiza `profiles.activo`. */
export async function toggleActivoMiembro(
  profileId: string,
  activo: boolean,
): Promise<void> {
  const { error } = await supabase.functions.invoke('toggle-activo-miembro', {
    body: { profileId, activo },
  })

  if (error) throw new Error(await mensajeDeFuncion(error, 'No se pudo cambiar el estado.'))
}

/**
 * Saca el mensaje que devolvió la Edge Function.
 *
 * `functions.invoke` envuelve los 4xx/5xx en un FunctionsHttpError cuyo
 * `message` es genérico ("Edge Function returned a non-2xx status code"); el
 * texto útil está en el body de la respuesta.
 */
export async function mensajeDeFuncion(error: unknown, porDefecto: string): Promise<string> {
  const respuesta = (error as { context?: Response })?.context
  if (respuesta && typeof respuesta.json === 'function') {
    try {
      const cuerpo = await respuesta.json()
      if (cuerpo?.error) return String(cuerpo.error)
    } catch {
      // El body no era JSON: se cae al mensaje por defecto.
    }
  }
  if (error instanceof Error && error.message) return error.message
  return porDefecto
}
