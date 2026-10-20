import type { ClaveIcono } from './tipos'

/** Tamaño real de la pieza (4:5, Instagram). */
export const ANCHO = 1080
export const ALTO = 1350

/** La serif la carga `fonts-imagen.css`; la sans ya la carga la app. */
export const FAMILIA_SERIF = '"Playfair Display Variable", Georgia, serif'
export const FAMILIA_SANS = '"Figtree Variable", system-ui, sans-serif'

/** Los íconos que se pueden elegir para un dato, con el nombre que ve el agente. */
export const OPCIONES_ICONO: { clave: ClaveIcono; nombre: string }[] = [
  { clave: 'ambientes', nombre: 'Ambientes' },
  { clave: 'dormitorios', nombre: 'Dormitorios' },
  { clave: 'banos', nombre: 'Baños' },
  { clave: 'm2_cubiertos', nombre: 'm² cubiertos' },
  { clave: 'm2_terreno', nombre: 'm² terreno' },
  { clave: 'cocheras', nombre: 'Cocheras' },
  { clave: 'parque', nombre: 'Parque' },
  { clave: 'pileta', nombre: 'Pileta' },
  { clave: 'parrilla', nombre: 'Parrilla' },
  { clave: 'ninguno', nombre: 'Sin ícono' },
]
