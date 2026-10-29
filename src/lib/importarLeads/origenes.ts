/**
 * Del texto de la columna "origen" de un archivo a un valor del enum `origen_lead`.
 *
 * La RPC `importar_leads` rechaza MANUAL, REFERIDO y LINK_CONSULTA (alimentan las
 * métricas de gestión o son de uso interno): esta traducción nunca los produce,
 * ni siquiera cuando el archivo los nombra, y `esOrigenImportable` es la segunda
 * barrera antes de armar el payload.
 */
import type { OrigenLead } from '../etiquetasLead'
import { normalizarEncabezado } from './mapeoColumnas'

export const ORIGENES_VEDADOS = ['MANUAL', 'REFERIDO', 'LINK_CONSULTA'] as const satisfies readonly OrigenLead[]

/** Los valores de `origen_lead` que un archivo puede asignar. */
export type OrigenImportable = Exclude<OrigenLead, (typeof ORIGENES_VEDADOS)[number]>

/**
 * Claves ya normalizadas (`normalizarEncabezado`: minúsculas, sin tildes, solo
 * letras y números separados por un espacio). "WhatsApp (C21)" queda como
 * `whatsapp c21`.
 */
const TRADUCCION: Record<string, OrigenImportable> = {
  zonaprop: 'ZONAPROP',
  'zona prop': 'ZONAPROP',
  argenprop: 'ARGENPROP',
  'mercado libre': 'MERCADO_LIBRE',
  mercadolibre: 'MERCADO_LIBRE',
  whatsapp: 'WHATSAPP',
  'whatsapp c21': 'WHATSAPP',
  'web form': 'FORMULARIO_WEB',
  webform: 'FORMULARIO_WEB',
  formulario: 'FORMULARIO_WEB',
  'formulario web': 'FORMULARIO_WEB',
  instagram: 'INSTAGRAM',
  facebook: 'FACEBOOK',
  'meta ads': 'META_ADS',
  landing: 'LANDING',
}

/** Lo que no se reconoce (incluido "Century 21", REFERIDO y MANUAL) es OTRO. */
export function traducirOrigen(texto: string): OrigenImportable {
  return TRADUCCION[normalizarEncabezado(texto)] ?? 'OTRO'
}

export function esOrigenImportable(valor: string): valor is OrigenImportable {
  return !(ORIGENES_VEDADOS as readonly string[]).includes(valor)
}
