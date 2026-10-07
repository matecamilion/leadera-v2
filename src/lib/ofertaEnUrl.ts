import type { CriteriosOferta } from './api/busquedas'
import { TIPOS_PROPIEDAD, etiquetaTipo, formatearPrecio, type TipoPropiedad } from './api/propiedades'
import { leerNumeroPositivo } from './parametrosDeUrl'

/**
 * Los criterios de "¿Qué tenés para ofrecer?" en la URL de Coincidencias.
 *
 * Mismo motivo que el resto de los filtros (ver `parametrosDeUrl`): que la
 * búsqueda sobreviva a entrar a una ficha y volver, a un F5, y que se pueda
 * pasar por chat. Todos con prefijo `of_`, para que no se confundan con
 * otros parámetros (`?orden=`, o los de un listado si algún día se combinan).
 */
const PARAM = {
  operacion: 'of_op',
  precio: 'of_precio',
  moneda: 'of_moneda',
  tipo: 'of_tipo',
  zona: 'of_zona',
  ambientes: 'of_amb',
  m2: 'of_m2',
  banos: 'of_banos',
  cocheras: 'of_coch',
  expensas: 'of_exp',
} as const

export const OFERTA_VACIA: CriteriosOferta = {
  tipoOperacion: 'COMPRA',
  precio: null,
  moneda: 'USD',
  tipoPropiedad: null,
  zona: null,
  ambientes: null,
  m2: null,
  banos: null,
  cocheras: null,
  expensas: null,
}

/** Como `leerNumeroPositivo`, pero el 0 vale: "sin cochera" o "sin expensas" son datos. */
function leerDesdeCero(valor: string | null): number | null {
  if (valor === null || valor.trim() === '') return null
  const n = Number(valor)
  return Number.isFinite(n) && n >= 0 ? n : null
}

/**
 * Lee los criterios. Lo que no se entienda se ignora, igual que el resto de los
 * parámetros del listado: una URL tipeada a mano no tiene que romper la página.
 */
export function leerOferta(params: URLSearchParams): CriteriosOferta {
  const operacion = params.get(PARAM.operacion)
  const moneda = params.get(PARAM.moneda)
  const tipo = params.get(PARAM.tipo)
  const zona = params.get(PARAM.zona)?.trim()

  return {
    tipoOperacion: operacion === 'ALQUILER' ? 'ALQUILER' : 'COMPRA',
    precio: leerNumeroPositivo(params.get(PARAM.precio)) ?? null,
    moneda: moneda === 'ARS' ? 'ARS' : 'USD',
    tipoPropiedad: TIPOS_PROPIEDAD.some((t) => t.valor === tipo) ? (tipo as TipoPropiedad) : null,
    zona: zona ? zona : null,
    ambientes: leerNumeroPositivo(params.get(PARAM.ambientes)) ?? null,
    m2: leerNumeroPositivo(params.get(PARAM.m2)) ?? null,
    banos: leerNumeroPositivo(params.get(PARAM.banos)) ?? null,
    cocheras: leerDesdeCero(params.get(PARAM.cocheras)),
    expensas: leerDesdeCero(params.get(PARAM.expensas)),
  }
}

/**
 * Devuelve `params` con los criterios escritos (o borrados, si `criterios` es
 * null). Los valores por defecto no se escriben, salvo la operación cuando hay
 * algo más: así la URL dice qué se buscó.
 */
export function escribirOferta(
  params: URLSearchParams,
  criterios: CriteriosOferta | null,
): URLSearchParams {
  const proximos = new URLSearchParams(params)
  for (const clave of Object.values(PARAM)) proximos.delete(clave)
  if (!criterios) return proximos

  const poner = (clave: string, valor: string | number | null) => {
    if (valor !== null && valor !== '') proximos.set(clave, String(valor))
  }

  poner(PARAM.operacion, criterios.tipoOperacion)
  poner(PARAM.precio, criterios.precio)
  if (criterios.moneda !== 'USD') poner(PARAM.moneda, criterios.moneda)
  poner(PARAM.tipo, criterios.tipoPropiedad)
  poner(PARAM.zona, criterios.zona?.trim() || null)
  poner(PARAM.ambientes, criterios.ambientes)
  poner(PARAM.m2, criterios.m2)
  poner(PARAM.banos, criterios.banos)
  poner(PARAM.cocheras, criterios.cocheras)
  poner(PARAM.expensas, criterios.expensas)
  return proximos
}

/** Cómo se ordenan los resultados. `?orden=reciente`; sin el parámetro, por coincidencia. */
export type OrdenOferta = 'coincidencia' | 'reciente'

export function leerOrden(params: URLSearchParams): OrdenOferta {
  return params.get('orden') === 'reciente' ? 'reciente' : 'coincidencia'
}

export function escribirOrden(params: URLSearchParams, orden: OrdenOferta): URLSearchParams {
  const proximos = new URLSearchParams(params)
  if (orden === 'reciente') proximos.set('orden', 'reciente')
  else proximos.delete('orden')
  return proximos
}

/** Cuántos criterios hay cargados, sin contar operación ni moneda (siempre tienen valor). */
export function contarCriterios(c: CriteriosOferta): number {
  return [c.precio, c.tipoPropiedad, c.zona, c.ambientes, c.m2, c.banos, c.cocheras, c.expensas].filter(
    (v) => v != null && v !== '',
  ).length
}

/** "5+ amb." para el tope de los botones, "3 amb." para el resto. */
export const AMBIENTES_TOPE = 5

/**
 * Lo aplicado, en piezas cortas para mostrar como chips:
 * ["Casa", "Güemes", "USD 250.000", "4 amb.", "80 m²", "2 baños", "Sin cochera", "Expensas hasta 90.000"].
 */
export function resumenDeOferta(c: CriteriosOferta): string[] {
  const piezas: (string | null)[] = [
    c.tipoPropiedad ? etiquetaTipo(c.tipoPropiedad) : null,
    c.zona,
    c.precio != null ? formatearPrecio(c.precio, c.moneda) : null,
    c.ambientes != null
      ? `${c.ambientes}${c.ambientes >= AMBIENTES_TOPE ? '+' : ''} amb.`
      : null,
    c.m2 != null ? `${c.m2} m²` : null,
    c.banos != null ? `${c.banos} ${c.banos === 1 ? 'baño' : 'baños'}` : null,
    c.cocheras != null
      ? c.cocheras === 0
        ? 'Sin cochera'
        : `${c.cocheras} ${c.cocheras === 1 ? 'cochera' : 'cocheras'}`
      : null,
    c.expensas != null ? `Expensas hasta ${c.expensas.toLocaleString('es-AR')}` : null,
  ]
  return piezas.filter((p): p is string => Boolean(p))
}
