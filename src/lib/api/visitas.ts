import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { crearInteraccion } from './interacciones'
import type { EstadoVisita, Visita, VisitaInsert } from '../../types/database'
import { interpretarErrorSupabase } from '../errores'
import { claveDia, desdeClaveDia } from '../calendario'
import { esTelefonoConfiable } from '../telefono'

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
 *
 * `propiedad` es null en dos casos: la visita es externa —una propiedad que no
 * está cargada, con `titulo_externo` y quizás `link_externo`— o la RLS no deja
 * leer la propiedad.
 */
export interface VisitaConContexto extends Visita {
  propiedad: { id: string; direccion: string; zona: string | null } | null
  lead: { id: string; nombre: string; apellido: string | null } | null
}

// `titulo_externo` y `link_externo` ya vienen en el `*`.
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

  if (error) throw new Error(interpretarErrorSupabase(error, 'No se pudieron cargar las visitas.'))
  return (data ?? []) as unknown as VisitaConContexto[]
}

// ---------------------------------------------------------------------------
// Reconfirmación
//
// El día antes de una visita el agente le recuerda los datos al cliente. Abrir
// WhatsApp y marcar la visita como reconfirmada son dos acciones separadas:
// abrir wa.me no prueba que el mensaje se envió. Reconfirmar no deja ninguna
// interacción en el lead.
// ---------------------------------------------------------------------------

/** Visita pendiente de reconfirmar, con lo necesario para escribirle al cliente. */
export interface VisitaPorReconfirmar extends Visita {
  propiedad: { id: string; direccion: string; zona: string | null } | null
  lead: { id: string; nombre: string; apellido: string | null; telefono: string | null } | null
}

const SELECT_POR_RECONFIRMAR =
  '*, propiedad:propiedades(id, direccion, zona), lead:leads(id, nombre, apellido, telefono)'

/**
 * Visitas agendadas de hoy y mañana que el usuario creó o tiene asignadas y
 * todavía no reconfirmó.
 *
 * Consulta propia y no `listarVisitas`: esa comparte el select con el calendario
 * de Tareas y no tiene por qué cargar el teléfono de cada lead. Acá sí se filtra
 * por usuario, porque la RLS deja ver también las de los compañeros y el aviso
 * es de quien tiene que hacer la reconfirmación.
 */
export async function listarVisitasPorReconfirmar(
  hoy: string,
  manana: string,
  uid: string,
): Promise<VisitaPorReconfirmar[]> {
  const { data, error } = await supabase
    .from('visitas')
    .select(SELECT_POR_RECONFIRMAR)
    .gte('fecha', hoy)
    .lte('fecha', manana)
    .eq('estado', 'AGENDADA')
    .is('reconfirmada_at', null)
    .or(`creado_por.eq.${uid},asignado_a.eq.${uid}`)
    .order('fecha', { ascending: true })
    .order('hora', { ascending: true, nullsFirst: true })

  if (error) {
    throw new Error(interpretarErrorSupabase(error, 'No se pudieron cargar las visitas por reconfirmar.'))
  }
  return (data ?? []) as unknown as VisitaPorReconfirmar[]
}

/**
 * Marca (o desmarca) la visita como reconfirmada.
 *
 * Va por la RPC y no por un UPDATE: la policy de la tabla no deja que un
 * asignado actualice la fila. La función valida el permiso adentro y sólo
 * escribe `reconfirmada_at`.
 */
export async function reconfirmarVisita(id: string, reconfirmada = true): Promise<void> {
  const { error } = await supabase.rpc('reconfirmar_visita', {
    p_visita_id: id,
    p_reconfirmada: reconfirmada,
  })

  if (error) {
    throw new Error(interpretarErrorSupabase(error, 'No se pudo marcar la visita como reconfirmada.'))
  }
}

const DIAS_DE_LA_SEMANA = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
]

/** El día siguiente de una clave `YYYY-MM-DD`, con el cambio de mes y de año. */
export function diaSiguiente(clave: string): string {
  const [ano, mes, dia] = clave.split('-').map(Number)
  return claveDia(new Date(ano, mes - 1, dia + 1))
}

/** `lunes`, `martes`… de una clave `YYYY-MM-DD`. */
export function nombreDelDia(clave: string): string {
  return DIAS_DE_LA_SEMANA[desdeClaveDia(clave).getDay()]
}

export interface DatosMensajeReconfirmacion {
  /** Nombre de pila del cliente. */
  nombre: string
  /** `YYYY-MM-DD` de la visita. */
  fecha: string
  /** `HH:MM` o `HH:MM:SS`; null si la visita no tiene hora pactada. */
  hora: string | null
  /** `YYYY-MM-DD` de hoy: decide entre "hoy" y "mañana". */
  hoy: string
  direccion: string
  /** Publicación de una visita externa, si la tiene. */
  link?: string | null
}

/** El texto que queda escrito en el chat de WhatsApp, sin enviar. */
export function construirMensajeReconfirmacion({
  nombre,
  fecha,
  hora,
  hoy,
  direccion,
  link,
}: DatosMensajeReconfirmacion): string {
  const dia = desdeClaveDia(fecha)
  const diaMes = `${String(dia.getDate()).padStart(2, '0')}/${String(dia.getMonth() + 1).padStart(2, '0')}`
  const cuando = fecha === hoy ? 'hoy' : 'mañana'
  const aLas = hora ? `, a las ${hora.slice(0, 5)}` : ''

  const lineas = [
    `Hola ${nombre}! Te escribo para reconfirmar la visita de ${cuando}, ${nombreDelDia(fecha)} ${diaMes}${aLas}, en ${direccion}.`,
  ]
  if (link) lineas.push(`Publicación: ${link}`)
  lineas.push('¿Seguimos en pie?')
  return lineas.join('\n')
}

/** Qué se le puede ofrecer al agente para avisarle al cliente de una visita. */
export type ContactoVisita = 'SIN_CLIENTE' | 'SIN_TELEFONO' | 'CON_WHATSAPP'

/**
 * Sin cliente: sólo se puede marcar. Con cliente pero sin un teléfono del que
 * WhatsApp pueda armar un chat —vacío o no confiable— falta completarlo en la
 * ficha. Con teléfono confiable, WhatsApp.
 */
export function contactoDeVisita(lead: { telefono: string | null } | null): ContactoVisita {
  if (!lead) return 'SIN_CLIENTE'
  if (!lead.telefono || !esTelefonoConfiable(lead.telefono)) return 'SIN_TELEFONO'
  return 'CON_WHATSAPP'
}

// ---------------------------------------------------------------------------
// Alta
// ---------------------------------------------------------------------------

/** Lo que comparten la visita propia y la externa. */
interface CrearVisitaComun {
  lead_id?: string | null
  /** `YYYY-MM-DD`. */
  fecha: string
  /** `HH:MM`, o null si no hay hora pactada. */
  hora?: string | null
  notas?: string | null
  /** Si no viene, la visita queda a nombre de quien la crea. */
  asignado_a?: string | null
}

/** A una propiedad cargada en LeadEra. */
export interface CrearVisitaPropia extends CrearVisitaComun {
  propiedad_id: string
  /**
   * Operación a la que pertenece la visita, si se eligió una.
   *
   * Un trigger de la base rechaza vincularla a una operación de otra propiedad
   * o de otro lead.
   */
  operacion_id?: string | null
}

/**
 * A una propiedad que no está cargada: se identifica con texto libre y,
 * opcionalmente, el link de la publicación. No lleva operación: la base
 * rechaza una externa con `operacion_id`.
 */
export interface CrearVisitaExterna extends CrearVisitaComun {
  titulo_externo: string
  link_externo?: string | null
}

export type CrearVisitaInput = CrearVisitaPropia | CrearVisitaExterna

/** Topes de la base (`visitas_propia_o_externa`, `visitas_link_externo_valido`). */
export const MAX_TITULO_EXTERNO = 200
export const MAX_LINK_EXTERNO = 2000

export async function crearVisita(input: CrearVisitaInput): Promise<Visita> {
  const perfil = await miPerfil()

  const destino =
    'propiedad_id' in input
      ? {
          propiedad_id: input.propiedad_id,
          operacion_id: input.operacion_id || null,
        }
      : {
          propiedad_id: null,
          operacion_id: null,
          titulo_externo: input.titulo_externo.trim(),
          link_externo: input.link_externo?.trim() || null,
        }

  const fila: VisitaInsert = {
    inmobiliaria_id: perfil.inmobiliaria_id,
    creado_por: perfil.id,
    asignado_a: input.asignado_a || perfil.id,
    ...destino,
    lead_id: input.lead_id || null,
    fecha: input.fecha,
    hora: input.hora || null,
    estado: 'AGENDADA',
    notas: input.notas?.trim() || null,
  }

  const { data, error } = await supabase.from('visitas').insert(fila).select('*').single()

  if (error || !data) {
    throw new Error(interpretarErrorSupabase(error, 'No se pudo agendar la visita.'))
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

  if (error) throw new Error(interpretarErrorSupabase(error, 'No se pudo marcar la visita.'))
  const visita = verificarAfectadas(data, 'No tenés permiso para cambiar esta visita.')[0]

  if (!visita.lead_id) return visita

  try {
    await crearInteraccion({
      lead_id: visita.lead_id,
      operacion_id: visita.operacion_id,
      tipo: 'VISITA',
      // La base garantiza que una visita sin propiedad trae `titulo_externo`.
      detalle: visita.propiedad_id
        ? 'Visita a la propiedad realizada'
        : `Visita a ${visita.titulo_externo} realizada`,
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

  if (error) throw new Error(interpretarErrorSupabase(error, 'No se pudo cancelar la visita.'))
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

  if (error) throw new Error(interpretarErrorSupabase(error, 'No se pudo eliminar la visita.'))
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
    throw new Error(interpretarErrorSupabase(error, 'No se pudo cargar la actividad de la propiedad.'))
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
    throw new Error(interpretarErrorSupabase(error, 'No se pudieron contar las visitas del lead.'))
  }
  return aEntero(data)
}
