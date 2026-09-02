import { supabase } from '../supabase'
import type { Database } from '../../types/database'
import type { TipoPropiedad } from './propiedades'

export type Busqueda = Database['public']['Tables']['busquedas']['Row']

/**
 * Los criterios que carga el agente. Todos opcionales.
 *
 * Es un subconjunto de la fila: quedan afuera `id`, `lead_id`,
 * `inmobiliaria_id`, `agente_id` y `activa`, que salen del contexto y no del
 * formulario.
 */
export interface CriteriosBusqueda {
  tipo_propiedad: TipoPropiedad | null
  zona: string | null
  precio_min: number | null
  precio_max: number | null
  ambientes_min: number | null
  m2_min: number | null
  banos_min: number | null
  cocheras_min: number | null
  expensas_max: number | null
  notas: string | null
}

export const CRITERIOS_VACIOS: CriteriosBusqueda = {
  tipo_propiedad: null,
  zona: null,
  precio_min: null,
  precio_max: null,
  ambientes_min: null,
  m2_min: null,
  banos_min: null,
  cocheras_min: null,
  expensas_max: null,
  notas: null,
}

/**
 * Criterios que el RPC realmente puntúa.
 *
 * `tipo_propiedad` y `notas` NO están: el primero filtra el universo de
 * propiedades (entra en el WHERE, no en el score) y el segundo es texto para
 * humanos. Una búsqueda que sólo tenga esos dos devuelve cero coincidencias,
 * porque el RPC descarta las filas con `criterios_evaluados = 0`.
 */
const CRITERIOS_PUNTUABLES = [
  'zona',
  'precio_min',
  'precio_max',
  'ambientes_min',
  'm2_min',
  'banos_min',
  'cocheras_min',
  'expensas_max',
] as const satisfies readonly (keyof CriteriosBusqueda)[]

/** ¿Hay algo cargado? Habilita el guardado. */
export function hayAlgunCriterio(criterios: CriteriosBusqueda): boolean {
  return Object.values(criterios).some((valor) =>
    typeof valor === 'string' ? valor.trim() !== '' : valor != null,
  )
}

/**
 * ¿Hay al menos un criterio que puntúe?
 *
 * Se guarda igual sin esto —el agente puede querer dejar anotado "busca algo
 * en zona norte" y completar después—, pero la sección de coincidencias avisa
 * que así no va a encontrar nada.
 */
export function hayCriterioPuntuable(criterios: CriteriosBusqueda): boolean {
  return CRITERIOS_PUNTUABLES.some((clave) => {
    const valor = criterios[clave]
    return typeof valor === 'string' ? valor.trim() !== '' : valor != null
  })
}

/** Los criterios de una búsqueda ya guardada, para precargar el formulario. */
export async function obtenerCriterios(
  busquedaId: string,
): Promise<CriteriosBusqueda | null> {
  const { data, error } = await supabase
    .from('busquedas')
    .select(
      'tipo_propiedad, zona, precio_min, precio_max, ambientes_min, m2_min, banos_min, cocheras_min, expensas_max, notas',
    )
    .eq('id', busquedaId)
    .maybeSingle()

  if (error) throw new Error(`No se pudo cargar la búsqueda: ${error.message}`)
  return data
}

/**
 * Guarda los criterios de una operación de COMPRA.
 *
 * Dos caminos según la operación ya tenga búsqueda o no. El `busqueda_id` se
 * lee acá en vez de recibirlo por parámetro para que el llamador no pueda
 * mandar uno viejo y terminar pisando la búsqueda de otra operación.
 *
 * No es atómico: crear la fila y colgarla de la operación son dos viajes. Si
 * el segundo falla queda una búsqueda huérfana —invisible, porque nada la
 * referencia— y el error se propaga para que el usuario reintente. Cerrarlo
 * bien pide una función en la base; con un agente cargando a la vez, alcanza.
 *
 * Devuelve el id de la búsqueda, que el alta necesita para saber que la
 * operación quedó vinculada.
 */
export async function guardarBusqueda(
  operacionId: string,
  leadId: string,
  criterios: CriteriosBusqueda,
): Promise<string> {
  const { data: userData, error: errorUser } = await supabase.auth.getUser()
  if (errorUser || !userData.user) throw new Error('Tu sesión expiró. Volvé a entrar.')

  const { data: perfil, error: errorPerfil } = await supabase
    .from('profiles')
    .select('id, inmobiliaria_id')
    .eq('id', userData.user.id)
    .single()

  if (errorPerfil || !perfil) throw new Error('No encontramos tu perfil de agente.')

  const { data: operacion, error: errorOperacion } = await supabase
    .from('operaciones')
    .select('busqueda_id')
    .eq('id', operacionId)
    .maybeSingle()

  if (errorOperacion) {
    throw new Error(`No se pudo leer la operación: ${errorOperacion.message}`)
  }
  if (!operacion) throw new Error('No tenés permiso para editar esta operación.')

  // --- La operación ya tiene búsqueda: se actualiza esa fila ---
  if (operacion.busqueda_id) {
    const { data, error } = await supabase
      .from('busquedas')
      .update(criterios)
      .eq('id', operacion.busqueda_id)
      .select('id')
      .maybeSingle()

    if (error) throw new Error(`No se pudo guardar la búsqueda: ${error.message}`)
    if (!data) throw new Error('No tenés permiso para editar esta búsqueda.')
    return data.id
  }

  // --- Todavía no tiene: se crea y se cuelga de la operación ---
  const { data: creada, error: errorAlta } = await supabase
    .from('busquedas')
    .insert({
      ...criterios,
      lead_id: leadId,
      inmobiliaria_id: perfil.inmobiliaria_id,
      agente_id: perfil.id,
      // `activa` la pone la base en true por default.
    })
    .select('id')
    .single()

  if (errorAlta || !creada) {
    throw new Error(
      `No se pudo crear la búsqueda: ${errorAlta?.message ?? 'sin detalle'}`,
    )
  }

  const { data: vinculada, error: errorVinculo } = await supabase
    .from('operaciones')
    .update({ busqueda_id: creada.id })
    .eq('id', operacionId)
    .select('id')
    .maybeSingle()

  if (errorVinculo) {
    throw new Error(
      `La búsqueda se creó, pero no se pudo vincular a la operación: ${errorVinculo.message}`,
    )
  }
  if (!vinculada) {
    throw new Error('La búsqueda se creó, pero no tenés permiso para editar la operación.')
  }

  return creada.id
}

// ---------------------------------------------------------------------------
// Coincidencias
// ---------------------------------------------------------------------------

/** Lo que devuelve el RPC, antes de resolver los datos de la propiedad. */
type FilaCoincidencia =
  Database['public']['Functions']['buscar_coincidencias_busqueda']['Returns'][number]

export interface PropiedadCoincidente {
  id: string
  direccion: string
  zona: string | null
  tipo: TipoPropiedad
  precio: number | null
  moneda: string
  ambientes: number | null
  metros_cuadrados: number | null
  fotos_urls: string[]
  /** 0–100. Porcentaje de criterios puntuables que cumple. */
  scorePct: number
  criteriosEvaluados: number
  criteriosCumplidos: number
}

/**
 * Cuántas coincidencias se muestran como máximo.
 *
 * El RPC no aplica un piso de score: devuelve TODAS las propiedades
 * disponibles que pudo puntuar, incluidas las de 0%. Cortar por arriba sirve
 * para dos cosas. Una de producto: una lista con cincuenta propiedades al 0%
 * no es un resultado, es ruido. Y otra técnica: los ids del corte van en un
 * `.in()`, que viaja en la query string, y unos cientos de UUIDs alcanzan para
 * pasarse del largo máximo de URL y que el request falle entero.
 *
 * Como el RPC ordena por score descendente, el corte se queda con las mejores.
 */
export const MAXIMO_COINCIDENCIAS = 30

/**
 * Propiedades que matchean una búsqueda, con su score.
 *
 * Son dos viajes por diseño: el RPC es `SECURITY DEFINER` y devuelve sólo ids
 * y puntajes —nunca filas de `propiedades`—, así que los datos para pintar las
 * cards se piden aparte, con la RLS del usuario puesta. Si alguna propiedad se
 * cayera entre las dos consultas, simplemente no aparece.
 *
 * El orden por score lo pone el RPC; se reconstruye después del segundo SELECT
 * porque PostgREST devuelve las filas del `.in()` en el orden que quiere.
 */
export async function obtenerCoincidencias(
  busquedaId: string,
): Promise<PropiedadCoincidente[]> {
  const { data: filas, error } = await supabase.rpc('buscar_coincidencias_busqueda', {
    p_busqueda_id: busquedaId,
  })

  if (error) throw new Error(`No se pudieron buscar coincidencias: ${error.message}`)

  const puntajes = ((filas ?? []) as FilaCoincidencia[]).slice(0, MAXIMO_COINCIDENCIAS)
  if (puntajes.length === 0) return []

  const { data: propiedades, error: errorPropiedades } = await supabase
    .from('propiedades')
    .select(
      'id, direccion, zona, tipo, precio, moneda, ambientes, metros_cuadrados, fotos_urls',
    )
    .in(
      'id',
      puntajes.map((p) => p.propiedad_id),
    )

  if (errorPropiedades) {
    throw new Error(`No se pudieron cargar las propiedades: ${errorPropiedades.message}`)
  }

  const porId = new Map((propiedades ?? []).map((p) => [p.id, p]))

  return puntajes.flatMap((puntaje) => {
    const propiedad = porId.get(puntaje.propiedad_id)
    if (!propiedad) return []
    return [
      {
        ...propiedad,
        fotos_urls: propiedad.fotos_urls ?? [],
        scorePct: Number(puntaje.score_pct ?? 0),
        criteriosEvaluados: puntaje.criterios_evaluados,
        criteriosCumplidos: puntaje.criterios_cumplidos,
      },
    ]
  })
}
