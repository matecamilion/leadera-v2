import { rangoPorCodigo } from '../../../supabase/functions/consulta-publica/encuesta.ts'
import {
  ETIQUETA_TIPO,
  OPCIONES_GARANTIA,
  OPCIONES_PAGO,
  OPCIONES_PLAZO,
  OPCIONES_PRESUPUESTO_PROPIEDAD,
  type Opcion,
} from '../consulta-publica/catalogo'
import type { Operacion, TipoPropiedad } from '../consulta-publica/tipos'

/**
 * Las respuestas de la encuesta, legibles, en dos formas: la línea de resumen
 * que se escanea en la bandeja y las filas completas del detalle.
 *
 * El detalle usa las mismas etiquetas que vio quien consultó
 * (`consulta-publica/catalogo.ts`) y los rangos que mandó la edge function
 * (`encuesta.ts`). El resumen las acorta: es para leer de reojo.
 */

interface Respuestas {
  flujo?: 'GENERAL' | 'PROPIEDAD'
  operacion?: Operacion
  tipo_propiedad?: TipoPropiedad | null
  zona?: string | null
  presupuesto?: string | null
  pago?: string | null
  garantia?: string | null
  plazo?: string
  visita?: boolean | null
  vender?: boolean | null
}

interface PropiedadDeOrigen {
  tipo: string
  zona: string | null
}

function etiqueta<T extends string>(opciones: Opcion<T>[], valor: string | null | undefined) {
  return opciones.find((o) => o.valor === valor)?.label ?? valor ?? null
}

function siNo(valor: boolean | null | undefined): string | null {
  if (valor === null || valor === undefined) return null
  return valor ? 'Sí' : 'No'
}

function lugar(tipo: string | null | undefined, zona: string | null | undefined): string | null {
  if (!tipo) return zona ?? null
  const nombre = ETIQUETA_TIPO[tipo as TipoPropiedad] ?? tipo
  return zona ? `${nombre} en ${zona}` : nombre
}

const OPERACION_CORTA: Record<Operacion, string> = { COMPRA: 'Compra', ALQUILER: 'Alquiler' }

const PRESUPUESTO_PROPIEDAD_CORTO: Record<string, string> = {
  SI: 'Entra en presupuesto',
  UN_POCO_MAS: 'Algo por encima',
  NO: 'Fuera de presupuesto',
}

const PAGO_CORTO: Record<string, string> = {
  CONTADO: 'Contado',
  CREDITO_APROBADO: 'Crédito aprobado',
  CREDITO_TRAMITE: 'Crédito en trámite',
  NECESITA_VENDER: 'Necesita vender',
  NO_SABE: 'Pago a definir',
}

const GARANTIA_CORTA: Record<string, string> = {
  PROPIETARIA: 'Garantía propietaria',
  SEGURO_CAUCION: 'Seguro de caución',
  NO_TENGO: 'Sin garantía',
}

const PLAZO_CORTO: Record<string, string> = {
  YA: 'Ya',
  MENOS_3M: 'Menos de 3 meses',
  '3_6M': '3 a 6 meses',
  MAS_6M: 'Más de 6 meses',
  SOLO_MIRANDO: 'Solo mirando',
}

/**
 * "Compra · Casa en Palermo · Contado · Ya": lo que decide, en una línea y en
 * el orden en que se pregunta.
 */
export function resumenCorto(crudo: unknown, propiedad: PropiedadDeOrigen | null): string {
  const r = (crudo ?? {}) as Respuestas
  const partes: (string | null | undefined)[] = []

  if (r.operacion) partes.push(OPERACION_CORTA[r.operacion])
  partes.push(
    r.flujo === 'PROPIEDAD' ? lugar(propiedad?.tipo, propiedad?.zona) : lugar(r.tipo_propiedad, r.zona),
  )

  if (!r.presupuesto) partes.push('Sin presupuesto')
  else if (r.flujo === 'PROPIEDAD') partes.push(PRESUPUESTO_PROPIEDAD_CORTO[r.presupuesto])
  else if (r.operacion) partes.push(rangoPorCodigo(r.operacion, r.presupuesto)?.label)

  if (r.pago) partes.push(PAGO_CORTO[r.pago])
  if (r.garantia) partes.push(GARANTIA_CORTA[r.garantia])
  if (r.plazo) partes.push(PLAZO_CORTO[r.plazo])

  return partes.filter(Boolean).join(' · ')
}

/** Las filas completas del detalle desplegable. */
export function filasRespuestas(crudo: unknown): { label: string; valor: string }[] {
  const r = (crudo ?? {}) as Respuestas
  const filas: { label: string; valor: string | null }[] = []

  // Mismas palabras que el resumen del lead ("Operación: Compra").
  if (r.operacion) filas.push({ label: 'Operación', valor: OPERACION_CORTA[r.operacion] })
  if (r.flujo !== 'PROPIEDAD') filas.push({ label: 'Busca', valor: lugar(r.tipo_propiedad, r.zona) })

  const presupuesto = !r.presupuesto
    ? 'No lo contestó'
    : r.flujo === 'PROPIEDAD'
      ? etiqueta(OPCIONES_PRESUPUESTO_PROPIEDAD, r.presupuesto)
      : (r.operacion && rangoPorCodigo(r.operacion, r.presupuesto)?.label) || r.presupuesto
  filas.push({ label: 'Presupuesto', valor: presupuesto })

  if (r.pago) filas.push({ label: 'Pago', valor: etiqueta(OPCIONES_PAGO, r.pago) })
  if (r.garantia) filas.push({ label: 'Garantía', valor: etiqueta(OPCIONES_GARANTIA, r.garantia) })
  if (r.plazo) filas.push({ label: 'Plazo', valor: etiqueta(OPCIONES_PLAZO, r.plazo) })
  filas.push({ label: 'Visita', valor: siNo(r.visita) })
  filas.push({ label: 'Para vender', valor: siNo(r.vender) })

  return filas.filter((f): f is { label: string; valor: string } => f.valor !== null)
}
