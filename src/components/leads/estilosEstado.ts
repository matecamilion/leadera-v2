import type { EstadoLead } from '../../lib/etiquetasLead'

export type Clave = EstadoLead | 'NUEVO'

/**
 * Temperatura del lead: punto + texto del color de la temperatura, sin caja
 * ni fondo. Es el único badge con color de la app (ver tokens `temp-*` en
 * src/index.css). Clases literales: Tailwind escanea el fuente y no
 * encontraría `text-temp-${x}`.
 *
 * NUEVO (`estado IS NULL`) no es una temperatura: va en gris.
 */
export const ESTILOS: Record<Clave, string> = {
  CALIENTE: 'text-temp-caliente',
  TIBIO: 'text-temp-tibio',
  FRIO: 'text-temp-frio',
  INACTIVO: 'text-temp-inactivo',
  GANADO: 'text-temp-ganado',
  NUEVO: 'text-ink-3',
}
