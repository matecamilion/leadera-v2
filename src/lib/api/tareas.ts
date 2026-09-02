import { supabase } from '../supabase'
import { claveDia, desdeClaveDia } from '../calendario'
import type {
  EstadoTarea,
  Recurrencia,
  Tarea,
  TareaInsert,
} from '../../types/database'

/**
 * Tope de ocurrencias por serie.
 *
 * Sin esto, un "diaria hasta dentro de 5 años" generaría ~1800 filas de una.
 * Se corta ANTES de insertar nada, así no queda una serie a medio crear.
 */
export const MAX_OCURRENCIAS = 200

/** Perfil del usuario logueado: hace falta para el alta. */
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

// ---------------------------------------------------------------------------
// Lectura
// ---------------------------------------------------------------------------

/**
 * Tareas del usuario en un rango de días, tanto las que creó como las que le
 * asignaron.
 *
 * RLS ya acota lo que puede ver; el `.or()` de acá es sobre qué se pide, para
 * no traerse las de otros miembros del equipo que la policy sí permitiría.
 */
export async function listarTareas(desde: string, hasta: string): Promise<Tarea[]> {
  const { data: userData, error: errorUser } = await supabase.auth.getUser()
  if (errorUser || !userData.user) throw new Error('Tu sesión expiró. Volvé a entrar.')
  const miId = userData.user.id

  const { data, error } = await supabase
    .from('tareas')
    .select('*')
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .or(`creado_por.eq.${miId},asignado_a.eq.${miId}`)
    .order('fecha', { ascending: true })
    .order('hora', { ascending: true, nullsFirst: true })

  if (error) throw new Error(`No se pudieron cargar las tareas: ${error.message}`)
  return data ?? []
}

export interface SeguimientoLead {
  id: string
  nombre: string
  apellido: string | null
  fecha_proximo_seguimiento: string
}

/**
 * Seguimientos de leads que caen en el rango, para mezclarlos en el calendario.
 *
 * Es SÓLO lectura: el calendario nunca escribe ni duplica
 * `fecha_proximo_seguimiento`, que se sigue manejando desde el módulo de leads.
 *
 * No hay una función reutilizable para esto: `obtenerCandidatosDelDia` del dashboard
 * consulta el mismo campo pero con una ventana fija de hoy y devuelve la forma
 * de sus tres categorías. Acá hace falta un rango arbitrario, así que va su
 * propia query siguiendo el mismo patrón.
 *
 * La columna es `timestamptz` y las celdas del calendario son días locales, así
 * que el rango se arma desde la medianoche local del primer día hasta la
 * medianoche local del día siguiente al último.
 */
export async function listarSeguimientosComoEventos(
  desde: string,
  hasta: string,
): Promise<SeguimientoLead[]> {
  const { data: userData, error: errorUser } = await supabase.auth.getUser()
  if (errorUser || !userData.user) throw new Error('Tu sesión expiró. Volvé a entrar.')

  const inicio = desdeClaveDia(desde)
  const fin = desdeClaveDia(hasta)
  fin.setDate(fin.getDate() + 1)

  const { data, error } = await supabase
    .from('leads')
    .select('id, nombre, apellido, fecha_proximo_seguimiento')
    .eq('agente_id', userData.user.id)
    .not('fecha_proximo_seguimiento', 'is', null)
    .gte('fecha_proximo_seguimiento', inicio.toISOString())
    .lt('fecha_proximo_seguimiento', fin.toISOString())
    .order('fecha_proximo_seguimiento', { ascending: true })

  if (error) throw new Error(`No se pudieron cargar los seguimientos: ${error.message}`)
  return (data ?? []) as SeguimientoLead[]
}

// ---------------------------------------------------------------------------
// Alta
// ---------------------------------------------------------------------------

export interface CrearTareaInput {
  titulo: string
  descripcion?: string | null
  /** `YYYY-MM-DD`. */
  fecha: string
  /** `HH:MM`, o null para una tarea sin hora puntual. */
  hora?: string | null
  asignado_a: string
  lead_id?: string | null
  operacion_id?: string | null
  propiedad_id?: string | null
}

function aFilaTarea(
  input: CrearTareaInput,
  perfil: { id: string; inmobiliaria_id: string },
  fecha: string,
  serieId: string | null,
): TareaInsert {
  return {
    inmobiliaria_id: perfil.inmobiliaria_id,
    creado_por: perfil.id,
    asignado_a: input.asignado_a,
    titulo: input.titulo.trim(),
    descripcion: input.descripcion?.trim() || null,
    fecha,
    hora: input.hora || null,
    estado: 'PENDIENTE',
    serie_id: serieId,
    lead_id: input.lead_id ?? null,
    operacion_id: input.operacion_id ?? null,
    propiedad_id: input.propiedad_id ?? null,
  }
}

/** Una tarea suelta, sin serie. */
export async function crearTarea(input: CrearTareaInput): Promise<Tarea> {
  const perfil = await miPerfil()

  const { data, error } = await supabase
    .from('tareas')
    .insert(aFilaTarea(input, perfil, input.fecha, null))
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(`No se pudo crear la tarea: ${error?.message ?? 'sin detalle'}`)
  }
  return data
}

/**
 * Fechas de una serie, desde `desde` hasta `hasta` inclusive.
 *
 * MENSUAL avanza de mes en mes conservando el día. Si el mes destino no tiene
 * ese día —un 31 en febrero— JS desborda al mes siguiente, así que esa
 * ocurrencia se saltea en vez de aparecer en una fecha que nadie pidió.
 */
export function generarFechas(
  desde: string,
  hasta: string,
  recurrencia: Recurrencia,
): string[] {
  const inicio = desdeClaveDia(desde)
  const fin = desdeClaveDia(hasta)
  if (fin < inicio) return []

  const fechas: string[] = []
  const diaDelMes = inicio.getDate()

  if (recurrencia === 'MENSUAL') {
    for (let i = 0; ; i++) {
      const f = new Date(inicio.getFullYear(), inicio.getMonth() + i, diaDelMes)
      if (f > fin) break
      // El desbordamiento cambia el mes: ese día no existe en ese mes.
      if (f.getDate() === diaDelMes) fechas.push(claveDia(f))
      if (fechas.length > MAX_OCURRENCIAS) break
    }
    return fechas
  }

  const paso = recurrencia === 'DIARIA' ? 1 : 7
  for (const f = new Date(inicio); f <= fin; f.setDate(f.getDate() + paso)) {
    fechas.push(claveDia(f))
    if (fechas.length > MAX_OCURRENCIAS) break
  }
  return fechas
}

export interface ResultadoSerie {
  serieId: string
  ocurrencias: number
}

/**
 * Una tarea repetida: crea la serie y todas sus ocurrencias en un solo insert.
 *
 * Si el rango supera el tope se corta antes de escribir nada, para no dejar
 * una fila en `tareas_series` sin sus tareas.
 */
export async function crearTareaRecurrente(
  input: CrearTareaInput,
  recurrencia: Recurrencia,
  hasta: string,
): Promise<ResultadoSerie> {
  const fechas = generarFechas(input.fecha, hasta, recurrencia)

  if (fechas.length === 0) {
    throw new Error('La fecha de fin tiene que ser posterior a la de la primera tarea.')
  }
  if (fechas.length > MAX_OCURRENCIAS) {
    throw new Error(
      `Esa combinación genera más de ${MAX_OCURRENCIAS} tareas. Acortá la fecha de fin o espaciá la repetición.`,
    )
  }

  const perfil = await miPerfil()

  const { data: serie, error: errorSerie } = await supabase
    .from('tareas_series')
    .insert({ inmobiliaria_id: perfil.inmobiliaria_id, recurrencia, hasta })
    .select('id')
    .single()

  if (errorSerie || !serie) {
    throw new Error(`No se pudo crear la serie: ${errorSerie?.message ?? 'sin detalle'}`)
  }

  const { error } = await supabase
    .from('tareas')
    .insert(fechas.map((fecha) => aFilaTarea(input, perfil, fecha, serie.id)))

  if (error) {
    // La serie quedaría huérfana; se limpia para no dejar basura.
    await supabase.from('tareas_series').delete().eq('id', serie.id)
    throw new Error(`No se pudieron crear las tareas: ${error.message}`)
  }

  return { serieId: serie.id, ocurrencias: fechas.length }
}

// ---------------------------------------------------------------------------
// Cambios de estado y borrado
// ---------------------------------------------------------------------------

/**
 * Un UPDATE o DELETE que RLS bloquea vuelve 200 con lista vacía, no error: hay
 * que mirar cuántas filas volvieron para saber si pasó algo.
 */
function verificarAfectadas(filas: unknown[] | null, mensaje: string): void {
  if (!filas || filas.length === 0) throw new Error(mensaje)
}

export async function completarTarea(id: string): Promise<void> {
  const cambio: { estado: EstadoTarea; completada_en: string } = {
    estado: 'COMPLETADA',
    completada_en: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('tareas')
    .update(cambio)
    .eq('id', id)
    .select('id')

  if (error) throw new Error(`No se pudo completar la tarea: ${error.message}`)
  verificarAfectadas(data, 'No tenés permiso para completar esta tarea.')
}

export async function descompletarTarea(id: string): Promise<void> {
  const cambio: { estado: EstadoTarea; completada_en: null } = {
    estado: 'PENDIENTE',
    completada_en: null,
  }

  const { data, error } = await supabase
    .from('tareas')
    .update(cambio)
    .eq('id', id)
    .select('id')

  if (error) throw new Error(`No se pudo reabrir la tarea: ${error.message}`)
  verificarAfectadas(data, 'No tenés permiso para reabrir esta tarea.')
}

export async function eliminarTarea(id: string): Promise<void> {
  const { data, error } = await supabase.from('tareas').delete().eq('id', id).select('id')

  if (error) throw new Error(`No se pudo eliminar la tarea: ${error.message}`)
  verificarAfectadas(data, 'No tenés permiso para eliminar esta tarea.')
}

/**
 * Borra lo que queda de una serie de hoy en adelante.
 *
 * Las ocurrencias pasadas quedan intactas a propósito: son historial de lo que
 * efectivamente hubo que hacer, y borrarlas falsearía el registro.
 */
export async function eliminarSerie(serieId: string): Promise<number> {
  const hoy = claveDia(new Date())

  const { data, error } = await supabase
    .from('tareas')
    .delete()
    .eq('serie_id', serieId)
    .gte('fecha', hoy)
    .select('id')

  if (error) throw new Error(`No se pudo eliminar la serie: ${error.message}`)
  verificarAfectadas(data, 'No tenés permiso para eliminar esta serie.')
  return data!.length
}
