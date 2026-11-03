import { Font } from '@react-pdf/renderer'
import figtree400 from '@fontsource/figtree/files/figtree-latin-400-normal.woff?url'
import figtree600 from '@fontsource/figtree/files/figtree-latin-600-normal.woff?url'
import figtree700 from '@fontsource/figtree/files/figtree-latin-700-normal.woff?url'
import playfair700 from '@fontsource/playfair-display/files/playfair-display-latin-700-normal.woff?url'

export const SANS = 'Figtree'
export const SERIF = 'Playfair Display'

export interface RutasFuentes {
  figtree400: string
  figtree600: string
  figtree700: string
  playfair700: string
}

/** Las fuentes empaquetadas por Vite: salen del mismo origen, sin CDN. */
const RUTAS_BUNDLE: RutasFuentes = { figtree400, figtree600, figtree700, playfair700 }

/**
 * Registra las fuentes del PDF desde cero. Hay que llamarla ANTES DE CADA
 * exportación, no una sola vez.
 *
 * react-pdf no lee woff2 ni fuentes variables, por eso son los paquetes
 * `@fontsource/*` estáticos (.woff).
 *
 * Por qué cada vez: el registro conserva la fuente ya analizada con el estado
 * de glifos del documento anterior. Medido en Node, si se reutiliza, el
 * segundo PDF de la sesión sale con las líneas cortadas en cualquier letra y la
 * puntuación cambiada ("abierta#"). `Font.reset()` no alcanza (deja la promesa
 * de carga resuelta y la fuente sin datos); `Font.clear()` y registrar de nuevo
 * crea fuentes nuevas, como en la primera exportación.
 *
 * `rutas` existe para que los tests apunten a archivos del disco.
 */
export function registrarFuentes(rutas: RutasFuentes = RUTAS_BUNDLE): void {
  Font.clear()

  Font.register({
    family: SANS,
    fonts: [
      { src: rutas.figtree400, fontWeight: 400 },
      { src: rutas.figtree600, fontWeight: 600 },
      { src: rutas.figtree700, fontWeight: 700 },
    ],
  })
  Font.register({
    family: SERIF,
    fonts: [{ src: rutas.playfair700, fontWeight: 700 }],
  })
  // `clear` también borra Helvetica, la fuente por defecto de react-pdf.
  Font.register({
    family: 'Helvetica',
    fonts: [
      { src: 'Helvetica', fontWeight: 400 },
      { src: 'Helvetica-Bold', fontWeight: 700 },
    ],
  })

  // Sin corte silábico: una dirección partida con guion queda mal.
  Font.registerHyphenationCallback((palabra) => [palabra])
}
