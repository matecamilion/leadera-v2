import { supabase } from '../supabase'
import { sanearBusqueda } from './filtros'
import type { Database } from '../../types/database'
import { interpretarErrorSupabase } from '../errores'

export type Operacion = Database['public']['Tables']['operaciones']['Row']
export type TipoOperacion = Database['public']['Enums']['tipo_operacion']
export type EstadoOperacion = Database['public']['Enums']['estado_operacion']

/**
 * Estados del pipeline, en el orden del original.
 *
 * Cubren el enum completo de la base: no hay estados que existan en
 * `estado_operacion` y falten acá, así que todo lo que llegue de la base tiene
 * label, badge y columna en el tablero.
 */
export const ESTADOS_OPERACION: { valor: EstadoOperacion; label: string }[] = [
  { valor: 'PUBLICADA', label: 'Publicada' },
  { valor: 'RESERVADA', label: 'Reservada' },
  { valor: 'EN_NEGOCIACION', label: 'En negociación' },
  { valor: 'CERRADA_GANADA', label: 'Cerrada ganada' },
  { valor: 'CANCELADA', label: 'Cancelada' },
]

export const TIPOS_OPERACION: { valor: TipoOperacion; label: string }[] = [
  { valor: 'VENTA', label: 'Venta' },
  { valor: 'COMPRA', label: 'Compra' },
  { valor: 'ALQUILER', label: 'Alquiler' },
  { valor: 'BUSQUEDA_ALQUILER', label: 'Búsqueda de alquiler' },
]

/** Estados que siguen abiertos. El resto va al final del listado. */
export const ESTADOS_ABIERTOS: EstadoOperacion[] = [
  'PUBLICADA',
  'RESERVADA',
  'EN_NEGOCIACION',
]

export function esAbierta(estado: EstadoOperacion): boolean {
  return ESTADOS_ABIERTOS.includes(estado)
}

/**
 * Estados en los que la base congela la fila.
 *
 * Espejo exacto del `estado IN ('CERRADA_GANADA','CANCELADA')` que usan el
 * trigger `operaciones_proteger_cerrada` y la policy `operaciones_delete`.
 *
 * Hoy es el complemento de `ESTADOS_ABIERTOS`, pero se escribe aparte y no como
 * `!esAbierta(...)`: son dos preguntas distintas —"¿sigue viva?" y "¿la base me
 * deja tocarla?"— y un estado nuevo en el enum no debería quedar bloqueado sólo
 * por haberse olvidado de agregarlo a la otra lista.
 *
 * Es sólo para apagar la UI antes de tiempo. La fuente de verdad es la base:
 * si estos valores se desalinearan, el trigger sigue rechazando igual.
 */
export const ESTADOS_BLOQUEADOS: EstadoOperacion[] = ['CERRADA_GANADA', 'CANCELADA']

/** Los estados de `ESTADOS_BLOQUEADOS`, como tipo. */
export type EstadoTerminal = Extract<EstadoOperacion, 'CERRADA_GANADA' | 'CANCELADA'>

/**
 * Estrecha el tipo además de contestar que sí: quien confirma el cierre necesita
 * saber a cuál de los dos está pasando para elegir el texto que corresponde.
 */
export function esBloqueada(estado: EstadoOperacion): estado is EstadoTerminal {
  return ESTADOS_BLOQUEADOS.includes(estado)
}

export function etiquetaEstadoOperacion(estado: EstadoOperacion): string {
  return (
    ESTADOS_OPERACION.find((e) => e.valor === estado)?.label ??
    estado.replace(/_/g, ' ')
  )
}

export function etiquetaTipoOperacion(tipo: TipoOperacion): string {
  return TIPOS_OPERACION.find((t) => t.valor === tipo)?.label ?? tipo
}

/**
 * ¿Este tipo de operación describe lo que el lead está buscando?
 *
 * Los dos tipos "del lado del que busca": COMPRA (quiere comprar) y
 * BUSQUEDA_ALQUILER (quiere alquilar). En los dos la operación se apoya en una
 * búsqueda —un perfil de criterios— que después puntúa propiedades.
 *
 * VENTA y ALQUILER son el lado de enfrente: ahí la inmobiliaria ya tiene una
 * propiedad concreta para ofrecer y no hay nada que buscar. ALQUILER estuvo
 * acá adentro por error hasta que existió BUSQUEDA_ALQUILER: es el propietario
 * que ofrece, no el inquilino que busca.
 *
 * El filtro por finalidad lo hace el RPC `buscar_coincidencias_busqueda`, que
 * mira el tipo de la operación.
 */
export function llevaCriteriosDeBusqueda(tipo: TipoOperacion): boolean {
  return tipo === 'COMPRA' || tipo === 'BUSQUEDA_ALQUILER'
}

/**
 * ¿Con qué se vincula esta operación: con una búsqueda o con una propiedad?
 *
 * Es la otra mitad de la pregunta anterior y no la misma: `llevaCriterios`
 * decide si se muestra el formulario de criterios, esto decide qué se puede
 * enganchar. Hoy coinciden —quien busca se vincula a una búsqueda; quien ofrece,
 * a una propiedad—, pero se escriben aparte porque son decisiones distintas y
 * un tipo nuevo podría querer una y no la otra.
 *
 * Vivía repetido como `tipo === 'COMPRA'` en tres pantallas. Esa duplicación
 * fue justamente la que dejó que ALQUILER quedara mal clasificado en un lugar y
 * bien en otro.
 */
export function seVinculaConBusqueda(tipo: TipoOperacion): boolean {
  return tipo === 'COMPRA' || tipo === 'BUSQUEDA_ALQUILER'
}

const MONTOS = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 })

export function formatearMonto(monto: number | null, moneda: string): string {
  if (monto == null) return '—'
  return `${moneda} ${MONTOS.format(monto)}`
}

// ---------------------------------------------------------------------------
// Listado
// ---------------------------------------------------------------------------

export interface OperacionConVinculos extends Operacion {
  lead: { id: string; nombre: string; apellido: string | null } | null
  propiedad: { id: string; direccion: string } | null
  busqueda: { id: string; zona: string | null } | null
}

export interface ListarOperacionesParams {
  tipo?: TipoOperacion
  estado?: EstadoOperacion
  /** Texto libre: título de la operación, lead vinculado o dirección. */
  busqueda?: string
  /** 1-indexado. */
  page: number
  pageSize: number
}

/**
 * Lo que devuelve la vista `operaciones_ordenadas`.
 *
 * La vista se creó antes de que existiera `fecha_proximo_seguimiento`, así que
 * esa columna no viene. El listado no la usa, pero el tipo lo dice en vez de
 * castear y hacer creer que está. Si algún día se recrea la vista incluyéndola,
 * este Omit se borra y listo.
 *
 * `rango_estado` es opcional para que las filas que salen de la tabla —las de
 * `listarOperacionesPorLead` y `listarOperacionesPorPropiedad`— sigan encajando
 * en los mismos componentes.
 */
export interface OperacionListada
  extends Omit<OperacionConVinculos, 'fecha_proximo_seguimiento'> {
  rango_estado?: number | null
}

export interface ListarOperacionesResult {
  data: OperacionListada[]
  count: number
}

export async function listarOperaciones({
  tipo,
  estado,
  busqueda,
  page,
  pageSize,
}: ListarOperacionesParams): Promise<ListarOperacionesResult> {
  const desde = (page - 1) * pageSize
  const hasta = desde + pageSize - 1

  // Leemos de la vista, que expone `rango_estado` (0 abiertas / 1 cerradas).
  // Sólo para leer: los insert y update siguen yendo a la tabla `operaciones`.
  let query = supabase
    .from('operaciones_ordenadas')
    .select(
      '*, lead:leads(id, nombre, apellido), propiedad:propiedades(id, direccion), busqueda:busquedas(id, zona)',
      { count: 'exact' },
    )

  if (tipo) query = query.eq('tipo', tipo)
  if (estado) query = query.eq('estado', estado)

  // El texto busca en los tres campos a la vez. `lead_nombre_completo` y
  // `propiedad_direccion` son columnas planas de la vista —nombre + apellido
  // del lead, dirección de la propiedad—: buscar sobre el join embebido
  // (`lead.nombre.ilike...`) no es filtrable en PostgREST sin `!inner`, que
  // además dejaría afuera las operaciones sin lead.
  //
  // Los `.eq` de arriba y este `.or` se combinan con AND: el OR queda acotado
  // a los tres campos de texto, que es lo que se quiere.
  const texto = busqueda ? sanearBusqueda(busqueda) : ''
  if (texto) {
    const patron = `%${texto}%`
    query = query.or(
      `titulo.ilike.${patron},lead_nombre_completo.ilike.${patron},propiedad_direccion.ilike.${patron}`,
    )
  }

  const { data, error, count } = await query
    // El agrupamiento ahora es del server, así que vale entre páginas y no
    // sólo dentro de la que se está viendo.
    .order('rango_estado', { ascending: true })
    .order('created_at', { ascending: false })
    .range(desde, hasta)

  if (error) {
    throw new Error(interpretarErrorSupabase(error, 'No se pudieron cargar las operaciones.'))
  }

  return {
    data: (data ?? []) as unknown as OperacionListada[],
    count: count ?? 0,
  }
}

/**
 * Las operaciones abiertas más recientes, para el resumen de Mi día.
 *
 * Función aparte y no `listarOperaciones` con `pageSize: 3`: su filtro `estado`
 * es un valor único (`.eq`) y acá hace falta el complemento —todo lo que no está
 * cerrado ni cancelado—, que sólo se expresa con `.in(ESTADOS_ABIERTOS)`.
 *
 * Lee de la misma vista que el listado, así que las filas salen con la forma que
 * ya esperan los componentes. El orden es sólo por fecha: `rango_estado` no
 * agrega nada cuando todas las filas son abiertas.
 *
 * El `count` es el de las operaciones abiertas, no el de la tabla entera: es lo
 * que tiene que decir el "Ver todas" de una sección que sólo muestra abiertas.
 */
export async function listarOperacionesEnCurso(
  limit: number,
): Promise<ListarOperacionesResult> {
  const { data, error, count } = await supabase
    .from('operaciones_ordenadas')
    .select(
      '*, lead:leads(id, nombre, apellido), propiedad:propiedades(id, direccion), busqueda:busquedas(id, zona)',
      { count: 'exact' },
    )
    .in('estado', ESTADOS_ABIERTOS)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(interpretarErrorSupabase(error, 'No se pudieron cargar las operaciones en curso.'))
  }

  return {
    data: (data ?? []) as unknown as OperacionListada[],
    count: count ?? 0,
  }
}

// ---------------------------------------------------------------------------
// Alta
// ---------------------------------------------------------------------------

export interface CrearOperacionInput {
  tipo: TipoOperacion
  titulo: string
  /** Los tres vínculos son opcionales: se puede cargar y vincular después. */
  lead_id?: string | null
  propiedad_id?: string | null
  busqueda_id?: string | null
  monto?: number | null
  moneda?: string
  notas?: string
}

export async function crearOperacion(
  input: CrearOperacionInput,
): Promise<Operacion> {
  const { data: userData, error: errorUser } = await supabase.auth.getUser()
  if (errorUser || !userData.user) throw new Error('Tu sesión expiró. Volvé a entrar.')

  // inmobiliaria_id es NOT NULL y RLS exige que sea la del agente: ambos
  // salen del profile, nunca del formulario.
  const { data: perfil, error: errorPerfil } = await supabase
    .from('profiles')
    .select('id, inmobiliaria_id')
    .eq('id', userData.user.id)
    .single()

  if (errorPerfil || !perfil) throw new Error('No encontramos tu perfil de agente.')

  const { data, error } = await supabase
    .from('operaciones')
    .insert({
      inmobiliaria_id: perfil.inmobiliaria_id,
      agente_id: perfil.id,
      tipo: input.tipo,
      titulo: input.titulo.trim(),
      estado: 'PUBLICADA',
      lead_id: input.lead_id || null,
      propiedad_id: input.propiedad_id || null,
      busqueda_id: input.busqueda_id || null,
      monto: input.monto ?? null,
      ...(input.moneda ? { moneda: input.moneda } : {}),
      notas: input.notas?.trim() || null,
    })
    .select('*')
    .single()

  if (error) throw new Error(interpretarErrorSupabase(error, 'No se pudo crear la operación.'))
  return data
}

// ---------------------------------------------------------------------------
// Selectores del formulario
// ---------------------------------------------------------------------------

export interface PropiedadResumida {
  id: string
  direccion: string
  tipo: Database['public']['Enums']['tipo_propiedad']
  precio: number | null
}

/**
 * Búsqueda para el combobox de propiedad.
 *
 * Sin alta inline, a diferencia de ComboboxLead: cargar una propiedad completa
 * desde un dropdown chico no tiene sentido, y la propiedad puede vincularse
 * después desde su propia ficha.
 */
export async function buscarPropiedadesParaCombobox(
  texto: string,
): Promise<PropiedadResumida[]> {
  const limpio = texto.replace(/[,()\\]/g, ' ').trim()
  if (!limpio) return []

  const { data, error } = await supabase
    .from('propiedades')
    .select('id, direccion, tipo, precio')
    .ilike('direccion', `%${limpio}%`)
    .order('direccion', { ascending: true })
    .limit(8)

  if (error) throw new Error(interpretarErrorSupabase(error, 'No se pudieron buscar propiedades.'))
  return data ?? []
}

export interface BusquedaResumida {
  id: string
  zona: string | null
  tipo_propiedad: Database['public']['Enums']['tipo_propiedad'] | null
  precio_min: number | null
  precio_max: number | null
  /** `ambientes_min` y `notas` los agrega el resumen de la ficha del lead. */
  ambientes_min: number | null
  notas: string | null
}

/**
 * Búsquedas de un lead, para el selector del tipo COMPRA.
 *
 * Un lead tiene pocas búsquedas, así que van todas a un `<select>` común en
 * vez de un combobox con debounce.
 *
 * El mismo resultado alimenta el "Qué busca" del resumen de la ficha: filtra
 * por `activa` y ordena por fecha, que es exactamente lo que esa sección
 * necesita mostrar.
 */
export async function listarBusquedasDeLead(
  leadId: string,
): Promise<BusquedaResumida[]> {
  const { data, error } = await supabase
    .from('busquedas')
    .select('id, zona, tipo_propiedad, precio_min, precio_max, ambientes_min, notas')
    .eq('lead_id', leadId)
    .eq('activa', true)
    .order('created_at', { ascending: false })

  if (error) throw new Error(interpretarErrorSupabase(error, 'No se pudieron cargar las búsquedas.'))
  return data ?? []
}

/**
 * NOTA SOBRE EL ORDEN
 *
 * Negocio pide abiertas (PUBLICADA, RESERVADA, EN_NEGOCIACION) primero y
 * cerradas (CERRADA_GANADA, CANCELADA) al final, cada grupo por created_at desc.
 *
 * Ordenar por el enum no sirve. Postgres ordena los enums por su orden de
 * declaración, así que el agrupamiento quedaría atado a que ese orden siga
 * siendo el conveniente: hoy `estado_operacion` declara las cerradas al final
 * y funcionaría de casualidad, pero un estado nuevo se agrega SIEMPRE después
 * de `CANCELADA` y volvería a romperlo. Y PostgREST no admite un CASE en el
 * `order`.
 *
 * El listado paginado lo resuelve leyendo de la vista `operaciones_ordenadas`,
 * que materializa el rango como columna:
 *
 *   create view operaciones_ordenadas as
 *   select *,
 *     case when estado in ('CERRADA_GANADA','CANCELADA') then 1 else 0 end
 *       as rango_estado
 *   from operaciones;
 *
 * Así el agrupamiento es del server y vale entre páginas.
 *
 * `listarOperacionesPorLead` y `listarOperacionesPorPropiedad` siguen leyendo
 * de la tabla y reagrupando con `ordenarAbiertasPrimero`: no están paginadas
 * —traen todas las de un lead o una propiedad— así que ordenar en el cliente
 * da el mismo resultado y evita depender de la vista.
 */

// ---------------------------------------------------------------------------
// Fase 4c-ii — detalle y vínculos
// ---------------------------------------------------------------------------

export interface OperacionDetalle extends Operacion {
  lead: {
    id: string
    nombre: string
    apellido: string | null
    telefono: string | null
    estado: Database['public']['Enums']['estado_lead'] | null
  } | null
  propiedad: {
    id: string
    direccion: string
    zona: string | null
    tipo: Database['public']['Enums']['tipo_propiedad']
    estado: Database['public']['Enums']['estado_propiedad']
    ambientes: number | null
    metros_cuadrados: number | null
    precio: number | null
    moneda: string
    link_portal: string | null
  } | null
  busqueda: {
    id: string
    zona: string | null
    tipo_propiedad: Database['public']['Enums']['tipo_propiedad'] | null
    ambientes_min: number | null
    precio_min: number | null
    precio_max: number | null
    notas: string | null
  } | null
}

const SELECT_DETALLE =
  '*, lead:leads(id, nombre, apellido, telefono, estado), ' +
  'propiedad:propiedades(id, direccion, zona, tipo, estado, ambientes, metros_cuadrados, precio, moneda, link_portal), ' +
  'busqueda:busquedas(id, zona, tipo_propiedad, ambientes_min, precio_min, precio_max, notas)'

/**
 * Una operación por id. Devuelve null si no existe o si RLS la tapa: para el
 * usuario los dos casos son lo mismo, y distinguirlos filtraría información.
 */
export async function obtenerOperacionPorId(
  id: string,
): Promise<OperacionDetalle | null> {
  const { data, error } = await supabase
    .from('operaciones')
    .select(SELECT_DETALLE)
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(interpretarErrorSupabase(error, 'No se pudo cargar la operación.'))
  return data as unknown as OperacionDetalle | null
}

/**
 * Cambia el estado y, al cerrar ganada, estampa `fecha_cierre` si estaba vacía.
 *
 * Sólo la estampa la primera vez: si la operación ya tenía fecha, se respeta.
 * Y ningún otro estado la toca — reabrir una operación deja la fecha del cierre
 * anterior en su lugar, que es lo acordado.
 */
export async function actualizarEstadoOperacion(
  id: string,
  estado: EstadoOperacion,
): Promise<Operacion> {
  const cambios: { estado: EstadoOperacion; fecha_cierre?: string } = { estado }

  if (estado === 'CERRADA_GANADA') {
    // Hace falta leer antes: no hay forma de decir "seteá sólo si es null"
    // en un update de PostgREST.
    const { data: actual, error: errorLectura } = await supabase
      .from('operaciones')
      .select('fecha_cierre')
      .eq('id', id)
      .maybeSingle()

    if (errorLectura) {
      throw new Error(interpretarErrorSupabase(errorLectura, 'No se pudo actualizar el estado.'))
    }
    if (actual && !actual.fecha_cierre) {
      cambios.fecha_cierre = new Date().toISOString()
    }
  }

  const { data, error } = await supabase
    .from('operaciones')
    .update(cambios)
    .eq('id', id)
    .select('*')
    .maybeSingle()

  if (error) throw new Error(interpretarErrorSupabase(error, 'No se pudo actualizar el estado.'))
  if (!data) throw new Error('No tenés permiso para editar esta operación.')
  return data
}

/** Operaciones de un lead, para la tab de su ficha. */
export async function listarOperacionesPorLead(
  leadId: string,
): Promise<OperacionConVinculos[]> {
  const { data, error } = await supabase
    .from('operaciones')
    .select(
      '*, lead:leads(id, nombre, apellido), propiedad:propiedades(id, direccion), busqueda:busquedas(id, zona)',
    )
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(interpretarErrorSupabase(error, 'No se pudieron cargar las operaciones del lead.'))
  }
  return ordenarAbiertasPrimero((data ?? []) as unknown as OperacionConVinculos[])
}

/** Operaciones de una propiedad, para la sección de su ficha. */
export async function listarOperacionesPorPropiedad(
  propiedadId: string,
): Promise<OperacionConVinculos[]> {
  const { data, error } = await supabase
    .from('operaciones')
    .select(
      '*, lead:leads(id, nombre, apellido), propiedad:propiedades(id, direccion), busqueda:busquedas(id, zona)',
    )
    .eq('propiedad_id', propiedadId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(interpretarErrorSupabase(error, 'No se pudieron cargar las operaciones de la propiedad.'))
  }
  return ordenarAbiertasPrimero((data ?? []) as unknown as OperacionConVinculos[])
}

/** Abiertas primero, cerradas al final, cada grupo por created_at desc. */
function ordenarAbiertasPrimero(
  filas: OperacionConVinculos[],
): OperacionConVinculos[] {
  return [...filas].sort((a, b) => {
    const rangoA = esAbierta(a.estado) ? 0 : 1
    const rangoB = esAbierta(b.estado) ? 0 : 1
    if (rangoA !== rangoB) return rangoA - rangoB
    return b.created_at.localeCompare(a.created_at)
  })
}

// ---------------------------------------------------------------------------
// Fase 4c-iii — tablero Kanban
// ---------------------------------------------------------------------------

export interface OperacionKanban {
  id: string
  titulo: string | null
  tipo: TipoOperacion
  estado: EstadoOperacion
  monto: number | null
  moneda: string
  created_at: string
  /** Lo actualiza un trigger en cada cambio; alimenta el badge de "trabada". */
  updated_at: string
  lead: {
    id: string
    nombre: string
    apellido: string | null
    telefono: string | null
  } | null
}

/** Cuántas filas trae el tablero por cada columna cerrada. */
export const CERRADAS_EN_TABLERO = 30

/**
 * Columnas que el tablero trae completas.
 *
 * El pipeline activo es naturalmente acotado: una inmobiliaria no sostiene
 * cientos de operaciones abiertas a la vez, y si las tuviera, verlas todas es
 * justamente para lo que sirve el tablero.
 */
const ESTADOS_ACTIVOS_TABLERO: EstadoOperacion[] = [
  'PUBLICADA',
  'EN_NEGOCIACION',
  'RESERVADA',
]

const COLUMNAS_KANBAN =
  'id, titulo, tipo, estado, monto, moneda, created_at, updated_at, lead:leads(id, nombre, apellido, telefono)'

/** Un monto acumulado, por moneda. No se mezclan entre sí. */
export interface TotalPorMoneda {
  moneda: string
  total: number
}

export interface TableroKanban {
  /** Las filas a mostrar. Las de las columnas cerradas vienen recortadas. */
  operaciones: OperacionKanban[]
  /**
   * Total real por estado, del RPC.
   *
   * En las columnas cerradas puede ser mayor que la cantidad de filas de
   * `operaciones`: ese es todo el punto de separarlo. Un estado sin
   * operaciones puede faltar; se lee con `?? 0`.
   */
  totales: Partial<Record<EstadoOperacion, number>>
  /**
   * Monto real por estado y moneda, del RPC.
   *
   * Va aparte de las filas por el mismo motivo que el conteo: sumar lo que
   * está cargado daría un número parcial en las columnas recortadas. Una
   * combinación estado/moneda sin operaciones con monto no aparece; se lee
   * con `?? []`.
   */
  montos: Partial<Record<EstadoOperacion, TotalPorMoneda[]>>
}

/** Las 30 más recientes de una columna cerrada. */
function filasCerradas(estado: EstadoOperacion) {
  return supabase
    .from('operaciones')
    .select(COLUMNAS_KANBAN)
    .eq('estado', estado)
    // `nullsFirst: false` no es decorativo: en Postgres un ORDER BY DESC pone
    // los NULL primero, así que sin esto una operación cerrada a la que nunca
    // le cargaron la fecha de cierre le ganaría el lugar a las que sí se
    // cerraron hace poco, que son las que el tablero quiere mostrar.
    .order('fecha_cierre', { ascending: false, nullsFirst: false })
    .limit(CERRADAS_EN_TABLERO)
}

/**
 * Las operaciones del tablero, más el total real de cada columna.
 *
 * Antes esto traía TODAS las operaciones de la inmobiliaria sin límite, sólo
 * para que el contador de cada columna fuera exacto. Con el historial migrado
 * de v1 eso significa bajar años de CERRADA_GANADA y CANCELADA en cada visita
 * al tablero, que es lo contrario de para lo que sirve: el Kanban es para
 * mover el pipeline activo, no para revisar lo que ya terminó.
 *
 * Ahora los contadores salen de un RPC agregado y las filas se traen aparte:
 * completas para las columnas activas, recortadas a las
 * `CERRADAS_EN_TABLERO` más recientes para las cerradas. Quien quiera el
 * historial entero lo tiene en el listado, que pagina y filtra de verdad.
 */
export async function listarOperacionesKanban(): Promise<TableroKanban> {
  const [conteo, sumas, activas, ganadas, canceladas] = await Promise.all([
    supabase.rpc('conteo_operaciones_por_estado'),
    supabase.rpc('suma_montos_por_estado'),
    supabase
      .from('operaciones')
      .select(COLUMNAS_KANBAN)
      .in('estado', ESTADOS_ACTIVOS_TABLERO)
      .order('updated_at', { ascending: false }),
    filasCerradas('CERRADA_GANADA'),
    filasCerradas('CANCELADA'),
  ])

  const fallo =
    conteo.error ?? sumas.error ?? activas.error ?? ganadas.error ?? canceladas.error
  if (fallo) {
    throw new Error(interpretarErrorSupabase(fallo, 'No se pudo cargar el tablero.'))
  }

  const totales: Partial<Record<EstadoOperacion, number>> = {}
  for (const fila of conteo.data ?? []) {
    // `count(*)` es bigint: llega como number en estos volúmenes, pero se
    // fuerza igual, mismo criterio que el resto de los RPC de conteo.
    totales[fila.estado] = Number(fila.total) || 0
  }

  const montos: Partial<Record<EstadoOperacion, TotalPorMoneda[]>> = {}
  for (const fila of sumas.data ?? []) {
    const columna = (montos[fila.estado] ??= [])
    columna.push({ moneda: fila.moneda, total: Number(fila.total_monto) || 0 })
  }
  // La moneda más grande primero, que es el orden que ya mostraba el tablero
  // cuando la suma se hacía en JS.
  for (const columna of Object.values(montos)) {
    columna?.sort((a, b) => b.total - a.total)
  }

  const operaciones = [
    ...(activas.data ?? []),
    ...(ganadas.data ?? []),
    ...(canceladas.data ?? []),
  ] as unknown as OperacionKanban[]

  return { operaciones, totales, montos }
}

/**
 * Agenda (o borra) el próximo seguimiento de una operación.
 *
 * La columna existía desde antes pero ningún formulario la escribía: se veía en
 * el detalle y nunca se podía cargar. `null` la limpia.
 */
export async function actualizarSeguimientoOperacion(
  id: string,
  fecha: string | null,
): Promise<Operacion> {
  const { data, error } = await supabase
    .from('operaciones')
    .update({ fecha_proximo_seguimiento: fecha })
    .eq('id', id)
    .select('*')
    .maybeSingle()

  if (error) throw new Error(interpretarErrorSupabase(error, 'No se pudo agendar el seguimiento.'))
  if (!data) throw new Error('No tenés permiso para editar esta operación.')
  return data
}

// ---------------------------------------------------------------------------
// Edición y borrado
// ---------------------------------------------------------------------------

/**
 * Lo que se puede editar de una operación ya creada.
 *
 * `estado` y `fecha_proximo_seguimiento` quedan afuera a propósito: siguen
 * teniendo su propio camino (`actualizarEstadoOperacion` y
 * `actualizarSeguimientoOperacion`), que es lo que estampa `fecha_cierre`.
 * Meterlos acá abriría una segunda puerta al estado sin esa lógica.
 *
 * `agente_id` e `inmobiliaria_id` tampoco: son atribución, no un dato de la
 * ficha.
 */
export type CamposEditablesOperacion = Partial<
  Pick<
    Operacion,
    | 'titulo'
    | 'monto'
    | 'moneda'
    | 'notas'
    | 'tipo'
    | 'lead_id'
    | 'propiedad_id'
    | 'busqueda_id'
  >
>

export const MENSAJE_EDITAR_BLOQUEADA =
  'No se puede editar una operación cerrada o cancelada.'

export const MENSAJE_ELIMINAR_BLOQUEADA =
  'No se puede eliminar una operación cerrada. Si fue cargada por error, cancelala en su lugar.'

/**
 * Mensaje del DELETE que no borró nada.
 *
 * `operaciones_delete` exige tres cosas a la vez: misma inmobiliaria, estado
 * abierto, y ser el dueño de la agencia / el agente de la operación / su
 * asistente. Cuando falla, PostgREST devuelve una lista vacía sin decir cuál de
 * las tres fue, así que el mensaje nombra las dos causas posibles en vez de
 * afirmar la que no podemos comprobar.
 */
export const MENSAJE_ELIMINAR_RECHAZADO =
  'No se pudo eliminar la operación: puede que ya esté cerrada —en ese caso, cancelala en su lugar— o que sea de otro agente.'

/**
 * ¿Este error viene del trigger que congela las operaciones cerradas?
 *
 * Un `raise exception` de PL/pgSQL sin SQLSTATE propio llega como `P0001`. Se
 * mira además el texto por si el trigger se cambiara para levantar otro código:
 * de lo que NO depende es del texto exacto del mensaje, que es de la base y
 * puede reescribirse sin avisar.
 */
function esRechazoPorCerrada(error: { code?: string; message?: string }): boolean {
  if (error.code === 'P0001') return true
  return /cerrad|cancelad/i.test(error.message ?? '')
}

/**
 * Edita los campos de una operación.
 *
 * Manda sólo lo que se le pasa: un `Partial` vacío no toca nada. La regla de
 * "está cerrada, no se toca" NO se reimplementa acá — la aplica el trigger
 * `operaciones_proteger_cerrada`, y esta función se limita a traducir su
 * rechazo a una frase legible. La UI apaga el botón antes por comodidad, no
 * como control.
 */
export async function actualizarOperacion(
  id: string,
  campos: CamposEditablesOperacion,
): Promise<Operacion> {
  const { data, error } = await supabase
    .from('operaciones')
    .update(campos)
    .eq('id', id)
    .select('*')
    .maybeSingle()

  if (error) {
    if (esRechazoPorCerrada(error)) throw new Error(MENSAJE_EDITAR_BLOQUEADA)
    // El resto sigue la convención del módulo: se propaga con contexto y lo
    // traduce `mensajeDeError`, que ya sabe mapear los constraints por nombre.
    throw new Error(interpretarErrorSupabase(error, 'No se pudo guardar la operación.'))
  }

  // Sin error y sin fila: RLS la tapó (otra inmobiliaria) o ya no existe.
  if (!data) throw new Error('No tenés permiso para editar esta operación.')
  return data
}

/**
 * Borra una operación.
 *
 * La policy `operaciones_delete` no deja borrar las cerradas ni las canceladas.
 * PostgREST no trata como error un DELETE que la policy filtra: responde 200
 * con una lista vacía. Por eso pedimos de vuelta la fila borrada —mismo patrón
 * que `eliminarLead` y `eliminarPropiedad`—: sin ese chequeo, un borrado
 * rechazado se vería como exitoso y la UI navegaría al listado igual.
 */
export async function eliminarOperacion(id: string): Promise<void> {
  const { data, error } = await supabase
    .from('operaciones')
    .delete()
    .eq('id', id)
    .select('id')

  if (error) {
    if (esRechazoPorCerrada(error)) throw new Error(MENSAJE_ELIMINAR_BLOQUEADA)
    // 23503 = foreign_key_violation. Es el caso normal, no un borde: tres
    // tablas referencian `operaciones` —interacciones, tareas y visitas— y
    // ninguna de las tres FK tiene `on delete cascade`, así que cualquier
    // operación con algo colgado rebota acá.
    if (error.code === '23503') {
      throw new Error(
        'La operación tiene actividad asociada (interacciones, tareas o visitas) y no se puede eliminar. Cancelala en su lugar.',
      )
    }
    throw new Error(interpretarErrorSupabase(error, 'No se pudo eliminar la operación.'))
  }

  if (!data || data.length === 0) throw new Error(MENSAJE_ELIMINAR_RECHAZADO)
}
