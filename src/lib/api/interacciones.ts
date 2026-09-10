import { supabase } from '../supabase'
import type { Database } from '../../types/database'
import { interpretarErrorSupabase } from '../errores'

export type Interaccion = Database['public']['Tables']['interacciones']['Row']
export type TipoInteraccion = Database['public']['Enums']['tipo_interaccion']

/** Opciones del selector, en el orden del formulario. */
export const TIPOS_INTERACCION: { valor: TipoInteraccion; label: string }[] = [
  { valor: 'LLAMADA', label: 'Llamada' },
  { valor: 'WHATSAPP', label: 'WhatsApp' },
  { valor: 'EMAIL', label: 'Email' },
  { valor: 'VISITA', label: 'Visita' },
  { valor: 'REUNION', label: 'Reunión' },
  { valor: 'NOTA_INTERNA', label: 'Nota interna' },
]

const ETIQUETAS: Record<TipoInteraccion, string> = {
  LLAMADA: 'Llamada',
  WHATSAPP: 'WhatsApp',
  EMAIL: 'Email',
  VISITA: 'Visita',
  REUNION: 'Reunión',
  NOTA_INTERNA: 'Nota interna',
  SEGUIMIENTO: 'Seguimiento',
  CONSULTA: 'Consulta',
}

export function etiquetaTipoInteraccion(tipo: TipoInteraccion): string {
  return ETIQUETAS[tipo] ?? tipo
}

/**
 * CONSULTA sigue siendo un valor válido del enum aunque hoy ningún formulario
 * lo genere: el timeline de la operación tenía uno y se sacó cuando esa carga
 * pasó a ser automática. Las filas viejas con ese tipo se siguen mostrando, y
 * el día que vuelva a hacer falta el valor ya está. No es un olvido.
 */

/** Lo cargado contra una operación puntual, de lo más reciente a lo más viejo. */
export async function listarInteraccionesPorOperacion(
  operacionId: string,
): Promise<Interaccion[]> {
  const { data, error } = await supabase
    .from('interacciones')
    .select('*')
    .eq('operacion_id', operacionId)
    .order('fecha', { ascending: false })

  if (error) {
    throw new Error(interpretarErrorSupabase(error, 'No se pudieron cargar los eventos de la operación.'))
  }
  return data ?? []
}

/** Historial completo de un lead, de la más reciente a la más vieja. */
export async function listarInteraccionesPorLead(
  leadId: string,
): Promise<Interaccion[]> {
  const { data, error } = await supabase
    .from('interacciones')
    .select('*')
    .eq('lead_id', leadId)
    .order('fecha', { ascending: false })

  if (error) {
    throw new Error(interpretarErrorSupabase(error, 'No se pudieron cargar las interacciones.'))
  }
  return data ?? []
}

export interface CrearInteraccionInput {
  lead_id: string
  tipo: TipoInteraccion
  detalle: string
  /**
   * Operación a la que pertenece, si se cargó desde su timeline.
   *
   * Un trigger de la base rechaza vincularla a una operación de otro lead.
   */
  operacion_id?: string | null
  /** Valor de un <input type="datetime-local">, en hora local. Opcional. */
  fecha_proximo_contacto?: string
  /** Por defecto, ahora. */
  fecha?: string
}

/**
 * Registra una interacción.
 *
 * Las fechas de contacto del lead (`fecha_primer_contacto_real` y
 * `fecha_ultimo_contacto_real`) las escribe un trigger de la base al insertar:
 * no las tocamos desde acá. Lo único que queda del lado del frontend es
 * `fecha_proximo_seguimiento`, que el trigger no maneja.
 */
export async function crearInteraccion(
  input: CrearInteraccionInput,
): Promise<Interaccion> {
  const { data: userData, error: errorUser } = await supabase.auth.getUser()
  if (errorUser || !userData.user) throw new Error('Tu sesión expiró. Volvé a entrar.')

  const { data: interaccion, error } = await supabase
    .from('interacciones')
    .insert({
      lead_id: input.lead_id,
      agente_id: userData.user.id,
      tipo: input.tipo,
      detalle: input.detalle.trim(),
      operacion_id: input.operacion_id ?? null,
      // Si no viene, la base pone now() por default.
      ...(input.fecha ? { fecha: input.fecha } : {}),
    })
    .select('*')
    .single()

  if (error) {
    throw new Error(interpretarErrorSupabase(error, 'No se pudo registrar la interacción.'))
  }

  const proximo = aIso(input.fecha_proximo_contacto)
  if (proximo) {
    const { error: errorLead } = await supabase
      .from('leads')
      .update({ fecha_proximo_seguimiento: proximo })
      .eq('id', input.lead_id)

    if (errorLead) {
      // La interacción ya quedó guardada: hay que decirlo, o el usuario
      // reintenta y la duplica.
      throw new Error(
        'La interacción se guardó, pero no se pudo agendar el próximo seguimiento.',
      )
    }
  }

  return interaccion
}

/** El input datetime-local viene sin zona; Date lo interpreta como hora local. */
function aIso(valor: string | undefined): string | null {
  if (!valor) return null
  const fecha = new Date(valor)
  return Number.isNaN(fecha.getTime()) ? null : fecha.toISOString()
}

// ---------------------------------------------------------------------------
// Edición y borrado
//
// La base es la que manda: la policy `interacciones_update` /
// `interacciones_delete` sólo deja tocar la fila dentro de las 24hs desde
// `created_at`, y siendo el agente dueño, el dueño de la inmobiliaria o su
// supervisor. Encima, el trigger `interacciones_proteger_estructura` congela
// `lead_id`, `agente_id`, `operacion_id` y `created_at` incluso dentro de esa
// ventana.
//
// Acá NO se reimplementa esa lógica: `dentroDeVentanaDeEdicion` existe sólo
// para que la UI no ofrezca un botón que va a rebotar, y estas dos funciones
// se limitan a traducir el rechazo a una frase legible.
// ---------------------------------------------------------------------------

/** Horas desde el alta durante las que la interacción sigue siendo editable. */
export const HORAS_DE_EDICION = 24

const MS_DE_EDICION = HORAS_DE_EDICION * 60 * 60 * 1000

/**
 * ¿La fila sigue dentro de la ventana de edición?
 *
 * Compara contra el reloj del cliente, que puede estar corrido: es una ayuda
 * de UX, no un control. Si se equivoca por unos minutos, el error lo pone la
 * base y el usuario ve el mensaje de abajo.
 */
export function dentroDeVentanaDeEdicion(createdAt: string): boolean {
  const alta = new Date(createdAt)
  if (Number.isNaN(alta.getTime())) return false
  return Date.now() - alta.getTime() < MS_DE_EDICION
}

export const MENSAJE_EDITAR_RECHAZADO =
  'Esta interacción ya no se puede editar (pasaron más de 24hs desde que se cargó).'

export const MENSAJE_ELIMINAR_RECHAZADO =
  'Esta interacción ya no se puede eliminar (pasaron más de 24hs desde que se cargó), o es de otro agente.'

/**
 * Rechazo del trigger que protege la estructura de la fila.
 *
 * No debería verse desde la UI —el update manda sólo los tres campos que el
 * trigger permite— pero si alguna vez se agrega un campo de más, esto evita
 * que salga el volcado crudo de PL/pgSQL. `P0001` es lo que llega de un
 * `raise exception` sin SQLSTATE propio; el texto se mira además por si el
 * trigger cambiara de código.
 */
function esRechazoDelTrigger(error: { code?: string; message?: string }): boolean {
  if (error.code === 'P0001') return true
  return /lead_id|agente_id|operacion_id|created_at/i.test(error.message ?? '')
}

const MENSAJE_ESTRUCTURA =
  'De una interacción sólo se pueden cambiar el tipo, el detalle y la fecha.'

/**
 * Rechazo explícito de RLS.
 *
 * El camino normal de una policy que no deja pasar la fila es el silencioso —
 * cero filas, sin error—, pero una con `WITH CHECK` devuelve `42501` con el
 * texto crudo de Postgres. Se traduce acá para que no llegue a la pantalla.
 */
function esRechazoDeRls(error: { code?: string; message?: string }): boolean {
  if (error.code === '42501') return true
  return /row-level security/i.test(error.message ?? '')
}

/** Lo único editable: lo que dejan pasar la policy y el trigger de la base. */
export type CamposEditablesInteraccion = Partial<{
  tipo: TipoInteraccion
  detalle: string
  /** ISO. La columna es timestamptz. */
  fecha: string
}>

/**
 * Edita una interacción.
 *
 * Manda sólo `tipo`, `detalle` y `fecha`, y sólo los que vengan definidos: un
 * objeto vacío no toca nada. El resto de las columnas ni se arma, así el
 * trigger de estructura no tiene de qué quejarse.
 */
export async function actualizarInteraccion(
  id: string,
  campos: CamposEditablesInteraccion,
): Promise<Interaccion> {
  const cambios: CamposEditablesInteraccion = {}
  if (campos.tipo !== undefined) cambios.tipo = campos.tipo
  if (campos.detalle !== undefined) cambios.detalle = campos.detalle.trim()
  if (campos.fecha !== undefined) cambios.fecha = campos.fecha

  const { data, error } = await supabase
    .from('interacciones')
    .update(cambios)
    .eq('id', id)
    .select('*')
    .maybeSingle()

  if (error) {
    if (esRechazoDeRls(error)) throw new Error(MENSAJE_EDITAR_RECHAZADO)
    if (esRechazoDelTrigger(error)) throw new Error(MENSAJE_ESTRUCTURA)
    throw new Error(interpretarErrorSupabase(error, 'No se pudo guardar la interacción.'))
  }

  // Sin error y sin fila: la policy filtró el UPDATE. PostgREST no lo trata
  // como error —responde 200 con la lista vacía—, así que sin este chequeo un
  // guardado rechazado se vería como exitoso. Mismo patrón que
  // `actualizarOperacion`.
  if (!data) throw new Error(MENSAJE_EDITAR_RECHAZADO)
  return data
}

/**
 * Borra una interacción.
 *
 * Ídem: se pide de vuelta la fila borrada para distinguir "se borró" de "la
 * policy no dejó".
 */
export async function eliminarInteraccion(id: string): Promise<void> {
  const { data, error } = await supabase
    .from('interacciones')
    .delete()
    .eq('id', id)
    .select('id')

  if (error) {
    if (esRechazoDeRls(error) || esRechazoDelTrigger(error)) {
      throw new Error(MENSAJE_ELIMINAR_RECHAZADO)
    }
    throw new Error(interpretarErrorSupabase(error, 'No se pudo eliminar la interacción.'))
  }

  if (!data || data.length === 0) throw new Error(MENSAJE_ELIMINAR_RECHAZADO)
}
