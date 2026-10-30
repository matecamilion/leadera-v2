import { supabase } from '../supabase'
import type { Database } from '../../types/database'
import { interpretarErrorSupabase } from '../errores'
import { hoyEnArgentina } from '../ritmoSemanal'
import type { PasoTramite } from '../tramite'
import { llevaEscritura } from './operaciones'

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
