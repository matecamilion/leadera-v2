/** Medidas, paletas y tipografía de la imagen para publicar. */

export const ANCHO = 1080
export const ALTO = 1350

export const DORADO = '#c9a24b'

export type ClavePaleta = 'verde' | 'marino' | 'bordo' | 'negro'

/** Fondo de la banda y el pie. El acento es el mismo dorado en todas. */
export const PALETAS: { clave: ClavePaleta; nombre: string; fondo: string }[] = [
  { clave: 'verde', nombre: 'Verde oscuro', fondo: '#0a4438' },
  { clave: 'marino', nombre: 'Azul marino', fondo: '#14284b' },
  { clave: 'bordo', nombre: 'Bordó', fondo: '#5e1a28' },
  { clave: 'negro', nombre: 'Negro', fondo: '#141414' },
]

/** La serif del título. La carga `fonts-imagen.css`, que importa el panel. */
export const FAMILIA_TITULO = '"Playfair Display Variable", Georgia, serif'

