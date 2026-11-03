import type { Disposicion, TipoPropiedad } from '../../../lib/api/propiedades'

/**
 * Los ÚNICOS campos que entran a la ficha.
 *
 * Esto no es una comodidad: es la regla de negocio hecha tipo. La ficha se
 * comparte con compradores y con colegas de otras inmobiliarias, así que no
 * puede exponer a quién contactar directo. `datosParaFicha` copia campo por
 * campo desde esta lista, de modo que aunque alguien le pase la propiedad
 * completa, `lead_propietario`, `agente_id`, `inmobiliaria_id`, `link_portal`
 * o cualquier teléfono o mail se quedan afuera.
 *
 * Si mañana hace falta sumar un dato, que sea uno de la propiedad. Nombres de
 * personas, teléfonos y mails no van acá.
 */
export interface DatosFicha {
  direccion: string
  zona: string | null
  tipo: TipoPropiedad
  precio: number | null
  moneda: string
  ambientes: number | null
  banos: number | null
  cocheras: number | null
  metros_cubiertos: number | null
  metros_cuadrados: number | null
  disposicion: Disposicion | null
  /** Se asume ARS: la columna no tiene moneda propia. */
  expensas: number | null
  descripcion: string | null
  fotos_urls: string[]
  /** Nombre de la inmobiliaria del usuario que exporta. No es un dato de la propiedad. */
  inmobiliaria: string | null
}

/** Las claves permitidas, en un solo lugar: el test verifica que no haya otras. */
export const CAMPOS_FICHA = [
  'direccion',
  'zona',
  'tipo',
  'precio',
  'moneda',
  'ambientes',
  'banos',
  'cocheras',
  'metros_cubiertos',
  'metros_cuadrados',
  'disposicion',
  'expensas',
  'descripcion',
  'fotos_urls',
  'inmobiliaria',
] as const satisfies readonly (keyof DatosFicha)[]

/** Lo que `datosParaFicha` lee de la propiedad: solo los campos de arriba. */
export type OrigenFicha = Omit<DatosFicha, 'fotos_urls' | 'inmobiliaria'> & {
  fotos_urls: string[] | null
}

export function datosParaFicha(origen: OrigenFicha, inmobiliaria: string | null): DatosFicha {
  return {
    direccion: origen.direccion,
    zona: origen.zona,
    tipo: origen.tipo,
    precio: origen.precio,
    moneda: origen.moneda,
    ambientes: origen.ambientes,
    banos: origen.banos,
    cocheras: origen.cocheras,
    metros_cubiertos: origen.metros_cubiertos,
    metros_cuadrados: origen.metros_cuadrados,
    disposicion: origen.disposicion,
    expensas: origen.expensas,
    descripcion: origen.descripcion,
    fotos_urls: origen.fotos_urls ?? [],
    inmobiliaria: inmobiliaria?.trim() || null,
  }
}
