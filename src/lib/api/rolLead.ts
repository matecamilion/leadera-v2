import { supabase } from '../supabase'
import { interpretarErrorSupabase } from '../errores'

/**
 * Qué hace un lead con la inmobiliaria: busca, ofrece o las dos cosas.
 *
 * No es un campo: se infiere de lo que ya está cargado, así que nadie tiene que
 * mantenerlo. Son cuatro señales independientes, que pueden darse juntas:
 *
 *  - `vende`: figura como `lead_propietario_id` de alguna propiedad, o es el
 *    dueño en una operación de VENTA. VENTA no alcanza sola, porque durante un
 *    tiempo el formulario no decía de qué lado iba el lead; se cruza contra el
 *    dueño de la propiedad (ver `rolEnVenta`).
 *  - `compra`: tiene una búsqueda de compra (o sin tipo), o es quien compra en
 *    una VENTA ajena.
 *  - `inquilino`: tiene una búsqueda de alquiler o una operación
 *    BUSQUEDA_ALQUILER.
 *  - `duenoAlquila`: es el lead de una operación de ALQUILER (el propietario
 *    que ofrece, ver `llevaCriteriosDeBusqueda` en operaciones.ts).
 *
 * Sin ninguna señal no hay rol: `null`.
 */
export interface RolLead {
  compra: boolean
  inquilino: boolean
  vende: boolean
  duenoAlquila: boolean
}

/**
 * Los valores de `?rol=` del listado. Un lead puede entrar en más de un corte
 * (quien compra y además busca alquilar, o el dueño de un alquiler que también
 * es propietario de una propiedad en venta).
 */
export type FiltroRol = 'compradores' | 'alquileres' | 'vendedores'

export const FILTROS_ROL: FiltroRol[] = ['compradores', 'alquileres', 'vendedores']

/** Cómo se nombra cada corte en pantalla. El valor de arriba es sólo para la URL. */
const ETIQUETA_FILTRO_ROL: Record<FiltroRol, string> = {
  compradores: 'Compradores',
  alquileres: 'Alquileres',
  vendedores: 'Vendedores',
}

export function etiquetaFiltroRol(filtro: FiltroRol): string {
  return ETIQUETA_FILTRO_ROL[filtro]
}

/**
 * Cómo se nombra el rol en pantalla. Quien tiene más de una señal lleva más de
 * una etiqueta, separadas por " · ".
 *
 * Los pares compra+venta y compra+alquiler tienen nombre propio. Un propietario
 * que sólo busca alquilar sigue siendo "Vendedor", salvo que además sea dueño
 * de un alquiler: ahí las dos etiquetas dicen de qué lado está cada cosa.
 */
export function etiquetaRol(rol: RolLead): string {
  const etiquetas: string[] = []

  if (rol.vende) etiquetas.push(rol.compra ? 'Compra y vende' : 'Vendedor')
  else if (rol.compra) etiquetas.push(rol.inquilino ? 'Compra o alquila' : 'Comprador')
  else if (rol.inquilino) etiquetas.push('Inquilino')

  if (rol.duenoAlquila) {
    const yaDiceInquilino = !rol.vende && rol.inquilino
    if (rol.inquilino && !yaDiceInquilino) etiquetas.push('Inquilino')
    etiquetas.push('Dueño que alquila')
  }

  return etiquetas.join(' · ')
}

/**
 * Qué dice una operación de VENTA sobre su lead.
 *
 * Si el lead es el dueño de la propiedad, confirma que vende. Si la propiedad
 * tiene otro dueño, el lead es quien le compra. Sin propiedad o con una
 * propiedad sin dueño no se puede saber, y no se adivina.
 */
function rolEnVenta(leadId: string, propietarioId: string | null | undefined): 'COMPRADOR' | 'VENDEDOR' | null {
  if (!propietarioId) return null
  return propietarioId === leadId ? 'VENDEDOR' : 'COMPRADOR'
}

/**
 * Rol de cada lead de la lista. Los que no tienen señal no vuelven en el Map.
 *
 * Mismo patrón que `contarOperacionesPorLead`: se traen sólo las columnas que
 * hacen falta de los leads visibles y se agrupa en JS. Son tres consultas en
 * paralelo acotadas a una página de leads.
 */
export async function clasificarLeads(leadIds: string[]): Promise<Map<string, RolLead>> {
  const resultado = new Map<string, RolLead>()
  if (leadIds.length === 0) return resultado

  const [busquedas, propiedades, operaciones] = await Promise.all([
    supabase.from('busquedas').select('lead_id, tipo_operacion').in('lead_id', leadIds),
    supabase
      .from('propiedades')
      .select('lead_propietario_id')
      .in('lead_propietario_id', leadIds),
    supabase
      .from('operaciones')
      .select('lead_id, tipo, propiedad:propiedades(lead_propietario_id)')
      .in('lead_id', leadIds)
      .in('tipo', ['ALQUILER', 'VENTA', 'BUSQUEDA_ALQUILER']),
  ])

  const error = busquedas.error ?? propiedades.error ?? operaciones.error
  if (error) throw new Error(interpretarErrorSupabase(error, 'No se pudo calcular el rol de los leads.'))

  const compran = new Set<string>()
  const alquilan = new Set<string>()
  const venden = new Set<string>()
  const duenos = new Set<string>()

  for (const fila of busquedas.data ?? []) {
    const lado = fila.tipo_operacion === 'ALQUILER' ? alquilan : compran
    lado.add(fila.lead_id)
  }
  for (const fila of propiedades.data ?? []) {
    if (fila.lead_propietario_id) venden.add(fila.lead_propietario_id)
  }
  for (const fila of operaciones.data ?? []) {
    if (!fila.lead_id) continue
    if (fila.tipo === 'ALQUILER') {
      duenos.add(fila.lead_id)
      continue
    }
    if (fila.tipo === 'BUSQUEDA_ALQUILER') {
      alquilan.add(fila.lead_id)
      continue
    }
    const rol = rolEnVenta(fila.lead_id, fila.propiedad?.lead_propietario_id)
    if (rol === 'VENDEDOR') venden.add(fila.lead_id)
    if (rol === 'COMPRADOR') compran.add(fila.lead_id)
  }

  for (const id of leadIds) {
    const rol: RolLead = {
      compra: compran.has(id),
      inquilino: alquilan.has(id),
      vende: venden.has(id),
      duenoAlquila: duenos.has(id),
    }
    if (rol.compra || rol.inquilino || rol.vende || rol.duenoAlquila) resultado.set(id, rol)
  }
  return resultado
}

// ---------------------------------------------------------------------------
// Filtro del listado
// ---------------------------------------------------------------------------

/** Un `FiltroRol` con lo que hace falta para aplicarlo, ya resuelto. */
export interface CorteDeRol {
  filtro: FiltroRol
  /** Sólo para `compradores`: los que compran en una VENTA ajena. Vacío en los demás. */
  compradoresEnVentas: string[]
  /** Sólo para `alquileres`: los leads de los dos lados del alquiler. Vacío en los demás. */
  enAlquileres: string[]
}

/** UUID nulo: no existe como lead, sirve para un `in` que no debe devolver nada. */
const ID_NINGUNO = '00000000-0000-0000-0000-000000000000'

/** Filas por viaje al juntar ids. PostgREST corta en silencio en su propio máximo. */
const LOTE_DE_IDS = 1000

/** Pide todas las filas de un query de lectura, de a lotes. */
async function leerTodas<T>(
  pagina: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const todas: T[] = []
  for (let desde = 0; ; desde += LOTE_DE_IDS) {
    const { data, error } = await pagina(desde, desde + LOTE_DE_IDS - 1)
    if (error) throw new Error(interpretarErrorSupabase(error, 'No se pudieron cargar los leads.'))
    todas.push(...(data ?? []))
    if ((data?.length ?? 0) < LOTE_DE_IDS) return todas
  }
}

/**
 * Los leads de los dos lados del alquiler: quien tiene una búsqueda de alquiler
 * o una operación BUSQUEDA_ALQUILER (inquilino) y quien tiene una operación
 * ALQUILER (dueño que alquila). Mismas señales que `clasificarLeads`.
 */
async function leadsEnAlquileres(): Promise<string[]> {
  const [busquedas, operaciones] = await Promise.all([
    leerTodas((desde, hasta) =>
      supabase
        .from('busquedas')
        .select('lead_id')
        .eq('tipo_operacion', 'ALQUILER')
        .order('id')
        .range(desde, hasta),
    ),
    leerTodas((desde, hasta) =>
      supabase
        .from('operaciones')
        .select('lead_id')
        .in('tipo', ['ALQUILER', 'BUSQUEDA_ALQUILER'])
        .not('lead_id', 'is', null)
        .order('id')
        .range(desde, hasta),
    ),
  ])

  const ids = new Set<string>()
  for (const fila of [...busquedas, ...operaciones]) {
    if (fila.lead_id) ids.add(fila.lead_id)
  }
  return [...ids]
}

/**
 * Resuelve lo asíncrono de un `FiltroRol` antes de armar el query.
 *
 * Casi todo el filtro se resuelve en el server con relaciones embebidas (ver
 * `aplicarFiltroRol`). Hay dos cosas que PostgREST no expresa bien y se piden
 * antes, como ids:
 *
 *  - compradores: comparar dos columnas —el lead de la VENTA contra el dueño
 *    de su propiedad—. Son las ventas con propiedad y lead: un puñado.
 *  - alquileres: la unión de tres señales en tres tablas. Un `or` sobre
 *    relaciones embebidas con filtros propios no se comporta de forma fiable.
 */
export async function resolverCorteDeRol(filtro: FiltroRol | undefined): Promise<CorteDeRol | undefined> {
  if (!filtro) return undefined
  if (filtro === 'vendedores') return { filtro, compradoresEnVentas: [], enAlquileres: [] }
  if (filtro === 'alquileres') {
    return { filtro, compradoresEnVentas: [], enAlquileres: await leadsEnAlquileres() }
  }

  const { data, error } = await supabase
    .from('operaciones')
    .select('lead_id, propiedad:propiedades(lead_propietario_id)')
    .eq('tipo', 'VENTA')
    .not('lead_id', 'is', null)
    .not('propiedad_id', 'is', null)

  if (error) throw new Error(interpretarErrorSupabase(error, 'No se pudieron cargar los leads.'))

  const compradores = new Set<string>()
  for (const fila of data ?? []) {
    if (fila.lead_id && rolEnVenta(fila.lead_id, fila.propiedad?.lead_propietario_id) === 'COMPRADOR') {
      compradores.add(fila.lead_id)
    }
  }
  return { filtro, compradoresEnVentas: [...compradores], enAlquileres: [] }
}

/**
 * Las relaciones que el filtro necesita embebidas en el `select` del listado.
 * Alquileres no necesita ninguna: filtra por ids.
 *
 * PostgREST sólo deja filtrar por "tiene alguna fila relacionada" si la
 * relación está en el select. Se piden con `id` y nada más: el listado no las
 * usa, están sólo para que el `not.is.null` de `aplicarFiltroRol` tenga contra
 * qué evaluar.
 */
export function embebidosDeRol(corte: CorteDeRol | undefined): string {
  if (!corte) return ''
  switch (corte.filtro) {
    case 'compradores':
      return ', busquedas(id)'
    case 'alquileres':
      return ''
    case 'vendedores':
      return ', propiedades(id), operaciones(id)'
  }
}

/** Lo que `aplicarFiltroRol` le pide al query, estructuralmente. */
export interface QueryConRol<Self> {
  or(filtro: string, opciones?: { referencedTable: 'busquedas' }): Self
  // `filter` y no `eq`: el `eq` del listado ya está tipado para `estado`, y
  // dos firmas distintas del mismo método no se pueden pedir a la vez.
  filter(columna: 'operaciones.tipo', operador: 'eq', valor: 'ALQUILER'): Self
}

/**
 * Las mismas reglas que `clasificarLeads`, del lado del server.
 *
 * `relacion.not.is.null` dentro de un `or` es "tiene al menos una fila
 * relacionada que pase los filtros de esa relación". Esos filtros recortan el
 * embebido antes de la pregunta:
 *
 *  - vendedores: `operaciones.tipo` deja sólo los alquileres; las propiedades
 *    cuentan todas porque la relación ya es la del dueño. Las VENTA donde el
 *    lead es el dueño no hace falta sumarlas: ya entra por sus propiedades.
 *  - alquileres: los ids de `leadsEnAlquileres` (búsqueda de alquiler, u
 *    operación BUSQUEDA_ALQUILER o ALQUILER), sin relaciones embebidas.
 *  - compradores: las búsquedas que no son de alquiler (`tipo_operacion` nulo
 *    o COMPRA), más quien compra en una VENTA ajena.
 */
export function aplicarFiltroRol<Q extends QueryConRol<Q>>(query: Q, corte: CorteDeRol | undefined): Q {
  if (!corte) return query

  if (corte.filtro === 'vendedores') {
    return query
      .filter('operaciones.tipo', 'eq', 'ALQUILER')
      .or('propiedades.not.is.null,operaciones.not.is.null')
  }

  if (corte.filtro === 'alquileres') {
    // `in.()` vacío no es válido: sin nadie en alquileres se pide un id que no
    // existe, y el listado queda vacío con count 0.
    const ids = corte.enAlquileres.length > 0 ? corte.enAlquileres.join(',') : ID_NINGUNO
    return query.or(`id.in.(${ids})`)
  }

  // `in.()` vacío no es un filtro válido: sin compradores por venta queda sólo
  // la condición de las búsquedas.
  const ventas = corte.compradoresEnVentas
  return query
    .or('tipo_operacion.is.null,tipo_operacion.neq.ALQUILER', { referencedTable: 'busquedas' })
    .or(
      ventas.length > 0
        ? `busquedas.not.is.null,id.in.(${ventas.join(',')})`
        : 'busquedas.not.is.null',
    )
}
