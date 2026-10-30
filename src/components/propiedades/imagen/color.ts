import type { PaletaImagen } from './tipos'

/** Los dos textos que ya usan las paletas: negro y blanco con un dejo cálido. */
export const NEGRO_CALIDO = '#1c1a17'
export const BLANCO_CALIDO = '#f6f1e7'

const MIN_TEXTO = 4.5
const MIN_BLOQUE = 3
const PASO_AJUSTE = 0.04

const FORMATO_HEX = /^#[0-9a-fA-F]{6}$/

function validar(hex: string): void {
  if (!FORMATO_HEX.test(hex)) {
    throw new Error(`Color inválido: "${hex}". Se espera el formato #rrggbb.`)
  }
}

function aCanales(hex: string): [number, number, number] {
  validar(hex)
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number]
}

function aHex(canales: number[]): string {
  return `#${canales.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`
}

/** Luminancia relativa WCAG (0 negro, 1 blanco), con corrección gamma. */
export function luminancia(hex: string): number {
  const [r, g, b] = aCanales(hex).map((c) => {
    const v = c / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Ratio de contraste WCAG entre dos colores, de 1 a 21. */
export function contraste(a: string, b: string): number {
  const la = luminancia(a)
  const lb = luminancia(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/**
 * Oscurece o aclara `hex` en pasos hasta que contraste al menos `min` con
 * `fondo`: oscurece sobre un fondo claro y aclara sobre uno oscuro. Si ya
 * alcanza, lo devuelve igual.
 */
export function ajustarParaContraste(hex: string, fondo: string, min: number): string {
  if (contraste(hex, fondo) >= min) return hex
  const destino = luminancia(fondo) > 0.5 ? 0 : 255
  const origen = aCanales(hex)
  for (let t = PASO_AJUSTE; t < 1; t += PASO_AJUSTE) {
    const candidato = aHex(origen.map((c) => c + (destino - c) * t))
    if (contraste(candidato, fondo) >= min) return candidato
  }
  return aHex([destino, destino, destino])
}

/** El negro o el blanco cálido, el que más contraste da sobre `hex`. */
export function textoSobre(hex: string): string {
  return contraste(NEGRO_CALIDO, hex) >= contraste(BLANCO_CALIDO, hex) ? NEGRO_CALIDO : BLANCO_CALIDO
}

/**
 * Arma una paleta completa a partir de dos colores: el secundario es el fondo y
 * el primario el acento. El resto se deduce por luminosidad.
 */
export function derivarPaleta(primario: string, secundario: string): PaletaImagen {
  validar(primario)
  validar(secundario)
  return {
    clave: 'personalizada',
    nombre: 'Personalizada',
    fondo: secundario,
    tinta: textoSobre(secundario),
    acento: primario,
    acentoTexto: ajustarParaContraste(primario, secundario, MIN_TEXTO),
    sobreAcento: textoSobre(primario),
  }
}

export interface AvisoContraste {
  par: 'sobreAcento' | 'acento'
  ratio: number
  mensaje: string
}

/** Los pares que se leen mal. Lista vacía si todo pasa. */
export function avisosDeContraste(paleta: PaletaImagen): AvisoContraste[] {
  const avisos: AvisoContraste[] = []
  const texto = contraste(paleta.sobreAcento, paleta.acento)
  if (texto < MIN_TEXTO) {
    avisos.push({
      par: 'sobreAcento',
      ratio: texto,
      mensaje: `El texto sobre el color principal se lee mal (contraste ${texto.toFixed(1)}).`,
    })
  }
  const bloque = contraste(paleta.acento, paleta.fondo)
  if (bloque < MIN_BLOQUE) {
    avisos.push({
      par: 'acento',
      ratio: bloque,
      mensaje: `El color principal casi no se distingue del fondo (contraste ${bloque.toFixed(1)}).`,
    })
  }
  return avisos
}
