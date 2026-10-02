/**
 * Textos de la encuesta pública.
 *
 * Cada `Record<…>` está tipado con la unión que exporta `encuesta.ts` de la
 * edge function: si allá aparece un código nuevo, esto no compila hasta que
 * tenga etiqueta. Los rangos de presupuesto no están acá: los manda el GET.
 */
import {
  GARANTIAS,
  PAGOS,
  PLAZOS,
  PRESUPUESTO_PROPIEDAD,
  TIPOS_PROPIEDAD,
  type PresupuestoPropiedad,
} from '../../../supabase/functions/consulta-publica/encuesta.ts'
import type { Garantia, Operacion, Pago, Plazo, TipoPropiedad } from './tipos'

export interface Opcion<T extends string> {
  valor: T
  label: string
}

export const ETIQUETA_TIPO: Record<TipoPropiedad, string> = {
  CASA: 'Casa',
  DEPARTAMENTO: 'Departamento',
  PH: 'PH',
  TERRENO: 'Terreno',
  LOCAL_COMERCIAL: 'Local comercial',
  GALPON: 'Galpón',
  OFICINA: 'Oficina',
  OTRO: 'Otro',
}

const ETIQUETA_OPERACION: Record<Operacion, string> = {
  COMPRA: 'Comprar',
  ALQUILER: 'Alquilar una propiedad',
  VENTA: 'Vender mi propiedad',
  ALQUILER_PROPIETARIO: 'Poner mi propiedad en alquiler',
}

const ETIQUETA_PRESUPUESTO_PROPIEDAD: Record<PresupuestoPropiedad, string> = {
  SI: 'Sí, entra en mi presupuesto',
  UN_POCO_MAS: 'Está un poco por encima',
  NO: 'No, se me va de presupuesto',
}

const ETIQUETA_PAGO: Record<Pago, string> = {
  CONTADO: 'Contado',
  CREDITO_APROBADO: 'Con crédito aprobado',
  CREDITO_TRAMITE: 'Con crédito en trámite',
  NECESITA_VENDER: 'Necesito vender una propiedad primero',
  NO_SABE: 'Todavía no lo sé',
}

const ETIQUETA_GARANTIA: Record<Garantia, string> = {
  PROPIETARIA: 'Garantía propietaria',
  SEGURO_CAUCION: 'Seguro de caución',
  NO_TENGO: 'Todavía no tengo',
}

const ETIQUETA_PLAZO: Record<Plazo, string> = {
  YA: 'Lo antes posible',
  MENOS_3M: 'En menos de 3 meses',
  '3_6M': 'En 3 a 6 meses',
  MAS_6M: 'En más de 6 meses',
  SOLO_MIRANDO: 'Solo estoy mirando',
}

function opciones<T extends string>(lista: readonly T[], etiquetas: Record<T, string>): Opcion<T>[] {
  return lista.map((valor) => ({ valor, label: etiquetas[valor] }))
}

export const OPCIONES_OPERACION = opciones<Operacion>(['COMPRA', 'ALQUILER'], ETIQUETA_OPERACION)
export const OPCIONES_TIPO = opciones(TIPOS_PROPIEDAD, ETIQUETA_TIPO)
export const OPCIONES_PRESUPUESTO_PROPIEDAD = opciones(
  PRESUPUESTO_PROPIEDAD,
  ETIQUETA_PRESUPUESTO_PROPIEDAD,
)
export const OPCIONES_PAGO = opciones(PAGOS, ETIQUETA_PAGO)
export const OPCIONES_GARANTIA = opciones(GARANTIAS, ETIQUETA_GARANTIA)
export const OPCIONES_PLAZO = opciones(PLAZOS, ETIQUETA_PLAZO)

export const OPCIONES_SI_NO_VISITA: Opcion<'si' | 'no'>[] = [
  { valor: 'si', label: 'Sí, me gustaría' },
  { valor: 'no', label: 'Por ahora no' },
]

export const OPCIONES_SI_NO: Opcion<'si' | 'no'>[] = [
  { valor: 'si', label: 'Sí' },
  { valor: 'no', label: 'No' },
]

export const ETIQUETA_FINALIDAD: Record<'VENTA' | 'ALQUILER' | 'AMBAS', string> = {
  VENTA: 'En venta',
  ALQUILER: 'En alquiler',
  AMBAS: 'Venta o alquiler',
}

/** "USD 125.000" / "$450.000". Mismo formato que el resumen de la edge function. */
export function formatearPrecio(precio: number | null, moneda: string): string | null {
  if (precio === null) return null
  const numero = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(precio)
  return moneda === 'ARS' ? `$${numero}` : `${moneda} ${numero}`
}

export const URL_PRIVACIDAD = 'https://leadera.com.ar/privacidad.html'
export const URL_LEADERA = 'https://leadera.com.ar'
