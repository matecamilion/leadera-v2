import { supabase } from '../supabase'
import { interpretarErrorSupabase } from '../errores'

/**
 * Qué hace un lead con la inmobiliaria: busca, ofrece o las dos cosas.
 *
 * No es un campo: se infiere de lo que ya está cargado, así que nadie tiene que
 * mantenerlo. Las reglas:
 *
 *  - VENDEDOR: figura como `lead_propietario_id` de alguna propiedad, o es el
 *    lead de una operación de ALQUILER (el propietario que ofrece, ver
 *    `llevaCriteriosDeBusqueda` en operaciones.ts).
 *  - COMPRADOR: tiene alguna búsqueda. Da igual si nació de una COMPRA o de una
 *    BUSQUEDA_ALQUILER: en las dos el lead busca, no ofrece.
 *  - VENTA no alcanza sola, porque durante un tiempo el formulario no decía de
 *    qué lado iba el lead. Se cruza contra el dueño de la propiedad; ver
 *    `rolEnVenta`.
 *
 * Quien cumple las dos cosas es AMBOS. Sin ninguna señal no hay rol: `null`.
 */
export type RolLead = 'COMPRADOR' | 'VENDEDOR' | 'AMBOS'

/** Los valores de `?rol=` del listado. AMBOS entra en los dos cortes. */
export type FiltroRol = 'compradores' | 'vendedores'

export const FILTROS_ROL: FiltroRol[] = ['compradores', 'vendedores']

export function etiquetaRol(rol: RolLead): string {
  if (rol === 'COMPRADOR') return 'Comprador'
  if (rol === 'VENDEDOR') return 'Vendedor'
  return 'Compra y vende'
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

function combinar(compra: boolean, vende: boolean): RolLead | null {
  if (compra && vende) return 'AMBOS'
  if (compra) return 'COMPRADOR'
  if (vende) return 'VENDEDOR'
  return null
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
    supabase.from('busquedas').select('lead_id').in('lead_id', leadIds),
    supabase
      .from('propiedades')
      .select('lead_propietario_id')
      .in('lead_propietario_id', leadIds),
    supabase
      .from('operaciones')
      .select('lead_id, tipo, propiedad:propiedades(lead_propietario_id)')
      .in('lead_id', leadIds)
      .in('tipo', ['ALQUILER', 'VENTA']),
  ])

  const error = busquedas.error ?? propiedades.error ?? operaciones.error
  if (error) throw new Error(interpretarErrorSupabase(error, 'No se pudo calcular el rol de los leads.'))

  const compran = new Set<string>()
  const venden = new Set<string>()

  for (const fila of busquedas.data ?? []) compran.add(fila.lead_id)
  for (const fila of propiedades.data ?? []) {
    if (fila.lead_propietario_id) venden.add(fila.lead_propietario_id)
  }
  for (const fila of operaciones.data ?? []) {
    if (!fila.lead_id) continue
    if (fila.tipo === 'ALQUILER') {
      venden.add(fila.lead_id)
      continue
    }
    const rol = rolEnVenta(fila.lead_id, fila.propiedad?.lead_propietario_id)
    if (rol === 'VENDEDOR') venden.add(fila.lead_id)
    if (rol === 'COMPRADOR') compran.add(fila.lead_id)
  }

  for (const id of leadIds) {
    const rol = combinar(compran.has(id), venden.has(id))
    if (rol) resultado.set(id, rol)
  }
  return resultado
}

// ---------------------------------------------------------------------------
// Filtro del listado
// ---------------------------------------------------------------------------

/** Un `FiltroRol` con lo que hace falta para aplicarlo, ya resuelto. */
export interface CorteDeRol {
  filtro: FiltroRol
  /** Sólo para `compradores`: los que compran en una VENTA ajena. */
  compradoresEnVentas: string[]
}

/**
 * Resuelve lo asíncrono de un `FiltroRol` antes de armar el query.
 *
 * Casi todo el filtro se resuelve en el server con relaciones embebidas (ver
 * `aplicarFiltroRol`). Lo único que PostgREST no puede expresar es comparar
 * dos columnas —el lead de la VENTA contra el dueño de su propiedad—, así que
 * esos ids se piden antes. Son las ventas con propiedad y lead: un puñado.
 */
export async function resolverCorteDeRol(filtro: FiltroRol | undefined): Promise<CorteDeRol | undefined> {
  if (!filtro) return undefined
  if (filtro === 'vendedores') return { filtro, compradoresEnVentas: [] }

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
  return { filtro, compradoresEnVentas: [...compradores] }
}

/**
 * Las relaciones que el filtro necesita embebidas en el `select` del listado.
 *
 * PostgREST sólo deja filtrar por "tiene alguna fila relacionada" si la
 * relación está en el select. Se piden con `id` y nada más: el listado no las
 * usa, están sólo para que el `not.is.null` de `aplicarFiltroRol` tenga contra
 * qué evaluar.
 */
export function embebidosDeRol(corte: CorteDeRol | undefined): string {
  if (!corte) return ''
  return corte.filtro === 'compradores'
    ? ', busquedas(id)'
    : ', propiedades(id), operaciones(id)'
}

/** Lo que `aplicarFiltroRol` le pide al query, estructuralmente. */
export interface QueryConRol<Self> {
  or(filtro: string): Self
  // `filter` y no `eq`: el `eq` del listado ya está tipado para `estado`, y
  // dos firmas distintas del mismo método no se pueden pedir a la vez.
  filter(columna: 'operaciones.tipo', operador: 'eq', valor: 'ALQUILER'): Self
}

/**
 * Las mismas reglas que `clasificarLeads`, del lado del server.
 *
 * `relacion.not.is.null` dentro de un `or` es "tiene al menos una fila
 * relacionada que pase los filtros de esa relación". En vendedores, el filtro
 * sobre `operaciones.tipo` recorta el embebido a los alquileres antes de esa
 * pregunta; las propiedades cuentan todas porque la relación ya es la del
 * dueño. Las VENTA donde el lead es el dueño no hace falta sumarlas: ese lead
 * ya entra por sus propiedades.
 */
export function aplicarFiltroRol<Q extends QueryConRol<Q>>(query: Q, corte: CorteDeRol | undefined): Q {
  if (!corte) return query

  if (corte.filtro === 'vendedores') {
    return query
      .filter('operaciones.tipo', 'eq', 'ALQUILER')
      .or('propiedades.not.is.null,operaciones.not.is.null')
  }

  // `in.()` vacío no es un filtro válido: sin compradores por venta queda sólo
  // la condición de las búsquedas.
  const ventas = corte.compradoresEnVentas
  return query.or(
    ventas.length > 0
      ? `busquedas.not.is.null,id.in.(${ventas.join(',')})`
      : 'busquedas.not.is.null',
  )
}
