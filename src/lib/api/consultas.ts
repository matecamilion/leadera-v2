import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import type { Database } from '../../types/database'
import { interpretarErrorSupabase } from '../errores'

/**
 * Bandeja de consultas que entran por el link público.
 *
 * Qué ve cada uno lo decide la RLS (`consultas_select`): el agente las suyas,
 * el asistente las del agente al que asiste y el dueño todas, incluidos los
 * duplicados de otro agente. Las acciones van por RPC; ninguna escribe directo.
 */

type Fila = Database['public']['Tables']['consultas']['Row']
type RolAgente = Database['public']['Enums']['rol_agente']

export type FiltroConsultas = 'pendientes' | 'aceptadas' | 'vinculadas' | 'descartadas' | 'archivadas'

export const FILTROS_CONSULTAS: { id: FiltroConsultas; label: string }[] = [
  { id: 'pendientes', label: 'Pendientes' },
  { id: 'aceptadas', label: 'Aceptadas' },
  { id: 'vinculadas', label: 'Vinculadas' },
  { id: 'descartadas', label: 'Descartadas' },
  { id: 'archivadas', label: 'Archivadas' },
]

/** Una PENDIENTE sin resolver pasa a archivada a los 30 días (sin cron: es un corte de fecha). */
export const DIAS_ARCHIVO = 30
/** Cuánto se muestran los "volvió a consultar", que ya quedaron vinculados solos. */
export const DIAS_VOLVIERON = 7
export const POR_PAGINA = 25

export interface NombrePersona {
  nombre: string
  apellido: string | null
}

export interface Consulta extends Omit<Fila, 'ip_hash'> {
  agente: NombrePersona | null
  propiedad: { id: string; tipo: string; zona: string | null; direccion: string } | null
  /** null si no hay o si la RLS no deja verlo (lead de otro agente). */
  lead_existente: (NombrePersona & { id: string; agente: NombrePersona | null }) | null
}

/**
 * Columnas explícitas: `ip_hash` no tiene grant para `authenticated`, y un
 * `select('*')` fallaría entero por esa sola columna.
 */
const COLUMNAS = [
  'id, link_id, inmobiliaria_id, agente_id, propiedad_id',
  'nombre, apellido, telefono, telefono_norm, email',
  'respuestas, resumen, busqueda',
  'puntaje, temperatura, presupuesto_respondido, posible_captacion',
  'estado, lead_id, lead_existente_id, duplicado_por, duplicado_otro_agente',
  'volvio_a_consultar, motivo_descarte, aviso_pendiente',
  'consentimiento_at, created_at, resuelta_at, resuelta_por',
  'agente:profiles!consultas_agente_id_fkey(nombre, apellido)',
  'propiedad:propiedades!consultas_propiedad_id_fkey(id, tipo, zona, direccion)',
  'lead_existente:leads!consultas_lead_existente_id_fkey(id, nombre, apellido, agente:profiles!leads_agente_id_fkey(nombre, apellido))',
].join(', ')

function haceDias(dias: number): string {
  return new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString()
}

export interface PaginaConsultas {
  consultas: Consulta[]
  total: number
}

/**
 * Una página de la bandeja.
 *
 * Pendientes: primero lo que solo el dueño puede resolver (duplicado de otro
 * agente) y lo que quedó trabado con aviso (límite del plan); después las de
 * más puntaje.
 */
export async function listarConsultas(
  filtro: FiltroConsultas,
  page: number,
  agenteId?: string,
): Promise<PaginaConsultas> {
  const desde = (page - 1) * POR_PAGINA
  let q = supabase.from('consultas').select(COLUMNAS, { count: 'exact' })

  if (agenteId) q = q.eq('agente_id', agenteId)

  switch (filtro) {
    case 'pendientes':
      q = q
        .eq('estado', 'PENDIENTE')
        .gte('created_at', haceDias(DIAS_ARCHIVO))
        .order('duplicado_otro_agente', { ascending: false })
        .order('aviso_pendiente', { ascending: false, nullsFirst: false })
        .order('puntaje', { ascending: false })
        .order('created_at', { ascending: false })
      break
    case 'archivadas':
      q = q
        .eq('estado', 'PENDIENTE')
        .lt('created_at', haceDias(DIAS_ARCHIVO))
        .order('created_at', { ascending: false })
      break
    case 'aceptadas':
      q = q.in('estado', ['ACEPTADA', 'AUTO_ACEPTADA']).order('resuelta_at', { ascending: false })
      break
    case 'vinculadas':
      q = q.eq('estado', 'VINCULADA').order('resuelta_at', { ascending: false })
      break
    case 'descartadas':
      q = q.eq('estado', 'DESCARTADA').order('resuelta_at', { ascending: false })
      break
  }

  const { data, error, count } = await q.range(desde, desde + POR_PAGINA - 1)
  if (error) throw new Error(interpretarErrorSupabase(error, 'No se pudieron cargar las consultas.'))
  return { consultas: (data ?? []) as unknown as Consulta[], total: count ?? 0 }
}

/**
 * Los "volvió a consultar" de los últimos días: ya quedaron vinculados solos a
 * su lead, así que no piden acción, pero conviene que el agente se entere.
 */
export async function listarVolvieron(agenteId?: string, limite = 10): Promise<Consulta[]> {
  let q = supabase
    .from('consultas')
    .select(COLUMNAS)
    .eq('estado', 'VINCULADA')
    .eq('volvio_a_consultar', true)
    .gte('resuelta_at', haceDias(DIAS_VOLVIERON))
    .order('resuelta_at', { ascending: false })
    .limit(limite)
  if (agenteId) q = q.eq('agente_id', agenteId)

  const { data, error } = await q
  if (error) throw new Error(interpretarErrorSupabase(error, 'No se pudieron cargar las consultas.'))
  return (data ?? []) as unknown as Consulta[]
}

/**
 * Lo que pide acción de quien está logueado: el número del badge.
 *
 * Agente y asistente: la RLS ya acota a lo suyo. Dueño: sus pendientes más los
 * duplicados de otro agente, que solo él resuelve; no las de todo el equipo,
 * que inflarían el número con trabajo que no es suyo.
 */
interface FiltrableConsultas<Q> {
  eq(columna: 'estado', valor: 'PENDIENTE'): Q
  gte(columna: 'created_at', valor: string): Q
  or(filtros: string): Q
}

function pendientesQueMeTocan<Q extends FiltrableConsultas<Q>>(
  q: Q,
  rol: RolAgente | undefined,
  uid: string,
): Q {
  const base = q.eq('estado', 'PENDIENTE').gte('created_at', haceDias(DIAS_ARCHIVO))
  return rol === 'DUENO' ? base.or(`agente_id.eq.${uid},duplicado_otro_agente.is.true`) : base
}

export async function contarPendientes(rol: RolAgente | undefined, uid: string): Promise<number> {
  const { count, error } = await pendientesQueMeTocan(
    supabase.from('consultas').select('id', { count: 'exact', head: true }),
    rol,
    uid,
  )
  if (error) throw new Error(interpretarErrorSupabase(error, 'No se pudieron contar las consultas.'))
  return count ?? 0
}

export interface ResumenConsultas {
  pendientes: Consulta[]
  totalPendientes: number
  volvieron: Consulta[]
}

/** Para la tarjeta de Mi día: las 3 de más puntaje y los que volvieron. */
export async function obtenerResumenConsultas(
  rol: RolAgente | undefined,
  uid: string,
): Promise<ResumenConsultas> {
  const [pendientes, volvieron] = await Promise.all([
    pendientesQueMeTocan(supabase.from('consultas').select(COLUMNAS, { count: 'exact' }), rol, uid)
      .order('puntaje', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(3),
    listarVolvieron(rol === 'DUENO' ? uid : undefined, 3),
  ])
  if (pendientes.error) {
    throw new Error(interpretarErrorSupabase(pendientes.error, 'No se pudieron cargar las consultas.'))
  }
  return {
    pendientes: (pendientes.data ?? []) as unknown as Consulta[],
    totalPendientes: pendientes.count ?? 0,
    volvieron,
  }
}

/**
 * Las consultas que terminaron en este lead: la que lo creó (aceptada, a mano
 * o sola) y las de cuando volvió a consultar. De la más vieja a la más nueva.
 */
export async function listarConsultasDeLead(leadId: string): Promise<Consulta[]> {
  const { data, error } = await supabase
    .from('consultas')
    .select(COLUMNAS)
    .eq('lead_id', leadId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(interpretarErrorSupabase(error, 'No se pudieron cargar las consultas del lead.'))
  return (data ?? []) as unknown as Consulta[]
}

// ---------------------------------------------------------------------------
// Acciones
// ---------------------------------------------------------------------------

export type ResultadoAceptar =
  | { tipo: 'ok'; leadId: string }
  /** El trigger del plan rechazó el alta; el motivo queda en `aviso_pendiente`. */
  | { tipo: 'limite' }
  | { tipo: 'ya_resuelta' }
  /** Ya hay un lead con ese email. `lead` es null si la RLS no deja verlo. */
  | { tipo: 'email_duplicado'; email: string; lead: { id: string; nombre: string; apellido: string | null } | null }
  | { tipo: 'sin_acceso' }

/** Errores de las RPC que no son fallas sino el estado de la consulta. */
function desenlaceComun(error: PostgrestError): { tipo: 'ya_resuelta' } | { tipo: 'sin_acceso' } | null {
  if (error.code === '55000') return { tipo: 'ya_resuelta' }
  if (error.code === 'P0002') return { tipo: 'sin_acceso' }
  return null
}

export async function aceptarConsulta(consulta: Pick<Consulta, 'id' | 'email'>): Promise<ResultadoAceptar> {
  const { data, error } = await supabase.rpc('aceptar_consulta', { p_consulta_id: consulta.id })

  if (error) {
    const comun = desenlaceComun(error)
    if (comun) return comun

    // 23505: el índice único de email por inmobiliaria. La RPC no lo atrapa a
    // propósito (ver la migración). Se busca el lead con la RLS de quien
    // acepta: si lo ve, se linkea directo; si es de otro agente, no.
    if (error.code === '23505' && consulta.email) {
      const { data: lead } = await supabase
        .from('leads')
        .select('id, nombre, apellido')
        .ilike('email', consulta.email.replace(/[\\%_]/g, (c) => `\\${c}`))
        .limit(1)
        .maybeSingle()
      return { tipo: 'email_duplicado', email: consulta.email, lead: lead ?? null }
    }

    throw new Error(interpretarErrorSupabase(error, 'No se pudo aceptar la consulta.'))
  }

  const fila = Array.isArray(data) ? data[0] : null
  if (fila?.resultado === 'OK' && fila.lead_id) return { tipo: 'ok', leadId: fila.lead_id }
  if (fila?.resultado === 'LIMITE_ALCANZADO') return { tipo: 'limite' }
  return { tipo: 'ya_resuelta' }
}

export type ResultadoAccion = { tipo: 'ok' } | { tipo: 'ya_resuelta' } | { tipo: 'sin_acceso' }

export async function descartarConsulta(id: string, motivo: string | null): Promise<ResultadoAccion> {
  const { error } = await supabase.rpc('descartar_consulta', {
    p_consulta_id: id,
    ...(motivo ? { p_motivo: motivo } : {}),
  })
  if (!error) return { tipo: 'ok' }
  const comun = desenlaceComun(error)
  if (comun) return comun
  throw new Error(interpretarErrorSupabase(error, 'No se pudo descartar la consulta.'))
}

export async function vincularConsulta(id: string): Promise<ResultadoAccion> {
  const { error } = await supabase.rpc('vincular_consulta', { p_consulta_id: id })
  if (!error) return { tipo: 'ok' }
  const comun = desenlaceComun(error)
  if (comun) return comun
  throw new Error(interpretarErrorSupabase(error, 'No se pudo vincular la consulta.'))
}
