import { supabase } from '../supabase'
import type { Database } from '../../types/database'
import { interpretarErrorSupabase } from '../errores'
import { hoyEnArgentina } from '../ritmoSemanal'
import type { PasoTramite } from '../tramite'
import { tareasDePostventa } from '../postventa'
import { llevaEscritura, nombreCompleto } from './operaciones'

export type TramitePaso = Database['public']['Tables']['operacion_tramite_pasos']['Row']
type TramitePasoInsert = Database['public']['Tables']['operacion_tramite_pasos']['Insert']

/** Lo que cambia en una fila del trámite. El resto de la fila no se manda. */
export type CambiosPaso = Partial<
  Pick<
    TramitePasoInsert,
    'fecha_completado' | 'no_aplica' | 'completado_por' | 'fecha_prevista'
  >
>

/** El mismo texto que `actualizarEstadoOperacion` cuando la RLS tapa la fila. */
export const MENSAJE_SIN_PERMISO_TRAMITE = 'No tenés permiso para editar esta operación.'

export const MENSAJE_POSTVENTA_SIN_PERMISO =
  'La escritura quedó marcada, pero no tenés permiso para agendar las tareas de postventa.'

export const MENSAJE_POSTVENTA_FALLIDA =
  'La escritura quedó marcada, pero no se pudieron agendar las tareas de postventa. Desmarcá la escritura y volvé a marcarla para reintentar.'

export const MENSAJE_POSTVENTA_SIN_REGISTRAR =
  'Se agendaron las tareas de postventa, pero no se pudo dejar registrado. No vuelvas a marcar la escritura: se duplicarían.'

export const MENSAJE_TRAMITE_NO_APLICA =
  'El trámite de escritura solo aplica a las operaciones de compra y venta.'

// ---------------------------------------------------------------------------
// Armado de lo que se escribe (puro)
//
// Cada acción toca solo sus columnas: el upsert mezcla lo mandado con la fila
// existente, así que `fecha_prevista` y `postventa_generada_at` sobreviven a
// marcar o desmarcar la escritura.
// ---------------------------------------------------------------------------

/** Completa el paso en esa fecha. Si estaba en "no aplica", deja de estarlo. */
export function cambiosDeMarcar(fecha: string, usuarioId: string): CambiosPaso {
  return { fecha_completado: fecha, no_aplica: false, completado_por: usuarioId }
}

/** El paso no corresponde a esta operación: resuelto, sin fecha. */
export function cambiosDeNoAplica(usuarioId: string): CambiosPaso {
  return { fecha_completado: null, no_aplica: true, completado_por: usuarioId }
}

/**
 * Vuelve el paso a pendiente. La fila no se borra: la tabla no tiene policy de
 * DELETE, y conservarla guarda la fecha prevista y la marca de postventa.
 */
export function cambiosDeDesmarcar(): CambiosPaso {
  return { fecha_completado: null, no_aplica: false, completado_por: null }
}

export function cambiosDeFechaPrevista(fecha: string | null): CambiosPaso {
  return { fecha_prevista: fecha }
}

/**
 * Traduce un error de Supabase. Que la RLS rechace es lo mismo que en el resto
 * de la ficha de operación y lleva el mismo mensaje; el resto va por
 * `interpretarErrorSupabase`.
 */
export function mensajeDeErrorTramite(error: unknown): string {
  const codigo = (error as { code?: string } | null)?.code
  const texto = (error as { message?: string } | null)?.message ?? ''
  if (codigo === '42501' || /row-level security/i.test(texto)) {
    return MENSAJE_SIN_PERMISO_TRAMITE
  }
  return interpretarErrorSupabase(error, 'No se pudo guardar el paso del trámite.')
}

/** Como `mensajeDeErrorTramite`, pero para el alta de las tareas de postventa. */
export function mensajeDeErrorPostventa(error: unknown): string {
  const codigo = (error as { code?: string } | null)?.code
  const texto = (error as { message?: string } | null)?.message ?? ''
  return codigo === '42501' || /row-level security/i.test(texto)
    ? MENSAJE_POSTVENTA_SIN_PERMISO
    : MENSAJE_POSTVENTA_FALLIDA
}

// ---------------------------------------------------------------------------
// Lectura y escritura
// ---------------------------------------------------------------------------

/**
 * Las filas que existen. Un paso sin fila es un paso pendiente: los helpers de
 * `src/lib/tramite.ts` ya lo asumen.
 */
export async function obtenerPasosTramite(operacionId: string): Promise<TramitePaso[]> {
  const { data, error } = await supabase
    .from('operacion_tramite_pasos')
    .select('*')
    .eq('operacion_id', operacionId)

  if (error) {
    throw new Error(interpretarErrorSupabase(error, 'No se pudo cargar el trámite.'))
  }
  return data ?? []
}

async function usuarioActual(): Promise<string> {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) throw new Error('Tu sesión expiró. Volvé a entrar.')
  return data.user.id
}

/**
 * Upsert por (operacion_id, paso).
 *
 * `inmobiliaria_id` sale de la operación y no del perfil: es contra lo que la
 * policy compara la fila. El estado de la operación no cuenta: el trámite sigue
 * después del cierre.
 *
 * Con la RLS en contra el upsert puede fallar con 42501 o devolver cero filas;
 * los dos caminos terminan en el mismo mensaje.
 */
async function guardarPaso(
  operacionId: string,
  paso: PasoTramite,
  cambios: CambiosPaso,
): Promise<TramitePaso> {
  const { data: operacion, error: errorOperacion } = await supabase
    .from('operaciones')
    .select('inmobiliaria_id, tipo')
    .eq('id', operacionId)
    .maybeSingle()

  if (errorOperacion) throw new Error(mensajeDeErrorTramite(errorOperacion))
  if (!operacion) throw new Error('No encontramos esta operación.')
  if (!llevaEscritura(operacion.tipo)) throw new Error(MENSAJE_TRAMITE_NO_APLICA)

  const { data, error } = await supabase
    .from('operacion_tramite_pasos')
    .upsert(
      { inmobiliaria_id: operacion.inmobiliaria_id, operacion_id: operacionId, paso, ...cambios },
      { onConflict: 'operacion_id,paso' },
    )
    .select('*')
    .maybeSingle()

  if (error) throw new Error(mensajeDeErrorTramite(error))
  if (!data) throw new Error(MENSAJE_SIN_PERMISO_TRAMITE)
  return data
}

/** Completa un paso. La fecha la manda el cliente: por defecto hoy en Buenos Aires. */
export async function marcarPaso(
  operacionId: string,
  paso: PasoTramite,
  fecha: string = hoyEnArgentina(),
): Promise<TramitePaso> {
  return guardarPaso(operacionId, paso, cambiosDeMarcar(fecha, await usuarioActual()))
}

export async function marcarNoAplica(
  operacionId: string,
  paso: PasoTramite,
): Promise<TramitePaso> {
  return guardarPaso(operacionId, paso, cambiosDeNoAplica(await usuarioActual()))
}

export async function desmarcarPaso(
  operacionId: string,
  paso: PasoTramite,
): Promise<TramitePaso> {
  return guardarPaso(operacionId, paso, cambiosDeDesmarcar())
}

/** Cuándo se espera firmar. `null` la borra. Solo existe para la escritura. */
export async function fijarFechaPrevistaEscritura(
  operacionId: string,
  fecha: string | null,
): Promise<TramitePaso> {
  return guardarPaso(operacionId, 'ESCRITURA', cambiosDeFechaPrevista(fecha))
}

// ---------------------------------------------------------------------------
// Postventa
// ---------------------------------------------------------------------------

/**
 * Agenda las tareas de postventa de una escritura recién marcada.
 *
 * Devuelve cuántas se agendaron, o `null` si no correspondía intentarlo: el paso
 * no es la escritura, no tiene fecha, o ya se generaron (`postventa_generada_at`).
 * Así marcar, desmarcar y volver a marcar no duplica, y cambiar la fecha de una
 * escritura ya marcada no mueve nada.
 *
 * Las tareas van en un solo insert, así que entran todas o ninguna. La marca
 * `postventa_generada_at` se escribe DESPUÉS y solo si el insert salió bien: si
 * las tareas fallan queda en null y se puede reintentar sin duplicar. Si no
 * queda ninguna tarea por fechas pasadas, igual se marca.
 *
 * Las tareas se asignan al agente de la operación. No se empujan a Google
 * Calendar: ese sync lo dispara el cliente tarea por tarea, y las series
 * tampoco lo hacen.
 */
export async function generarPostventaSiCorresponde(fila: TramitePaso): Promise<number | null> {
  if (fila.paso !== 'ESCRITURA' || !fila.fecha_completado || fila.postventa_generada_at) {
    return null
  }

  const { data: operacion, error: errorOperacion } = await supabase
    .from('operaciones')
    .select('inmobiliaria_id, agente_id, tipo, lead_id, propiedad_id, lead:leads(nombre, apellido)')
    .eq('id', fila.operacion_id)
    .maybeSingle()

  if (errorOperacion) throw new Error(mensajeDeErrorPostventa(errorOperacion))
  if (!operacion) throw new Error(MENSAJE_POSTVENTA_FALLIDA)

  const usuarioId = await usuarioActual()
  const tareas = tareasDePostventa({
    fechaEscritura: fila.fecha_completado,
    hoy: hoyEnArgentina(),
    tipo: operacion.tipo,
    cliente: nombreCompleto(operacion.lead),
  })

  if (tareas.length > 0) {
    const { error } = await supabase.from('tareas').insert(
      tareas.map((tarea) => ({
        inmobiliaria_id: operacion.inmobiliaria_id,
        creado_por: usuarioId,
        asignado_a: operacion.agente_id,
        titulo: tarea.titulo,
        fecha: tarea.fecha,
        hora: null,
        estado: 'PENDIENTE' as const,
        serie_id: null,
        operacion_id: fila.operacion_id,
        lead_id: operacion.lead_id,
        propiedad_id: operacion.propiedad_id,
      })),
    )
    if (error) throw new Error(mensajeDeErrorPostventa(error))
  }

  const { data, error } = await supabase
    .from('operacion_tramite_pasos')
    .update({ postventa_generada_at: new Date().toISOString() })
    .eq('id', fila.id)
    .select('id')

  if (error || !data?.length) throw new Error(MENSAJE_POSTVENTA_SIN_REGISTRAR)
  return tareas.length
}
