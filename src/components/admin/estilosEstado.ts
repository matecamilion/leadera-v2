import type { EstadoSuscripcion } from '../../lib/api/suscripcion'

/**
 * Colores de cada estado de suscripción en el panel. Clases literales para que
 * Tailwind las encuentre. GRACIA va en el rojo de alerta: es plata que ya
 * falló, y es lo primero que tiene que saltar a la vista.
 */
export const BADGE_ESTADO: Record<EstadoSuscripcion, string> = {
  TRIAL: 'bg-cool-soft text-frio',
  ACTIVA: 'bg-badge-ganado-bg text-success',
  GRACIA: 'bg-peligro-soft text-peligro-ink ring-1 ring-peligro-borde',
  VENCIDA: 'bg-warm-soft text-badge-tibio-ink',
  CANCELADA: 'bg-surface-2 text-ink-3',
}

/** Relleno sólido, para la barra de distribución y su leyenda. */
export const SOLIDO_ESTADO: Record<EstadoSuscripcion, string> = {
  TRIAL: 'bg-frio',
  ACTIVA: 'bg-success',
  GRACIA: 'bg-peligro',
  VENCIDA: 'bg-tibio',
  CANCELADA: 'bg-ink-4',
}

/**
 * Colores del aviso de cobro (`alertaDeCobro`). Deliberadamente distintos de
 * los del estado: uno dice en qué estado está la cuenta y el otro, qué hay que
 * hacer con ella. Si compartieran paleta, la fila en gracia mostraría el mismo
 * rojo dos veces y ninguno de los dos se leería.
 */
export const BADGE_ALERTA: Record<'vencida' | 'gracia' | 'por_vencer', string> = {
  vencida: 'bg-surface-2 text-ink-3',
  gracia: 'bg-peligro-soft text-peligro-ink',
  por_vencer: 'bg-warm-soft text-badge-tibio-ink',
}
