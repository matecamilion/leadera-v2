import { supabase } from '../supabase'
import { obtenerPropiedadPorId, type PropiedadDetalle } from './propiedades'
import type { CriteriosBusqueda } from './busquedas'
import type { Database } from '../../types/database'
import { interpretarErrorSupabase } from '../errores'

/**
 * El detalle de una coincidencia: la búsqueda y la propiedad, lado a lado.
 *
 * Vive en su propio módulo y no en `busquedas.ts` porque es una pantalla
 * entera —query, tipos y las reglas de comparación—, y `busquedas.ts` ya
 * carga el CRUD de criterios y el RPC de coincidencias.
 *
 * Las reglas de `compararCriterios` son las de `buscar_coincidencias_busqueda`.
 * Si esa función cambia, este archivo tiene que cambiar con ella: si divergen,
 * la pantalla contradice el score que trajo al usuario hasta acá.
 */

// ---------------------------------------------------------------------------
// Query
// ---------------------------------------------------------------------------

/** El lead detrás de la búsqueda, para poder contactarlo desde el detalle. */
export interface LeadDeBusqueda {
  id: string
  nombre: string
  apellido: string | null
  telefono: string | null
  email: string | null
  estado: Database['public']['Enums']['estado_lead'] | null
}

export interface BusquedaConLead extends CriteriosBusqueda {
  id: string
  lead: LeadDeBusqueda | null
}

export interface DetalleMatch {
  busqueda: BusquedaConLead
  propiedad: PropiedadDetalle
}

/**
 * La búsqueda y la propiedad de una coincidencia.
 *
 * `null` si cualquiera de las dos no está —borrada, o tapada por RLS—: para el
 * usuario los dos casos son el mismo, "esto ya no está vigente", y separarlos
 * filtraría si el id pertenece a otra inmobiliaria. La pantalla muestra ese
 * estado, no un error.
 *
 * Las dos consultas van en paralelo: no dependen una de la otra.
 */
export async function obtenerDetalleMatch(
  busquedaId: string,
  propiedadId: string,
): Promise<DetalleMatch | null> {
  const [{ data: busqueda, error: errorBusqueda }, propiedad] = await Promise.all([
    supabase
      .from('busquedas')
      .select(
        'id, tipo_propiedad, zona, precio_min, precio_max, ambientes_min, m2_min, ' +
          'banos_min, cocheras_min, expensas_max, notas, ' +
          'lead:leads(id, nombre, apellido, telefono, email, estado)',
      )
      .eq('id', busquedaId)
      .maybeSingle(),
    obtenerPropiedadPorId(propiedadId),
  ])

  if (errorBusqueda) {
    throw new Error(interpretarErrorSupabase(errorBusqueda, 'No se pudo cargar la búsqueda.'))
  }
  if (!busqueda || !propiedad) return null

  return { busqueda: busqueda as unknown as BusquedaConLead, propiedad }
}

// ---------------------------------------------------------------------------
// Comparación criterio por criterio
// ---------------------------------------------------------------------------

/**
 * El margen que el RPC le da al precio.
 *
 * `p.precio between coalesce(precio_min, 0) * 0.9 and coalesce(precio_max, N) * 1.1`.
 * No es un rango estricto: una propiedad de USD 145.000 cumple una búsqueda con
 * tope 132.000, porque 132.000 * 1.1 = 145.200. Se replica la fórmula tal cual
 * en vez de comparar contra los extremos pelados, o la tabla diría "no cumple"
 * sobre una propiedad que el score contó como cumplida.
 */
const PISO_PRECIO = 0.9
const TECHO_PRECIO = 1.1

/** El techo que usa el RPC cuando la búsqueda no puso máximo. */
const SIN_TOPE = 999_999_999

export interface FilaComparacion {
  criterio: string
  /**
   * `true` cumple, `false` no cumple, `null` "sin preferencia".
   *
   * `null` es SÓLO cuando la búsqueda no cargó el campo. Que a la propiedad le
   * falte el dato no lo vuelve "sin preferencia": el RPC igual cuenta ese
   * criterio como evaluado y no cumplido, así que va cruz. La única excepción
   * son las expensas, el único criterio que el RPC deja de evaluar cuando a la
   * propiedad le falta el dato.
   */
  cumple: boolean | null
  detalleBusqueda: string
  detallePropiedad: string
}

/** Lo que la comparación necesita de la propiedad. */
export interface LadoPropiedad {
  zona: string | null
  precio: number | null
  ambientes: number | null
  metros_cuadrados: number | null
  banos: number | null
  cocheras: number | null
  expensas: number | null
  moneda: string
}

const SIN_PREFERENCIA = 'Sin preferencia'
const SIN_DATO = 'Sin dato'

const miles = (v: number) => v.toLocaleString('es-AR')

/**
 * Los 7 criterios puntuables, en el mismo orden y con las mismas reglas que
 * `buscar_coincidencias_busqueda`.
 *
 * Quedan afuera a propósito los tres filtros duros del RPC —`estado`
 * DISPONIBLE, `tipo_propiedad`, y la finalidad de la propiedad contra el tipo
 * de la operación vinculada—. Esos no puntúan: deciden si la propiedad entra o
 * no a la lista. Mostrarlos como filas de la tabla haría creer que suman al
 * score, y encima siempre dirían que sí, porque una propiedad que no los pasa
 * nunca llega hasta acá.
 */
export function compararCriterios(
  busqueda: CriteriosBusqueda,
  propiedad: LadoPropiedad,
): FilaComparacion[] {
  return [
    {
      criterio: 'Zona',
      cumple:
        busqueda.zona == null ? null : zonaCoincide(busqueda.zona, propiedad.zona),
      detalleBusqueda: busqueda.zona ?? SIN_PREFERENCIA,
      detallePropiedad: propiedad.zona ?? SIN_DATO,
    },
    {
      criterio: 'Precio',
      cumple:
        busqueda.precio_min == null && busqueda.precio_max == null
          ? null
          : precioEntra(propiedad.precio, busqueda.precio_min, busqueda.precio_max),
      detalleBusqueda: textoRango(busqueda.precio_min, busqueda.precio_max),
      detallePropiedad:
        propiedad.precio == null
          ? SIN_DATO
          : `${propiedad.moneda} ${miles(propiedad.precio)}`,
    },
    {
      criterio: 'Ambientes',
      cumple: alcanzaElMinimo(propiedad.ambientes, busqueda.ambientes_min),
      detalleBusqueda:
        busqueda.ambientes_min == null
          ? SIN_PREFERENCIA
          : `${busqueda.ambientes_min} o más`,
      detallePropiedad: propiedad.ambientes == null ? SIN_DATO : `${propiedad.ambientes}`,
    },
    {
      criterio: 'Metros cuadrados',
      cumple: alcanzaElMinimo(propiedad.metros_cuadrados, busqueda.m2_min),
      detalleBusqueda:
        busqueda.m2_min == null ? SIN_PREFERENCIA : `${busqueda.m2_min} m² o más`,
      detallePropiedad:
        propiedad.metros_cuadrados == null
          ? SIN_DATO
          : `${propiedad.metros_cuadrados} m²`,
    },
    {
      criterio: 'Baños',
      cumple: alcanzaElMinimo(propiedad.banos, busqueda.banos_min),
      detalleBusqueda:
        busqueda.banos_min == null ? SIN_PREFERENCIA : `${busqueda.banos_min} o más`,
      detallePropiedad: propiedad.banos == null ? SIN_DATO : `${propiedad.banos}`,
    },
    {
      criterio: 'Cocheras',
      cumple: alcanzaElMinimo(propiedad.cocheras, busqueda.cocheras_min),
      detalleBusqueda:
        busqueda.cocheras_min == null
          ? SIN_PREFERENCIA
          : `${busqueda.cocheras_min} o más`,
      detallePropiedad: propiedad.cocheras == null ? SIN_DATO : `${propiedad.cocheras}`,
    },
    {
      criterio: 'Expensas',
      // El único con chequeo doble: sin dato en la propiedad el RPC no lo
      // evalúa, así que acá tampoco se marca ni con check ni con cruz.
      cumple:
        busqueda.expensas_max == null || propiedad.expensas == null
          ? null
          : propiedad.expensas <= busqueda.expensas_max,
      detalleBusqueda:
        busqueda.expensas_max == null
          ? SIN_PREFERENCIA
          : `Hasta ${miles(busqueda.expensas_max)}`,
      detallePropiedad:
        propiedad.expensas == null ? SIN_DATO : miles(propiedad.expensas),
    },
  ]
}

/**
 * El match bidireccional del RPC: `p.zona ilike '%b.zona%' or b.zona ilike '%p.zona%'`.
 *
 * Así "Centro" matchea "Centro Norte" y al revés. Sin zona cargada en la
 * propiedad no hay match posible, pero el criterio igual cuenta como evaluado:
 * devuelve `false`, no `null`.
 */
function zonaCoincide(deLaBusqueda: string, deLaPropiedad: string | null): boolean {
  if (deLaPropiedad == null) return false
  const a = deLaBusqueda.trim().toLowerCase()
  const b = deLaPropiedad.trim().toLowerCase()
  if (!a || !b) return false
  return b.includes(a) || a.includes(b)
}

function precioEntra(
  precio: number | null,
  min: number | null,
  max: number | null,
): boolean {
  if (precio == null) return false
  return precio >= (min ?? 0) * PISO_PRECIO && precio <= (max ?? SIN_TOPE) * TECHO_PRECIO
}

/**
 * `p.campo >= b.minimo`. `null` sólo si la búsqueda no pidió mínimo.
 *
 * Si la búsqueda pidió y a la propiedad le falta el dato, es `false`: el RPC
 * cuenta ese criterio como evaluado y no cumplido.
 */
function alcanzaElMinimo(valor: number | null, minimo: number | null): boolean | null {
  if (minimo == null) return null
  if (valor == null) return false
  return valor >= minimo
}

function textoRango(min: number | null, max: number | null): string {
  if (min != null && max != null) return `${miles(min)} - ${miles(max)}`
  if (min != null) return `Desde ${miles(min)}`
  if (max != null) return `Hasta ${miles(max)}`
  return SIN_PREFERENCIA
}
