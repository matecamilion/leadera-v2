import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import type { Database } from '../../types/database'

export type Propiedad = Database['public']['Tables']['propiedades']['Row']
export type EstadoPropiedad = Database['public']['Enums']['estado_propiedad']
export type TipoPropiedad = Database['public']['Enums']['tipo_propiedad']
export type Disposicion = Database['public']['Enums']['disposicion_propiedad']

/**
 * El tipo de la operación que puede nacer junto con una propiedad.
 *
 * Se declara desde el enum y no importando de `operaciones.ts` para no cruzar
 * los dos módulos de API por un alias. En la práctica el alta sólo ofrece VENTA
 * y ALQUILER; quien decide qué es válido es el RPC.
 */
export type TipoOperacionDePropiedad = Database['public']['Enums']['tipo_operacion']

/** Propiedad con el propietario resuelto por el join. */
export interface PropiedadConPropietario extends Propiedad {
  lead_propietario: {
    id: string
    nombre: string
    apellido: string | null
  } | null
}

export const ESTADOS_PROPIEDAD: { valor: EstadoPropiedad; label: string }[] = [
  { valor: 'DISPONIBLE', label: 'Disponible' },
  { valor: 'RESERVADA', label: 'Reservada' },
  { valor: 'VENDIDA', label: 'Vendida' },
  { valor: 'ALQUILADA', label: 'Alquilada' },
  { valor: 'PAUSADA', label: 'Pausada' },
]

/**
 * Qué tipos admiten disposición y expensas.
 *
 * Los dos campos sólo tienen sentido en una unidad dentro de un edificio: una
 * casa no da al frente ni al contrafrente de nada, y un terreno no paga
 * expensas. Los formularios los esconden —y limpian su valor— cuando el tipo
 * elegido no está en la lista.
 *
 * Viven acá y no en cada formulario porque los usan el alta y la edición: si
 * mañana un galpón pasa a tener disposición, se cambia en un solo lugar.
 */
export const TIPOS_CON_DISPOSICION: readonly TipoPropiedad[] = [
  'DEPARTAMENTO',
  'OFICINA',
  'PH',
]

export const TIPOS_CON_EXPENSAS: readonly TipoPropiedad[] = [
  'DEPARTAMENTO',
  'OFICINA',
  'LOCAL_COMERCIAL',
  'GALPON',
]

export function admiteDisposicion(tipo: TipoPropiedad): boolean {
  return TIPOS_CON_DISPOSICION.includes(tipo)
}

export function admiteExpensas(tipo: TipoPropiedad): boolean {
  return TIPOS_CON_EXPENSAS.includes(tipo)
}

/** Opciones del selector. El vacío ("No especifica") se maneja como null. */
export const DISPOSICIONES: { valor: Disposicion; label: string }[] = [
  { valor: 'FRENTE', label: 'Frente' },
  { valor: 'CONTRAFRENTE', label: 'Contrafrente' },
  { valor: 'INTERNO', label: 'Interno' },
]

export const TIPOS_PROPIEDAD: { valor: TipoPropiedad; label: string }[] = [
  { valor: 'CASA', label: 'Casa' },
  { valor: 'DEPARTAMENTO', label: 'Departamento' },
  { valor: 'PH', label: 'PH' },
  { valor: 'TERRENO', label: 'Terreno' },
  { valor: 'LOCAL_COMERCIAL', label: 'Local comercial' },
  { valor: 'GALPON', label: 'Galpón' },
  { valor: 'OFICINA', label: 'Oficina' },
  { valor: 'OTRO', label: 'Otro' },
]

export function etiquetaTipo(tipo: TipoPropiedad | null): string {
  if (!tipo) return '—'
  return TIPOS_PROPIEDAD.find((t) => t.valor === tipo)?.label ?? tipo
}

export function etiquetaDisposicion(disposicion: Disposicion | null): string {
  return DISPOSICIONES.find((d) => d.valor === disposicion)?.label ?? '—'
}

export function etiquetaEstado(estado: EstadoPropiedad): string {
  return ESTADOS_PROPIEDAD.find((e) => e.valor === estado)?.label ?? estado
}

const MONTOS = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 })

/**
 * Expensas: el número solo, sin moneda.
 *
 * La columna `moneda` es la del precio —normalmente USD— y las expensas casi
 * nunca van en la misma. Hasta que haya una moneda propia para el gasto, poner
 * cualquiera de las dos sería inventar el dato.
 */
export function formatearExpensas(expensas: number | null): string {
  return expensas == null ? '—' : MONTOS.format(expensas)
}

export function formatearPrecio(precio: number | null, moneda: string): string {
  if (precio == null) return '—'
  return `${moneda} ${MONTOS.format(precio)}`
}

// ---------------------------------------------------------------------------
// Listado
// ---------------------------------------------------------------------------

/**
 * Lo que acota el listado. Todo opcional: sin nada, trae la cartera entera.
 *
 * Se combinan con AND entre sí. `precioMin`/`precioMax` acotan el mismo campo
 * por los dos lados y se pueden usar sueltos.
 */
export interface FiltrosPropiedad {
  estado?: EstadoPropiedad
  busqueda?: string
  tipo?: TipoPropiedad
  precioMin?: number
  precioMax?: number
  ambientesMin?: number
}

export interface ListarPropiedadesParams extends FiltrosPropiedad {
  /** 1-indexado. */
  page: number
  pageSize: number
}

export interface ListarPropiedadesResult {
  data: PropiedadConPropietario[]
  count: number
}

/** PostgREST usa la coma como separador en `.or()`: hay que neutralizarla. */
function sanearBusqueda(texto: string): string {
  return texto.replace(/[,()\\]/g, ' ').trim()
}

/**
 * Listado paginado. RLS filtra por inmobiliaria en el server, así que acá no
 * repetimos ese filtro.
 */
export async function listarPropiedades({
  estado,
  busqueda,
  tipo,
  precioMin,
  precioMax,
  ambientesMin,
  page,
  pageSize,
}: ListarPropiedadesParams): Promise<ListarPropiedadesResult> {
  const desde = (page - 1) * pageSize
  const hasta = desde + pageSize - 1

  let query = supabase
    .from('propiedades')
    .select('*, lead_propietario:leads(id, nombre, apellido)', { count: 'exact' })

  if (estado) query = query.eq('estado', estado)
  if (tipo) query = query.eq('tipo', tipo)

  // Los rangos se encadenan sueltos: cada uno acota si vino, y los dos juntos
  // arman el intervalo. Una propiedad sin precio o sin ambientes cargados queda
  // afuera en cuanto el filtro se usa —`gte`/`lte` no matchean NULL—, que es lo
  // esperable: quien filtra por precio no está buscando las que no lo tienen.
  if (precioMin !== undefined) query = query.gte('precio', precioMin)
  if (precioMax !== undefined) query = query.lte('precio', precioMax)
  if (ambientesMin !== undefined) query = query.gte('ambientes', ambientesMin)

  const texto = busqueda ? sanearBusqueda(busqueda) : ''
  if (texto) {
    const patron = `%${texto}%`
    query = query.or(`direccion.ilike.${patron},zona.ilike.${patron}`)
  }

  const { data, error, count } = await query
    // El enum estado_propiedad está declarado DISPONIBLE, RESERVADA, VENDIDA,
    // ALQUILADA, PAUSADA y Postgres ordena los enums por orden de declaración:
    // esto ya pone las disponibles arriba sin necesidad de un CASE.
    .order('estado', { ascending: true })
    .order('created_at', { ascending: false })
    .range(desde, hasta)

  if (error) {
    throw new Error(`No se pudieron cargar las propiedades: ${error.message}`)
  }

  return {
    data: (data ?? []) as unknown as PropiedadConPropietario[],
    count: count ?? 0,
  }
}

/**
 * Propiedades de las que un lead es propietario, para la tab de su ficha.
 *
 * Sin paginar: un lead tiene un puñado de propiedades, no un catálogo. Trae el
 * join del propietario aunque la tab no lo muestre —ahí sería repetir el nombre
 * del lead en cada card— para devolver el mismo tipo que el listado y poder
 * reusar sus cards sin adaptadores.
 */
/**
 * Las últimas propiedades cargadas, para el resumen de Mi día.
 *
 * Función aparte y no `listarPropiedades` con `pageSize: 3`: aquel ordena por
 * `estado` antes que por fecha —para dejar las disponibles arriba—, así que sus
 * tres primeras filas son las tres disponibles más nuevas y no las tres más
 * nuevas. Una propiedad cargada hoy como RESERVADA no aparecería nunca.
 *
 * Trae el `count` exacto de la cartera entera: el resumen necesita saber si hay
 * más de las que muestra para ofrecer el "Ver todas". PostgREST lo devuelve
 * sobre el total, antes del `limit`.
 */
export async function listarPropiedadesRecientes(
  limit: number,
): Promise<ListarPropiedadesResult> {
  const { data, error, count } = await supabase
    .from('propiedades')
    .select('*, lead_propietario:leads(id, nombre, apellido)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(
      `No se pudieron cargar las propiedades recientes: ${error.message}`,
    )
  }

  return {
    data: (data ?? []) as unknown as PropiedadConPropietario[],
    count: count ?? 0,
  }
}

export async function listarPropiedadesPorLead(
  leadId: string,
): Promise<PropiedadConPropietario[]> {
  const { data, error } = await supabase
    .from('propiedades')
    .select('*, lead_propietario:leads(id, nombre, apellido)')
    .eq('lead_propietario_id', leadId)
    // Mismo orden que el listado: disponibles arriba por el orden del enum.
    .order('estado', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`No se pudieron cargar las propiedades del lead: ${error.message}`)
  }
  return (data ?? []) as unknown as PropiedadConPropietario[]
}

// ---------------------------------------------------------------------------
// Alta
// ---------------------------------------------------------------------------

export interface CrearPropiedadInput {
  direccion: string
  tipo: TipoPropiedad
  /** Opcional: una propiedad puede cargarse sin propietario asignado. */
  lead_propietario_id?: string | null
  zona?: string
  precio?: number | null
  moneda?: string
  ambientes?: number | null
  metros_cuadrados?: number | null
  metros_cubiertos?: number | null
  banos?: number | null
  cocheras?: number | null
  disposicion?: Disposicion | null
  expensas?: number | null
  descripcion?: string
  link_portal?: string
}

export async function crearPropiedad(
  input: CrearPropiedadInput,
): Promise<Propiedad> {
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
    .from('propiedades')
    .insert({
      inmobiliaria_id: perfil.inmobiliaria_id,
      agente_id: perfil.id,
      lead_propietario_id: input.lead_propietario_id || null,
      direccion: input.direccion.trim(),
      tipo: input.tipo,
      zona: input.zona?.trim() || null,
      precio: input.precio ?? null,
      ...(input.moneda ? { moneda: input.moneda } : {}),
      ambientes: input.ambientes ?? null,
      metros_cuadrados: input.metros_cuadrados ?? null,
      metros_cubiertos: input.metros_cubiertos ?? null,
      banos: input.banos ?? null,
      cocheras: input.cocheras ?? null,
      disposicion: input.disposicion ?? null,
      expensas: input.expensas ?? null,
      descripcion: input.descripcion?.trim() || null,
      link_portal: input.link_portal?.trim() || null,
      // `estado` no se manda: la base la crea DISPONIBLE por default.
      // Las fotos llegan en 4b-ii.
    })
    .select('*')
    .single()

  if (error) throw new Error(`No se pudo crear la propiedad: ${error.message}`)
  return data
}

/** Lo que devuelve el alta transaccional. */
export interface PropiedadConOperacionCreada {
  propiedad_id: string
  /** null cuando no se pidió operación. */
  operacion_id: string | null
}

/**
 * Alta de propiedad y, opcionalmente, de su operación, en una sola transacción.
 *
 * Reemplaza al par `crearPropiedad` + `crearOperacion`, que eran dos escrituras
 * sin transacción: si la segunda fallaba, la propiedad ya existía y el
 * formulario tenía que acordarse de su id para no duplicarla al reintentar. Con
 * el RPC las dos entran juntas o no entra ninguna, así que un fallo no deja
 * nada a medias y reintentar es volver a mandar el formulario entero.
 *
 * El `titulo` y el `monto` de la operación no viajan desde acá: los arma el RPC
 * a partir de la dirección y del precio de la propiedad, que es lo mismo que
 * hacía el formulario. `inmobiliaria_id` y `agente_id` tampoco: los deriva de
 * `auth.uid()`, que es lo que hace que no se puedan falsear desde el cliente.
 */
export async function crearPropiedadConOperacion(
  input: CrearPropiedadInput,
  /** El tipo de operación a crear junto a la propiedad, o null para ninguna. */
  tipoOperacion: TipoOperacionDePropiedad | null,
): Promise<PropiedadConOperacionCreada> {
  // El RPC todavía no está en `src/types/database.ts`; los tipos se regeneran
  // con `npx supabase gen types`. Hasta entonces la llamada va por el cliente
  // sin tipar, con la forma declarada arriba.
  const { data, error } = await (supabase as SupabaseClient).rpc(
    'crear_propiedad_con_operacion',
    {
      p_propiedad: {
        // Las mismas normalizaciones que hacía el insert directo: lo que el
        // formulario deja vacío entra como null y no como cadena vacía.
        direccion: input.direccion.trim(),
        tipo: input.tipo,
        lead_propietario_id: input.lead_propietario_id || null,
        zona: input.zona?.trim() || null,
        precio: input.precio ?? null,
        moneda: input.moneda || null,
        ambientes: input.ambientes ?? null,
        metros_cuadrados: input.metros_cuadrados ?? null,
        metros_cubiertos: input.metros_cubiertos ?? null,
        banos: input.banos ?? null,
        cocheras: input.cocheras ?? null,
        disposicion: input.disposicion ?? null,
        expensas: input.expensas ?? null,
        descripcion: input.descripcion?.trim() || null,
        link_portal: input.link_portal?.trim() || null,
      },
      p_crear_operacion: tipoOperacion !== null,
      p_tipo_operacion: tipoOperacion,
    },
  )

  if (error) throw new Error(`No se pudo crear la propiedad: ${error.message}`)

  // Un RPC que declara `RETURNS TABLE` devuelve un array de una fila; uno que
  // devuelve un compuesto o jsonb, el objeto pelado. Se aceptan las dos formas
  // para no depender de cuál se eligió del lado de la base.
  const fila = (Array.isArray(data) ? data[0] : data) as
    | PropiedadConOperacionCreada
    | undefined

  if (!fila?.propiedad_id) {
    throw new Error('El alta no devolvió la propiedad creada.')
  }

  return { propiedad_id: fila.propiedad_id, operacion_id: fila.operacion_id ?? null }
}

// ---------------------------------------------------------------------------
// Fase 4b-ii — detalle
// ---------------------------------------------------------------------------

export type LeadPropietario = Database['public']['Tables']['leads']['Row']

export interface PropiedadDetalle extends Propiedad {
  lead_propietario: LeadPropietario | null
}

/**
 * Una propiedad por id. Devuelve null si no existe o si RLS la tapa: para el
 * usuario los dos casos son lo mismo, y distinguirlos filtraría información.
 */
export async function obtenerPropiedadPorId(
  id: string,
): Promise<PropiedadDetalle | null> {
  const { data, error } = await supabase
    .from('propiedades')
    .select('*, lead_propietario:leads(*)')
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(`No se pudo cargar la propiedad: ${error.message}`)
  return data as unknown as PropiedadDetalle | null
}

export async function actualizarEstadoPropiedad(
  id: string,
  estado: EstadoPropiedad,
): Promise<Propiedad> {
  const { data, error } = await supabase
    .from('propiedades')
    .update({ estado })
    .eq('id', id)
    .select('*')
    .maybeSingle()

  if (error) throw new Error(`No se pudo actualizar el estado: ${error.message}`)
  if (!data) throw new Error('No tenés permiso para editar esta propiedad.')
  return data
}

export type CamposEditables = Partial<
  Pick<
    Propiedad,
    | 'direccion'
    | 'tipo'
    | 'zona'
    | 'precio'
    | 'moneda'
    | 'ambientes'
    | 'metros_cuadrados'
    | 'metros_cubiertos'
    | 'banos'
    | 'cocheras'
    | 'disposicion'
    | 'expensas'
    | 'descripcion'
    | 'link_portal'
    | 'lead_propietario_id'
  >
>

export async function actualizarPropiedad(
  id: string,
  campos: CamposEditables,
): Promise<Propiedad> {
  const { data, error } = await supabase
    .from('propiedades')
    .update(campos)
    .eq('id', id)
    .select('*')
    .maybeSingle()

  if (error) throw new Error(`No se pudo guardar la propiedad: ${error.message}`)
  if (!data) throw new Error('No tenés permiso para editar esta propiedad.')
  return data
}

export async function eliminarPropiedad(id: string): Promise<void> {
  // Pedimos de vuelta la fila borrada: un DELETE que RLS filtra no es un error
  // para PostgREST (responde 200 con lista vacía) y se vería como exitoso.
  const { data, error } = await supabase
    .from('propiedades')
    .delete()
    .eq('id', id)
    .select('id')

  if (error) throw new Error(`No se pudo eliminar la propiedad: ${error.message}`)
  if (!data || data.length === 0) {
    throw new Error('No tenés permiso para eliminar esta propiedad.')
  }
}

// ---------------------------------------------------------------------------
// Coincidencias internas
// ---------------------------------------------------------------------------

export interface CoincidenciaInterna {
  busquedaId: string
  leadId: string
  nombre: string
  apellido: string | null
  estadoLead: Database['public']['Enums']['estado_lead'] | null
  tipoBuscado: TipoPropiedad | null
  zona: string | null
  precioMin: number | null
  precioMax: number | null
  ambientesMin: number | null
}

/**
 * Búsquedas activas compatibles con una propiedad.
 *
 * SIEMPRE acotado a la inmobiliaria de la propiedad. No es matching entre
 * agencias: eso es otra cosa, necesita un modelo de opt-in y todavía no
 * existe. Si esto se refactoriza, el filtro por inmobiliaria_id tiene que
 * seguir estando — sacarlo expondría leads de terceros.
 *
 * Criterio de match:
 *  - la búsqueda está activa
 *  - su tipo_propiedad coincide, o es null (= le sirve cualquier tipo)
 *  - el precio de la propiedad entra en [precio_min, precio_max]; los
 *    extremos vacíos se tratan como "sin límite"
 */
export async function buscarCoincidenciasInternas(
  propiedadId: string,
): Promise<CoincidenciaInterna[]> {
  const { data: propiedad, error: errorProp } = await supabase
    .from('propiedades')
    .select('inmobiliaria_id, tipo, precio')
    .eq('id', propiedadId)
    .maybeSingle()

  if (errorProp) throw new Error(`No se pudo leer la propiedad: ${errorProp.message}`)
  if (!propiedad) return []

  let query = supabase
    .from('busquedas')
    .select(
      'id, tipo_propiedad, zona, precio_min, precio_max, ambientes_min, lead:leads(id, nombre, apellido, estado)',
    )
    // ↓ el filtro que no se negocia
    .eq('inmobiliaria_id', propiedad.inmobiliaria_id)
    .eq('activa', true)
    .or(`tipo_propiedad.is.null,tipo_propiedad.eq.${propiedad.tipo}`)

  if (propiedad.precio != null) {
    // Cada `.or()` es un parámetro aparte y PostgREST los combina con AND:
    // "(sin mínimo o mínimo <= precio) y (sin máximo o máximo >= precio)".
    query = query
      .or(`precio_min.is.null,precio_min.lte.${propiedad.precio}`)
      .or(`precio_max.is.null,precio_max.gte.${propiedad.precio}`)
  }

  const { data, error } = await query
  if (error) {
    throw new Error(`No se pudieron buscar coincidencias: ${error.message}`)
  }

  type Fila = {
    id: string
    tipo_propiedad: TipoPropiedad | null
    zona: string | null
    precio_min: number | null
    precio_max: number | null
    ambientes_min: number | null
    lead: {
      id: string
      nombre: string
      apellido: string | null
      estado: Database['public']['Enums']['estado_lead'] | null
    } | null
  }

  return ((data ?? []) as unknown as Fila[])
    .filter((fila) => fila.lead !== null)
    .map((fila) => ({
      busquedaId: fila.id,
      leadId: fila.lead!.id,
      nombre: fila.lead!.nombre,
      apellido: fila.lead!.apellido,
      estadoLead: fila.lead!.estado,
      tipoBuscado: fila.tipo_propiedad,
      zona: fila.zona,
      precioMin: fila.precio_min,
      precioMax: fila.precio_max,
      ambientesMin: fila.ambientes_min,
    }))
}
