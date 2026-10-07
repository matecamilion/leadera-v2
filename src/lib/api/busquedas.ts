import { supabase } from '../supabase'
import type { Database } from '../../types/database'
import type { TipoPropiedad } from './propiedades'
import type { TipoOperacion } from './operaciones'
import { interpretarErrorSupabase } from '../errores'

export type Busqueda = Database['public']['Tables']['busquedas']['Row']

/**
 * El `tipo_operacion` de la búsqueda según el tipo de la operación que la usa.
 *
 * La columna admite 'COMPRA', 'ALQUILER' o null ("sin definir"). VENTA y
 * ALQUILER son el lado que ofrece y no llevan búsqueda, así que dan null.
 */
export function tipoOperacionDeBusqueda(tipo: TipoOperacion): 'COMPRA' | 'ALQUILER' | null {
  if (tipo === 'COMPRA') return 'COMPRA'
  if (tipo === 'BUSQUEDA_ALQUILER') return 'ALQUILER'
  return null
}

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

  if (error) throw new Error(interpretarErrorSupabase(error, 'No se pudo cargar la búsqueda.'))
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
    .select('busqueda_id, tipo')
    .eq('id', operacionId)
    .maybeSingle()

  if (errorOperacion) {
    throw new Error(interpretarErrorSupabase(errorOperacion, 'No se pudo leer la operación.'))
  }
  if (!operacion) throw new Error('No tenés permiso para editar esta operación.')

  // Sale de la operación ya guardada, no del formulario: los criterios se
  // guardan después de la operación, así que el tipo leído es el vigente.
  const tipo_operacion = tipoOperacionDeBusqueda(operacion.tipo)

  // --- La operación ya tiene búsqueda: se actualiza esa fila ---
  if (operacion.busqueda_id) {
    const { data, error } = await supabase
      .from('busquedas')
      .update({ ...criterios, tipo_operacion })
      .eq('id', operacion.busqueda_id)
      .select('id')
      .maybeSingle()

    if (error) throw new Error(interpretarErrorSupabase(error, 'No se pudo guardar la búsqueda.'))
    if (!data) throw new Error('No tenés permiso para editar esta búsqueda.')
    return data.id
  }

  // --- Todavía no tiene: se crea y se cuelga de la operación ---
  const { data: creada, error: errorAlta } = await supabase
    .from('busquedas')
    .insert({
      ...criterios,
      tipo_operacion,
      lead_id: leadId,
      inmobiliaria_id: perfil.inmobiliaria_id,
      agente_id: perfil.id,
      // `activa` la pone la base en true por default.
    })
    .select('id')
    .single()

  if (errorAlta || !creada) {
    throw new Error(interpretarErrorSupabase(errorAlta, 'No se pudo crear la búsqueda.'))
  }

  const { data: vinculada, error: errorVinculo } = await supabase
    .from('operaciones')
    .update({ busqueda_id: creada.id })
    .eq('id', operacionId)
    .select('id')
    .maybeSingle()

  if (errorVinculo) {
    throw new Error(interpretarErrorSupabase(errorVinculo, 'La búsqueda se creó, pero no se pudo vincular a la operación.'))
  }
  if (!vinculada) {
    throw new Error('La búsqueda se creó, pero no tenés permiso para editar la operación.')
  }

  return creada.id
}

/**
 * Alinea el `tipo_operacion` de la búsqueda vinculada con el tipo de la
 * operación, para cuando la operación pasa de COMPRA a BUSQUEDA_ALQUILER o al
 * revés sin que se vuelvan a guardar los criterios (`guardarBusqueda` ya lo
 * escribe cuando sí se guardan).
 *
 * Con un tipo que no busca (VENTA, ALQUILER) no hace nada: la búsqueda queda
 * como estaba. Si ya tenía el valor correcto, el filtro hace que no se escriba.
 */
export async function sincronizarTipoOperacionBusqueda(
  busquedaId: string,
  tipo: TipoOperacion,
): Promise<void> {
  const tipo_operacion = tipoOperacionDeBusqueda(tipo)
  if (!tipo_operacion) return

  const { error } = await supabase
    .from('busquedas')
    .update({ tipo_operacion })
    .eq('id', busquedaId)
    .or(`tipo_operacion.is.null,tipo_operacion.neq.${tipo_operacion}`)

  if (error) {
    throw new Error(
      interpretarErrorSupabase(error, 'La operación se guardó, pero no se pudo actualizar el tipo de la búsqueda.'),
    )
  }
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
 * El RPC ya aplica su propio piso —descarta todo lo que puntúe por debajo del
 * 30%—, así que este tope no está para sacar ruido: está para acotar el
 * segundo viaje. Los ids del corte van en un `.in()`, que viaja en la query
 * string, y unos cientos de UUIDs alcanzan para pasarse del largo máximo de
 * URL y que el request falle entero.
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

  if (error) throw new Error(interpretarErrorSupabase(error, 'No se pudieron buscar coincidencias.'))

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
    throw new Error(interpretarErrorSupabase(errorPropiedades, 'No se pudieron cargar las propiedades.'))
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

// ---------------------------------------------------------------------------
// Compradores para algo que se ofrece
// ---------------------------------------------------------------------------

/**
 * Lo que el agente tiene para ofrecer. Todo opcional: lo que falta no filtra
 * ni puntúa. `moneda` sólo pesa cuando viene `precio`.
 */
export interface CriteriosOferta {
  tipoOperacion: 'COMPRA' | 'ALQUILER' | null
  precio: number | null
  moneda: 'USD' | 'ARS'
  tipoPropiedad: TipoPropiedad | null
  zona: string | null
  ambientes: number | null
  m2: number | null
  banos: number | null
  cocheras: number | null
  expensas: number | null
}

/**
 * ¿Hay algo para buscar? La operación y la moneda no cuentan: tienen siempre
 * un valor por defecto, y solas devolverían a todos los compradores.
 */
export function hayCriterioDeOferta(c: CriteriosOferta): boolean {
  return (
    c.precio != null ||
    c.tipoPropiedad != null ||
    (c.zona != null && c.zona.trim() !== '') ||
    c.ambientes != null ||
    c.m2 != null ||
    c.banos != null ||
    c.cocheras != null ||
    c.expensas != null
  )
}

type FilaComprador =
  Database['public']['Functions']['buscar_compradores']['Returns'][number]

/**
 * Una fila del RPC con la nulabilidad real.
 *
 * El generador de tipos marca todas las columnas de un `returns table` como no
 * nulas, pero estas pueden venir vacías: el lead sin apellido ni teléfono, la
 * búsqueda sin zona ni rango, el score sin criterios evaluados.
 */
export type CompradorParaOferta = Omit<
  FilaComprador,
  | 'apellido'
  | 'telefono'
  | 'estado'
  | 'tipo_operacion'
  | 'tipo_propiedad'
  | 'zona'
  | 'precio_min'
  | 'precio_max'
  | 'ambientes_min'
  | 'score_pct'
  | 'dif_presupuesto_pct'
> & {
  apellido: string | null
  telefono: string | null
  estado: FilaComprador['estado'] | null
  tipo_operacion: 'COMPRA' | 'ALQUILER' | null
  tipo_propiedad: TipoPropiedad | null
  zona: string | null
  precio_min: number | null
  precio_max: number | null
  ambientes_min: number | null
  score_pct: number | null
  dif_presupuesto_pct: number | null
}

/**
 * Búsquedas activas de compradores donde encaja lo que se ofrece.
 *
 * Una fila por búsqueda, ordenadas por score (sin score al final) y después
 * por la más reciente. El agrupado por lead lo hace la pantalla. Corre con la
 * RLS del usuario: cada uno ve sólo los compradores de los leads que ve.
 */
export async function buscarCompradores(
  criterios: CriteriosOferta,
): Promise<CompradorParaOferta[]> {
  const zona = criterios.zona?.trim()

  // Sin `undefined` en el objeto: lo que no vino ni se manda, y el RPC usa su
  // default (null; 'USD' para la moneda).
  const args: Database['public']['Functions']['buscar_compradores']['Args'] = {
    p_moneda: criterios.moneda,
    ...(criterios.tipoOperacion && { p_tipo_operacion: criterios.tipoOperacion }),
    ...(criterios.precio != null && { p_precio: criterios.precio }),
    ...(criterios.tipoPropiedad && { p_tipo_propiedad: criterios.tipoPropiedad }),
    ...(zona && { p_zona: zona }),
    ...(criterios.ambientes != null && { p_ambientes: criterios.ambientes }),
    ...(criterios.m2 != null && { p_m2: criterios.m2 }),
    ...(criterios.banos != null && { p_banos: criterios.banos }),
    ...(criterios.cocheras != null && { p_cocheras: criterios.cocheras }),
    ...(criterios.expensas != null && { p_expensas: criterios.expensas }),
  }

  const { data, error } = await supabase.rpc('buscar_compradores', args)

  if (error) throw new Error(interpretarErrorSupabase(error, 'No se pudieron buscar compradores.'))
  return (data ?? []) as CompradorParaOferta[]
}

/**
 * Una fila por lead: la búsqueda que mejor encaja. Gana el score más alto (sin
 * score cuenta como el peor); a igual score, la búsqueda más reciente.
 *
 * El RPC ya viene en ese orden, pero el criterio se escribe acá igual: la
 * pantalla no tiene que depender de cómo ordena la base.
 */
export function mejorBusquedaPorLead(filas: CompradorParaOferta[]): CompradorParaOferta[] {
  const gana = (a: CompradorParaOferta, b: CompradorParaOferta) => {
    const sa = a.score_pct ?? -1
    const sb = b.score_pct ?? -1
    if (sa !== sb) return sa > sb
    // Como fecha y no como texto: el ISO de PostgREST no siempre trae la misma
    // cantidad de decimales, y comparar strings los ordenaría mal.
    return Date.parse(a.busqueda_created_at) > Date.parse(b.busqueda_created_at)
  }

  const porLead = new Map<string, CompradorParaOferta>()
  for (const fila of filas) {
    const actual = porLead.get(fila.lead_id)
    if (!actual || gana(fila, actual)) porLead.set(fila.lead_id, fila)
  }

  return [...porLead.values()].sort((a, b) => (gana(a, b) ? -1 : gana(b, a) ? 1 : 0))
}

/** Para comparar zonas: sin mayúsculas, sin acentos y sin espacios de más. */
function claveDeZona(zona: string): string {
  return zona
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Las zonas que ya se usan, en propiedades y en búsquedas, para sugerirlas al
 * tipear. Sin duplicados: "Güemes", "guemes" y "GUEMES " son una sola, y queda
 * la primera forma que aparece (las de propiedades primero, que suelen estar
 * mejor escritas). Ordenadas alfabéticamente.
 *
 * Corre con la RLS del usuario, así que son las zonas de su inmobiliaria.
 */
export async function listarZonasConocidas(): Promise<string[]> {
  const [propiedades, busquedas] = await Promise.all([
    supabase.from('propiedades').select('zona').not('zona', 'is', null),
    supabase.from('busquedas').select('zona').not('zona', 'is', null),
  ])

  const fallo = propiedades.error ?? busquedas.error
  if (fallo) throw new Error(interpretarErrorSupabase(fallo, 'No se pudieron cargar las zonas.'))

  const porClave = new Map<string, string>()
  for (const { zona } of [...(propiedades.data ?? []), ...(busquedas.data ?? [])]) {
    const limpia = zona?.replace(/\s+/g, ' ').trim()
    if (!limpia) continue
    const clave = claveDeZona(limpia)
    if (!porClave.has(clave)) porClave.set(clave, limpia)
  }

  return [...porClave.values()].sort((a, b) => a.localeCompare(b, 'es'))
}

/** La demanda activa resumida, para el estado inicial de Coincidencias. */
export interface DemandaActiva {
  /** Búsquedas activas de leads que no están GANADO. */
  total: number
  /** De más a menos. `tipo` null = "le sirve cualquier tipo". */
  porTipo: { tipo: TipoPropiedad | null; cantidad: number }[]
  /** Las más buscadas primero, sin duplicados por mayúsculas ni acentos. */
  zonas: { zona: string; cantidad: number }[]
}

/**
 * Cuánta demanda hay y de qué: total, desglose por tipo y zonas más buscadas.
 *
 * Mismo universo que `buscar_compradores`: búsquedas activas de leads que no
 * están GANADO y que el usuario ve (el `!inner` deja afuera las búsquedas de
 * leads que la RLS le tapa). Se agrega acá porque son pocas filas por
 * inmobiliaria y así no hace falta otra función en la base.
 */
export async function resumirDemandaActiva(): Promise<DemandaActiva> {
  const { data, error } = await supabase
    .from('busquedas')
    .select('tipo_propiedad, zona, lead:leads!inner(estado)')
    .eq('activa', true)

  if (error) throw new Error(interpretarErrorSupabase(error, 'No se pudo cargar la demanda activa.'))

  type Fila = {
    tipo_propiedad: TipoPropiedad | null
    zona: string | null
    lead: { estado: string | null } | null
  }
  const filas = ((data ?? []) as unknown as Fila[]).filter((f) => f.lead?.estado !== 'GANADO')

  const tipos = new Map<TipoPropiedad | null, number>()
  const zonas = new Map<string, { zona: string; cantidad: number }>()
  for (const f of filas) {
    tipos.set(f.tipo_propiedad, (tipos.get(f.tipo_propiedad) ?? 0) + 1)

    const limpia = f.zona?.replace(/\s+/g, ' ').trim()
    if (!limpia) continue
    const clave = claveDeZona(limpia)
    const actual = zonas.get(clave)
    if (actual) actual.cantidad += 1
    else zonas.set(clave, { zona: limpia, cantidad: 1 })
  }

  return {
    total: filas.length,
    porTipo: [...tipos.entries()]
      .map(([tipo, cantidad]) => ({ tipo, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad),
    zonas: [...zonas.values()].sort(
      (a, b) => b.cantidad - a.cantidad || a.zona.localeCompare(b.zona, 'es'),
    ),
  }
}
