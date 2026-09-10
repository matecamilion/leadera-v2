import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { crearInteraccion } from './interacciones'
import type { EstadoVisita, Visita, VisitaInsert } from '../../types/database'

/**
 * Perfil del usuario logueado: hace falta para el alta.
 *
 * Repite el helper privado de `api/tareas.ts`. Son doce líneas y sacarlo a un
 * módulo común obligaría a tocar tareas, que está fuera del alcance de esta
 * fase; queda anotado como candidato a extraer cuando haya un tercer caso.
 */
async function miPerfil(): Promise<{ id: string; inmobiliaria_id: string }> {
  const { data: userData, error: errorUser } = await supabase.auth.getUser()
  if (errorUser || !userData.user) throw new Error('Tu sesión expiró. Volvé a entrar.')

  const { data, error } = await supabase
    .from('profiles')
    .select('id, inmobiliaria_id')
    .eq('id', userData.user.id)
    .single()

  if (error || !data) throw new Error('No encontramos tu perfil de agente.')
  return data
}

/**
 * Un UPDATE o DELETE que RLS bloquea vuelve 200 con lista vacía, no error: hay
 * que mirar cuántas filas volvieron para saber si pasó algo.
 */
function verificarAfectadas<T>(filas: T[] | null, mensaje: string): T[] {
  if (!filas || filas.length === 0) throw new Error(mensaje)
  return filas
}

// ---------------------------------------------------------------------------
// Lectura
// ---------------------------------------------------------------------------

/**
 * Visita con lo mínimo de la propiedad y el lead para pintar el panel del día
 * sin una consulta por fila.
 */
export interface VisitaConContexto extends Visita {
  propiedad: { id: string; direccion: string; zona: string | null } | null
  lead: { id: string; nombre: string; apellido: string | null } | null
}

const SELECT_CON_CONTEXTO =
  '*, propiedad:propiedades(id, direccion, zona), lead:leads(id, nombre, apellido)'

/**
 * Visitas que caen en el rango de días.
 *
 * A diferencia de `listarTareas`, acá NO se filtra por `creado_por`/`asignado_a`:
 * la policy de la tabla ya define quién ve qué —creador, asignado, dueño de la
 * inmobiliaria y la relación agente↔asistente— y repetir ese criterio en el
 * cliente sólo lograría esconder filas que el usuario sí tiene que ver.
 */
export async function listarVisitas(
  desde: string,
  hasta: string,
): Promise<VisitaConContexto[]> {
  const { data, error } = await supabase
    .from('visitas')
    .select(SELECT_CON_CONTEXTO)
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .order('fecha', { ascending: true })
    .order('hora', { ascending: true, nullsFirst: true })

  if (error) throw new Error(`No se pudieron cargar las visitas: ${error.message}`)
  return (data ?? []) as unknown as VisitaConContexto[]
}

// ---------------------------------------------------------------------------
// Alta
// ---------------------------------------------------------------------------

export interface CrearVisitaInput {
  propiedad_id: string
  lead_id?: string | null
  /**
   * Operación a la que pertenece la visita, si se eligió una.
   *
   * Un trigger de la base rechaza vincularla a una operación de otra propiedad
   * o de otro lead.
   */
  operacion_id?: string | null
  /** `YYYY-MM-DD`. */
  fecha: string
  /** `HH:MM`, o null si no hay hora pactada. */
  hora?: string | null
  notas?: string | null
  /** Si no viene, la visita queda a nombre de quien la crea. */
  asignado_a?: string | null
}

export async function crearVisita(input: CrearVisitaInput): Promise<Visita> {
  const perfil = await miPerfil()

  const fila: VisitaInsert = {
    inmobiliaria_id: perfil.inmobiliaria_id,
    creado_por: perfil.id,
    asignado_a: input.asignado_a || perfil.id,
    propiedad_id: input.propiedad_id,
    lead_id: input.lead_id || null,
    operacion_id: input.operacion_id || null,
    fecha: input.fecha,
    hora: input.hora || null,
    estado: 'AGENDADA',
    notas: input.notas?.trim() || null,
  }

  const { data, error } = await supabase.from('visitas').insert(fila).select('*').single()

  if (error || !data) {
    throw new Error(`No se pudo agendar la visita: ${error?.message ?? 'sin detalle'}`)
  }
  return data
}

// ---------------------------------------------------------------------------
// Cambios de estado
// ---------------------------------------------------------------------------

/**
 * Cuándo fechar la interacción que deja una visita marcada como realizada.
 *
 * La interacción registra CUÁNDO SE MARCÓ, no cuándo estaba agendada. Si la
 * visita ya pasó las dos cosas coinciden y se usa el horario pactado, que es
 * más preciso. Pero si todavía no llegó su fecha —se marca antes de tiempo— la
 * agendada está en el futuro, y una interacción futura ensucia las métricas:
 * cuenta en "interacciones de los últimos 7 días" y, por el trigger que mueve
 * `fecha_ultimo_contacto_real`, en "contactados hoy" del dashboard.
 */
function momentoDeLaInteraccion(fecha: string, hora: string | null): string {
  const [ano, mes, dia] = fecha.split('-').map(Number)
  const [hh, mm] = (hora ?? '00:00').split(':').map(Number)
  const agendada = new Date(ano, mes - 1, dia, hh, mm)
  const ahora = new Date()
  return (agendada > ahora ? ahora : agendada).toISOString()
}

/**
 * Marca la visita como hecha y, si tenía lead, le deja la interacción.
 *
 * El registro automático es lo que hace que una visita no se pierda del
 * historial del lead. Sin `lead_id` no hay a quién atribuírsela, así que no se
 * inventa nada.
 *
 * Si la visita estaba vinculada a una operación, la interacción hereda ese
 * `operacion_id` y aparece también en el timeline de esa operación: marcarla
 * realizada alcanza, no hay que volver a cargarla a mano allá.
 */
export async function marcarRealizada(id: string): Promise<Visita> {
  const cambio: { estado: EstadoVisita } = { estado: 'REALIZADA' }

  const { data, error } = await supabase
    .from('visitas')
    .update(cambio)
    .eq('id', id)
    .select('*')

  if (error) throw new Error(`No se pudo marcar la visita: ${error.message}`)
  const visita = verificarAfectadas(data, 'No tenés permiso para cambiar esta visita.')[0]

  if (!visita.lead_id) return visita

  try {
    await crearInteraccion({
      lead_id: visita.lead_id,
      operacion_id: visita.operacion_id,
      tipo: 'VISITA',
      detalle: 'Visita a la propiedad realizada',
      fecha: momentoDeLaInteraccion(visita.fecha, visita.hora),
    })
  } catch {
    // La visita ya quedó REALIZADA: hay que decirlo, o el usuario reintenta
    // creyendo que no pasó nada y termina con la interacción duplicada.
    throw new Error(
      'La visita quedó marcada como realizada, pero no se pudo registrar la interacción en el lead.',
    )
  }

  return visita
}

export async function cancelarVisita(id: string): Promise<void> {
  const cambio: { estado: EstadoVisita } = { estado: 'CANCELADA' }

  const { data, error } = await supabase
    .from('visitas')
    .update(cambio)
    .eq('id', id)
    .select('id')

  if (error) throw new Error(`No se pudo cancelar la visita: ${error.message}`)
  verificarAfectadas(data, 'No tenés permiso para cancelar esta visita.')
}

export async function eliminarVisita(id: string): Promise<string | null> {
  // Mismo motivo que en `eliminarTarea`: el RETURNING es la última chance de
  // leer `google_event_id` antes de que la fila deje de existir.
  const { data, error } = await (supabase as SupabaseClient)
    .from('visitas')
    .delete()
    .eq('id', id)
    .select('id, google_event_id')

  if (error) throw new Error(`No se pudo eliminar la visita: ${error.message}`)
  verificarAfectadas(data, 'No tenés permiso para eliminar esta visita.')

  return (data?.[0]?.google_event_id as string | null) ?? null
}

// ---------------------------------------------------------------------------
// Estadísticas agregadas
//
// Van por RPC y no por una query directa a `visitas` a propósito: las policies
// de la tabla acotan lo que cada usuario ve fila por fila, así que un `count`
// desde el cliente daría "las visitas que YO puedo ver" y no las de la
// propiedad. Las funciones son SECURITY DEFINER, devuelven sólo números, y
// validan del lado del server que la propiedad/lead sea de la inmobiliaria del
// usuario.
// ---------------------------------------------------------------------------

export interface EstadisticasVisitasPropiedad {
  visitasRealizadas: number
  visitasAgendadas: number
  /** Leads distintos que visitaron o tienen agendada una visita. */
  interesadosUnicos: number
}

const SIN_VISITAS: EstadisticasVisitasPropiedad = {
  visitasRealizadas: 0,
  visitasAgendadas: 0,
  interesadosUnicos: 0,
}

/**
 * Los contadores llegan de columnas `bigint`. PostgREST las serializa como
 * número JSON, pero el `Number()` está igual por si alguna vez viniera como
 * string: un `'3'` sin castear rompería el chequeo de "los tres en cero".
 */
function aEntero(valor: unknown): number {
  const n = Number(valor)
  return Number.isFinite(n) ? n : 0
}

export async function obtenerEstadisticasVisitasPropiedad(
  propiedadId: string,
): Promise<EstadisticasVisitasPropiedad> {
  const { data, error } = await supabase.rpc('estadisticas_visitas_propiedad', {
    p_propiedad_id: propiedadId,
  })

  if (error) {
    throw new Error(`No se pudo cargar la actividad de la propiedad: ${error.message}`)
  }

  // La función devuelve una tabla de una fila; sin filas, no hubo actividad.
  const fila = data?.[0]
  if (!fila) return SIN_VISITAS

  return {
    visitasRealizadas: aEntero(fila.visitas_realizadas),
    visitasAgendadas: aEntero(fila.visitas_agendadas),
    interesadosUnicos: aEntero(fila.interesados_unicos),
  }
}

/** Cuántas visitas REALIZADA acumula el lead. */
export async function contarVisitasDeLead(leadId: string): Promise<number> {
  const { data, error } = await supabase.rpc('contar_visitas_lead', {
    p_lead_id: leadId,
  })

  if (error) {
    throw new Error(`No se pudieron contar las visitas del lead: ${error.message}`)
  }
  return aEntero(data)
}
