import type { PaletaImagen } from './tipos'

/** Cuatro claras y cuatro oscuras (con tinta clara). */
export const PALETAS: PaletaImagen[] = [
  { clave: 'dorado', nombre: 'Crema y dorado', fondo: '#faf5e6', tinta: '#1c1a17', acento: '#ad8420', acentoTexto: '#765a10', sobreAcento: '#1c1a17' },
  { clave: 'terracota', nombre: 'Terracota', fondo: '#f7ecdd', tinta: '#3a1f17', acento: '#a8402a', acentoTexto: '#a8402a', sobreAcento: '#fff4ea' },
  { clave: 'negro', nombre: 'Blanco y negro', fondo: '#ffffff', tinta: '#111111', acento: '#111111', acentoTexto: '#111111', sobreAcento: '#ffffff' },
  { clave: 'salvia', nombre: 'Salvia', fondo: '#d8e6cc', tinta: '#1e2b1d', acento: '#46663f', acentoTexto: '#46663f', sobreAcento: '#f4f8ee' },
  { clave: 'bosque', nombre: 'Verde bosque', fondo: '#0c3a2c', tinta: '#f2ede0', acento: '#8fd4a6', acentoTexto: '#8fd4a6', sobreAcento: '#0c3a2c' },
  { clave: 'noche', nombre: 'Azul noche', fondo: '#0a1f4d', tinta: '#eef1f7', acento: '#8ebcf0', acentoTexto: '#8ebcf0', sobreAcento: '#0a1f4d' },
  { clave: 'bordo', nombre: 'Bordó profundo', fondo: '#3d0e1c', tinta: '#f7ece9', acento: '#f4aab0', acentoTexto: '#f4aab0', sobreAcento: '#3d0e1c' },
  { clave: 'carbon', nombre: 'Carbón', fondo: '#1a1c20', tinta: '#f1ede4', acento: '#d4b66e', acentoTexto: '#d4b66e', sobreAcento: '#1a1c20' },
]

function aRgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number]
}

/**
 * Borde fino de tinta al 15 % para que las fotos se separen de un fondo oscuro.
 * Las paletas claras no lo llevan: ahí el contraste ya las separa.
 */
export function bordeDeFoto(paleta: PaletaImagen): string | undefined {
  const [r, g, b] = aRgb(paleta.fondo)
  const oscuro = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.3
  return oscuro ? `rgba(${aRgb(paleta.tinta).join(',')},0.15)` : undefined
}
