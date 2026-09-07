import { supabase } from '../supabase'
import { normalizarTelefonoAR, soloDigitos } from '../telefono'
import type { Database } from '../../types/database'
// Re-export: las etiquetas viven en su propio módulo (sin supabase) pero
// el resto de la app las sigue importando desde acá.
export {
  ORIGENES_LEAD,
  etiquetaOrigen,
  etiquetaEstado,
} from '../etiquetasLead'

export type Lead = Database['public']['Tables']['leads']['Row']
export type EstadoLead = Database['public']['Enums']['estado_lead']
export type TipoOperacion = Database['public']['Enums']['tipo_operacion']

/** Filtro de estado que acepta el listado. `undefined` = todos. */
export type FiltroEstado = EstadoLead | 'nuevos'

export interface ListarLeadsParams {
  estado?: FiltroEstado
  busqueda?: string
  /** 1-indexado. */
  page: number
  pageSize: number
}

export interface ListarLeadsResult {
  data: Lead[]
  /** Total de filas que matchean el filtro, para la paginación. */
  count: number
}

/** PostgREST usa la coma como separador en `.or()`: hay que neutralizarla. */
function sanearBusqueda(texto: string): string {
  return texto.replace(/[,()\\]/g, ' ').trim()
}

/**
 * Los dos queries de abajo (listado y conteo) comparten filtros pero devuelven
 * builders de tipos distintos. En vez de nombrar el tipo interno de PostgREST
 * —que cambia entre versiones— pedimos estructuralmente los tres métodos que
 * usamos, encadenables sobre sí mismos.
 */
interface QueryFiltrable<Self> {
  is(columna: 'fecha_primer_contacto_real', valor: null): Self
  eq(columna: 'estado', valor: EstadoLead): Self
  or(filtro: string): Self
}

function aplicarFiltros<Q extends QueryFiltrable<Q>>(
  query: Q,
  estado: FiltroEstado | undefined,
  busqueda: string | undefined,
): Q {
  let q = query

  if (estado === 'nuevos') {
    // Un lead es "nuevo" por no haber sido contactado nunca, no por su estado.
    q = q.is('fecha_primer_contacto_real', null)
  } else if (estado) {
    q = q.eq('estado', estado)
  }

  if (estado !== 'GANADO') {
    // GANADO sale del listado salvo que se lo pida explícitamente.
    // `.neq('estado','GANADO')` solo no alcanza: en SQL `estado <> 'GANADO'`
    // evalúa a NULL cuando estado es NULL, y esas filas —los leads sin
    // clasificar, justo los que más importan— quedarían afuera.
    q = q.or('estado.is.null,estado.neq.GANADO')
  }

  const texto = busqueda ? sanearBusqueda(busqueda) : ''
  if (texto) {
    const patron = `%${texto}%`
    q = q.or(
      `nombre.ilike.${patron},apellido.ilike.${patron},telefono.ilike.${patron},email.ilike.${patron}`,
    )
  }

  return q
}

/**
 * Listado paginado de leads de la inmobiliaria del usuario.
 *
 * No filtramos por inmobiliaria_id acá: RLS ya lo hace en el server y
 * duplicarlo en el cliente daría la falsa impresión de que es el frontend
 * quien protege los datos.
 */
export async function listarLeads({
  estado,
  busqueda,
  page,
  pageSize,
}: ListarLeadsParams): Promise<ListarLeadsResult> {
  const desde = (page - 1) * pageSize
  const hasta = desde + pageSize - 1

  let query = aplicarFiltros(
    supabase.from('leads').select('*', { count: 'exact' }),
    estado,
    busqueda,
  )

  query = query
    // 1. Los que tienen seguimiento agendado, del más atrasado al más lejano.
    .order('fecha_proximo_seguimiento', { ascending: true, nullsFirst: false })
    // 2. Entre los que no tienen seguimiento, primero los nunca contactados.
    .order('fecha_primer_contacto_real', { ascending: true, nullsFirst: true })
    // 3. Después por temperatura. El enum estado_lead está declarado
    //    CALIENTE, TIBIO, FRIO, GANADO, INACTIVO y Postgres ordena los enums
    //    por orden de declaración, así que esto ya da la prioridad pedida.
    .order('estado', { ascending: true, nullsFirst: true })
    .order('fecha_ultimo_contacto_real', { ascending: true, nullsFirst: true })
    .order('fecha_ingreso', { ascending: true })
    .range(desde, hasta)

  const { data, error, count } = await query
  if (error) throw new Error(`No se pudieron cargar los leads: ${error.message}`)

  return { data: data ?? [], count: count ?? 0 }
}

/** Total sin filtro de estado — alimenta el contador del chip "Todos". */
export async function contarLeads(busqueda?: string): Promise<number> {
  const query = aplicarFiltros(
    supabase.from('leads').select('id', { count: 'exact', head: true }),
    undefined,
    busqueda,
  )

  const { count, error } = await query
  if (error) throw new Error(`No se pudo contar los leads: ${error.message}`)
  return count ?? 0
}

export interface ResumenOperaciones {
  compra: number
  venta: number
}

/**
 * Cuenta operaciones de compra y venta por lead.
 *
 * Trae sólo lead_id + tipo de los leads visibles en la página y agrupa en JS:
 * son 20 filas por página, no justifica una vista ni un RPC.
 */
export async function contarOperacionesPorLead(
  leadIds: string[],
): Promise<Map<string, ResumenOperaciones>> {
  const resumen = new Map<string, ResumenOperaciones>()
  if (leadIds.length === 0) return resumen

  const { data, error } = await supabase
    .from('operaciones')
    .select('lead_id, tipo')
    .in('lead_id', leadIds)

  if (error) throw new Error(`No se pudieron cargar las operaciones: ${error.message}`)

  for (const fila of data ?? []) {
    if (!fila.lead_id) continue
    const actual = resumen.get(fila.lead_id) ?? { compra: 0, venta: 0 }
    if (fila.tipo === 'COMPRA') actual.compra += 1
    if (fila.tipo === 'VENTA') actual.venta += 1
    resumen.set(fila.lead_id, actual)
  }

  return resumen
}

export interface ResumenInteracciones {
  cantidad: number
  /** Detalle de la interacción más reciente, para la nota "Última:". */
  ultimoDetalle: string | null
}

/**
 * Cantidad de interacciones y detalle de la última, por lead.
 *
 * Sale de un solo RPC agregado y no de traerse las filas para contarlas en JS.
 * Antes esto bajaba TODAS las interacciones de los leads de la página —sin
 * límite— y descartaba casi todo: un lead con 200 interacciones costaba 200
 * filas para pintar un número y un renglón. El costo pasó de ser proporcional
 * al historial de la página a serlo a la cantidad de leads, que está acotada
 * por `LEADS_POR_PAGINA`.
 *
 * `resumen_interacciones_por_lead` devuelve una fila por cada lead QUE TENGA
 * interacciones; los que no tienen ninguna no vuelven y quedan fuera del Map.
 * Eso es exactamente lo que el consumidor ya esperaba: busca por id y cae en su
 * propio "vacío" cuando no encuentra nada.
 *
 * La función no es SECURITY DEFINER: corre con el RLS del que la llama, así que
 * el filtro por inmobiliaria lo sigue aplicando la base y no este código.
 */
export async function contarInteraccionesPorLead(
  leadIds: string[],
): Promise<Map<string, ResumenInteracciones>> {
  const resumen = new Map<string, ResumenInteracciones>()
  if (leadIds.length === 0) return resumen

  const { data, error } = await supabase.rpc('resumen_interacciones_por_lead', {
    p_lead_ids: leadIds,
  })

  if (error) throw new Error(`No se pudieron cargar las interacciones: ${error.message}`)

  for (const fila of data ?? []) {
    resumen.set(fila.lead_id, {
      // `count(*)` es bigint: llega como number en estos volúmenes, pero se
      // fuerza igual, mismo criterio que `contar_visitas_lead`.
      cantidad: Number(fila.total_interacciones) || 0,
      ultimoDetalle: fila.ultimo_detalle,
    })
  }

  return resumen
}

export async function eliminarLead(id: string): Promise<void> {
  // Pedimos de vuelta la fila borrada a propósito. Un DELETE que RLS filtra no
  // es un error para PostgREST: responde 200 con una lista vacía. Sin este
  // chequeo el borrado fallado se vería como exitoso en la UI.
  const { data, error } = await supabase.from('leads').delete().eq('id', id).select('id')

  if (error) throw new Error(`No se pudo eliminar el lead: ${error.message}`)
  if (!data || data.length === 0) {
    throw new Error('No tenés permiso para eliminar este lead.')
  }
}

// ---------------------------------------------------------------------------
// Fase 4a-ii — alta y detalle
// ---------------------------------------------------------------------------

export type OrigenLead = Database['public']['Enums']['origen_lead']

/**
 * Etiquetas legibles del enum de origen. El backend viejo ya mandaba el texto
 * lindo; acá traducimos nosotros. El orden es el del selector del Angular.
 */
export interface CrearLeadInput {
  nombre: string
  apellido: string
  telefono: string
  email?: string
  origen: OrigenLead
  descripcion_inicial?: string
  /** Valor de un <input type="datetime-local">, en hora local. */
  fecha_proximo_seguimiento?: string
}

/**
 * Alta de lead.
 *
 * `estado` NO se manda a propósito: todo lead nace en NULL ("nuevo"), y esa
 * es la señal que usa el listado para priorizar. El Angular viejo pedía un
 * estado inicial; acá se decidió sacarlo.
 */
export async function crearLead(input: CrearLeadInput): Promise<Lead> {
  const { data: userData, error: errorUser } = await supabase.auth.getUser()
  if (errorUser || !userData.user) throw new Error('Tu sesión expiró. Volvé a entrar.')

  // inmobiliaria_id es NOT NULL y RLS exige que sea la del agente, así que
  // ambos salen del profile y nunca del formulario.
  const { data: perfil, error: errorPerfil } = await supabase
    .from('profiles')
    .select('id, inmobiliaria_id')
    .eq('id', userData.user.id)
    .single()

  if (errorPerfil || !perfil) throw new Error('No encontramos tu perfil de agente.')

  const { data, error } = await supabase
    .from('leads')
    .insert({
      inmobiliaria_id: perfil.inmobiliaria_id,
      agente_id: perfil.id,
      nombre: input.nombre.trim(),
      apellido: input.apellido.trim(),
      telefono: input.telefono.trim(),
      email: input.email?.trim() || null,
      origen: input.origen,
      descripcion_inicial: input.descripcion_inicial?.trim() || null,
      fecha_proximo_seguimiento: aIso(input.fecha_proximo_seguimiento),
    })
    .select('*')
    .single()

  if (error) {
    // 23505 = unique_violation. Si hay índice único por email, este es el caso.
    if (error.code === '23505') throw new Error('Ya existe un lead con ese email.')
    throw new Error(`No se pudo crear el lead: ${error.message}`)
  }

  return data
}

/** El input datetime-local viene sin zona; Date lo interpreta como hora local. */
function aIso(valor: string | undefined): string | null {
  if (!valor) return null
  const fecha = new Date(valor)
  return Number.isNaN(fecha.getTime()) ? null : fecha.toISOString()
}

/**
 * Un lead por id. Devuelve null si no existe o si RLS lo tapa: para el usuario
 * los dos casos son lo mismo, y distinguirlos filtraría información.
 */
export async function obtenerLeadPorId(id: string): Promise<Lead | null> {
  const { data, error } = await supabase.from('leads').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(`No se pudo cargar el lead: ${error.message}`)
  return data
}

export interface ContactoLead {
  nombre: string
  apellido: string
  telefono: string
  email: string | null
}

export async function actualizarContacto(
  id: string,
  contacto: ContactoLead,
): Promise<Lead> {
  const { data, error } = await supabase
    .from('leads')
    .update({
      nombre: contacto.nombre.trim(),
      apellido: contacto.apellido.trim(),
      telefono: contacto.telefono.trim(),
      email: contacto.email?.trim() || null,
    })
    .eq('id', id)
    .select('*')
    .maybeSingle()

  if (error) throw new Error(`No se pudo actualizar el contacto: ${error.message}`)
  if (!data) throw new Error('No tenés permiso para editar este lead.')
  return data
}

/** `null` devuelve el lead al estado "nuevo". */
export async function actualizarEstado(
  id: string,
  estado: EstadoLead | null,
): Promise<Lead> {
  const { data, error } = await supabase
    .from('leads')
    .update({ estado })
    .eq('id', id)
    .select('*')
    .maybeSingle()

  if (error) throw new Error(`No se pudo actualizar el estado: ${error.message}`)
  if (!data) throw new Error('No tenés permiso para editar este lead.')
  return data
}

// ---------------------------------------------------------------------------
// Fase 4b-i — búsqueda liviana para comboboxes
// ---------------------------------------------------------------------------

export interface LeadResumido {
  id: string
  nombre: string
  apellido: string | null
  telefono: string | null
}

/**
 * Búsqueda para el selector de propietario/contacto.
 *
 * Distinta de `listarLeads`: trae sólo cuatro columnas, sin conteos ni
 * paginación, y limitada a 8 filas. `listarLeads` traería de más para un
 * dropdown que se dispara en cada tecla.
 */
export async function buscarLeadsParaCombobox(
  texto: string,
): Promise<LeadResumido[]> {
  const limpio = sanearBusqueda(texto)
  if (!limpio) return []

  const patron = `%${limpio}%`
  const { data, error } = await supabase
    .from('leads')
    .select('id, nombre, apellido, telefono')
    .or(`nombre.ilike.${patron},apellido.ilike.${patron},telefono.ilike.${patron}`)
    .order('nombre', { ascending: true })
    .limit(8)

  if (error) throw new Error(`No se pudieron buscar los leads: ${error.message}`)
  return data ?? []
}

/**
 * Cuántos dígitos finales se usan para prefiltrar en la base.
 *
 * Los últimos cuatro son los que quedan juntos en cualquiera de los formatos
 * que se escriben en la práctica —"223 456-7890", "2234567890", "+54 9 223
 * 456-7890"—, así que sirven de ancla para un `ilike`. No alcanzan para
 * afirmar que dos números son el mismo: eso lo decide la comparación
 * normalizada de abajo, sobre las pocas filas que el prefiltro deja pasar.
 */
const DIGITOS_DE_ANCLA = 4

/** Cuántas filas se traen del prefiltro antes de comparar en serio. */
const TOPE_CANDIDATOS = 20

/**
 * El lead que ya tiene este teléfono, o null.
 *
 * La comparación es sobre el número normalizado y no sobre el texto guardado:
 * "223 456-7890" y "2234567890" son el mismo teléfono y hay que detectarlos
 * como tal, que es justo lo que un `ilike` sobre la columna no hace.
 *
 * La RLS ya acota a la inmobiliaria de quien pregunta, así que no hace falta
 * filtrar por ella acá.
 *
 * Es un aviso, no un candado: si el prefiltro no llega a traer la fila
 * duplicada —muchos leads terminando en los mismos cuatro dígitos—, el alta
 * sigue adelante. Prefiere no avisar antes que trabar una carga legítima.
 */
export async function buscarLeadPorTelefono(
  telefono: string,
): Promise<LeadResumido | null> {
  const buscado = normalizarTelefonoAR(telefono)
  if (!buscado) return null

  const ancla = soloDigitos(telefono).slice(-DIGITOS_DE_ANCLA)
  if (ancla.length < DIGITOS_DE_ANCLA) return null

  const { data, error } = await supabase
    .from('leads')
    .select('id, nombre, apellido, telefono')
    .ilike('telefono', `%${ancla}%`)
    .limit(TOPE_CANDIDATOS)

  // Un fallo acá no puede frenar el alta: se sigue sin avisar.
  if (error) {
    console.error('No se pudo chequear si el teléfono ya existe', error)
    return null
  }

  return (data ?? []).find((l) => normalizarTelefonoAR(l.telefono ?? '') === buscado) ?? null
}

/** Un lead puntual, para mostrar el seleccionado del combobox. */
export async function obtenerLeadResumido(id: string): Promise<LeadResumido | null> {
  const { data, error } = await supabase
    .from('leads')
    .select('id, nombre, apellido, telefono')
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(`No se pudo cargar el lead: ${error.message}`)
  return data
}

// ---------------------------------------------------------------------------
// Export a Excel
// ---------------------------------------------------------------------------

/** Las columnas que se exportan. Más que las que entran en la tabla. */
const COLUMNAS_EXPORT =
  'nombre, apellido, telefono, email, estado, origen, fecha_ingreso, fecha_primer_contacto_real, fecha_ultimo_contacto_real, fecha_proximo_seguimiento, descripcion_inicial'

export type LeadExportable = Pick<
  Lead,
  | 'nombre'
  | 'apellido'
  | 'telefono'
  | 'email'
  | 'estado'
  | 'origen'
  | 'fecha_ingreso'
  | 'fecha_primer_contacto_real'
  | 'fecha_ultimo_contacto_real'
  | 'fecha_proximo_seguimiento'
  | 'descripcion_inicial'
>

/** Filas por viaje. PostgREST tiene su propio techo; esto se queda debajo. */
const TAMANO_LOTE = 1000

export interface ExportarLeadsParams {
  estado?: FiltroEstado
  busqueda?: string
}

/**
 * Todos los leads que matchean el filtro, sin paginar.
 *
 * Mismos filtros y mismo orden que `listarLeads`, así el Excel sale en el
 * orden que el usuario ve en pantalla; lo único que cambia es que no se
 * recorta a una página.
 *
 * Se pide de a lotes en vez de un solo query sin `.range()`: PostgREST aplica
 * un máximo de filas propio y, si la cartera lo supera, un query pelado
 * devolvería un archivo recortado sin avisar. El loop corta cuando un lote
 * vuelve incompleto, que es la señal de que no queda nada más.
 */
export async function listarLeadsParaExportar({
  estado,
  busqueda,
}: ExportarLeadsParams): Promise<LeadExportable[]> {
  const todos: LeadExportable[] = []

  for (let desde = 0; ; desde += TAMANO_LOTE) {
    const query = aplicarFiltros(
      supabase.from('leads').select(COLUMNAS_EXPORT),
      estado,
      busqueda,
    )
      .order('fecha_proximo_seguimiento', { ascending: true, nullsFirst: false })
      .order('fecha_primer_contacto_real', { ascending: true, nullsFirst: true })
      .order('estado', { ascending: true, nullsFirst: true })
      .order('fecha_ultimo_contacto_real', { ascending: true, nullsFirst: true })
      .order('fecha_ingreso', { ascending: true })
      .range(desde, desde + TAMANO_LOTE - 1)

    const { data, error } = await query
    if (error) throw new Error(`No se pudieron exportar los leads: ${error.message}`)

    const lote = (data ?? []) as LeadExportable[]
    todos.push(...lote)
    if (lote.length < TAMANO_LOTE) break
  }

  return todos
}
