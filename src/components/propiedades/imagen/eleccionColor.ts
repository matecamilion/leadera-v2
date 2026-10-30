import { derivarPaleta } from './color'
import { PALETAS } from './paletas'
import type { ClavePaleta, PaletaImagen } from './tipos'

/**
 * Lo que la persona eligió en los dos selectores. Con una clave de paleta es un
 * atajo y la paleta sale tal cual de `PALETAS`; con `personalizada` sale de
 * `derivarPaleta(primario, secundario)`.
 */
export interface EleccionColor {
  clave: ClavePaleta
  /** Color principal: el acento (bloques, líneas, precio). */
  primario: string
  /** Color de fondo. */
  secundario: string
}

const HEX_COMPLETO = /^#[0-9a-f]{6}$/

/** `#RRGGBB` o `rrggbb` → `#rrggbb`; cualquier otra cosa → null. */
export function normalizarHex(texto: string): string | null {
  const hex = `#${texto.trim().replace(/^#/, '')}`.toLowerCase()
  return HEX_COMPLETO.test(hex) ? hex : null
}

/** La paleta de un atajo, o la primera si la clave no existe. */
export function paletaDeAtajo(clave: ClavePaleta): PaletaImagen {
  return PALETAS.find((p) => p.clave === clave) ?? PALETAS[0]
}

/** Elegir un atajo: los selectores pasan a mostrar su acento y su fondo. */
export function elegirAtajo(clave: ClavePaleta): EleccionColor {
  const p = paletaDeAtajo(clave)
  return { clave: p.clave, primario: p.acento, secundario: p.fondo }
}

/** Cambiar cualquiera de los dos colores saca a la persona del atajo. */
export function cambiarColor(
  actual: EleccionColor,
  cual: 'primario' | 'secundario',
  hex: string,
): EleccionColor {
  return { ...actual, clave: 'personalizada', [cual]: hex }
}

export function paletaDeEleccion(e: EleccionColor): PaletaImagen {
  return e.clave === 'personalizada' ? derivarPaleta(e.primario, e.secundario) : paletaDeAtajo(e.clave)
}
