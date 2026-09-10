/**
 * Paleta de acento compartida por las cards y las secciones del dashboard.
 *
 * Vive en su propio módulo y no adentro de `CardKpi` porque lo consumen dos
 * componentes: la card de un número arriba y la card de una sección abajo. Con
 * una sola tabla, un dato y su lista no pueden terminar de distinto color.
 *
 * Clases literales, no armadas por template string: Tailwind escanea el fuente
 * y no encontraría `bg-${x}-soft`.
 */
export type TonoKpi = 'brand' | 'caliente' | 'tibio' | 'frio' | 'neutro'

export const TONOS: Record<TonoKpi, string> = {
  brand: 'bg-brand-soft text-primary',
  caliente: 'bg-hot-soft text-caliente',
  tibio: 'bg-warm-soft text-badge-tibio-ink',
  frio: 'bg-cool-soft text-frio',
  neutro: 'bg-surface-2 text-ink-3',
}
