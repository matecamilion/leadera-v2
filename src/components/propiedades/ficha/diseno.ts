import { ajustarParaContraste } from '../imagen/color'
import { CLAVE_ESTILOS, leerGuardado } from '../imagen/almacenamiento'
import { eleccionDeEstilo, estiloPredeterminado, leerEstilos } from '../imagen/estilos'

/**
 * Constantes de diseño de la ficha en PDF. Todo número y color del documento
 * sale de acá: el PDF no lee variables CSS ni clases de Tailwind.
 */

/** Acento de respaldo: el verde de la marca. */
export const ACENTO_RESPALDO = '#0f6e5c'

/** Grises y tintas. El acento se calcula aparte (`resolverAcento`). */
export const C = {
  ink: '#1a1f24',
  ink2: '#334155',
  ink3: '#5a6779',
  ink4: '#8a94a3',
  borde: '#e3e6ea',
  fondoSuave: '#eef2f1',
  blanco: '#ffffff',
} as const

/** Escala tipográfica, en pt. Ningún `fontSize` del documento queda fuera de acá. */
export const T = {
  rotuloChico: 7,
  rotulo: 8,
  pie: 8,
  cuerpo: 10,
  subtitulo: 12,
  dato: 13,
  seccion: 9,
  precioMoneda: 14,
  precioConsultar: 22,
  direccion: 26,
  precio: 34,
} as const

/** Medidas de la página, en pt (A4: 595 × 842). */
export const M = {
  margen: 40,
  anchoUtil: 515,
  /** Aire para el pie fijo, que vive dentro del margen inferior. */
  pieAlto: 16,
  /** La portada va a sangre: de borde a borde de la hoja. */
  anchoPagina: 595,
  heroAlto: 340,
  galeriaGap: 10,
  /** Alto de la tira de fotos de la página 1. */
  tiraAlto: 110,
  /** Portada + 3 de la tira + 5 de la galería. */
  maxFotos: 9,
  /** Hasta esta cantidad, los datos clave van en una sola fila. */
  datosUnaFila: 5,
} as const

/** Contraste mínimo del texto blanco sobre el bloque del precio. */
const CONTRASTE_TEXTO_SOBRE_BLOQUE = 4.5

const HEX = /^#[0-9a-fA-F]{6}$/

/**
 * El color de acento de la ficha.
 *
 * Toma el color principal del estilo predeterminado de "Crear imagen" y lo
 * oscurece lo justo para que el texto blanco se lea sobre el bloque del precio.
 * Ese estilo vive en el `localStorage` del navegador: es POR NAVEGADOR, así que
 * en otro dispositivo la ficha sale con el verde de respaldo.
 */
export function resolverAcento(textoGuardado: string | null = leerGuardado(CLAVE_ESTILOS)): string {
  try {
    const estilo = estiloPredeterminado(leerEstilos(textoGuardado))
    const primario = estilo ? eleccionDeEstilo(estilo).primario : null
    if (primario && HEX.test(primario)) {
      return ajustarParaContraste(primario, C.blanco, CONTRASTE_TEXTO_SOBRE_BLOQUE)
    }
  } catch {
    // Un estilo corrupto no puede frenar la exportación.
  }
  return ACENTO_RESPALDO
}
