import type { EstadoLead } from '../../lib/api/leads'

type Clave = EstadoLead | 'NUEVO'

/**
 * Colores exactos de `.badge-estado` del Angular. Clases literales y no
 * armadas por template string: Tailwind escanea el fuente y no encontraría
 * `bg-badge-${x}-bg`.
 *
 * NUEVO no existe en el original: es la variante para `estado IS NULL`,
 * construida con los tokens de marca para no inventar un color nuevo.
 */
const ESTILOS: Record<Clave, string> = {
  CALIENTE: 'bg-badge-caliente-bg text-caliente',
  TIBIO: 'bg-badge-tibio-bg text-badge-tibio-ink',
  FRIO: 'bg-badge-frio-bg text-frio',
  INACTIVO: 'bg-background text-inactivo',
  GANADO: 'bg-badge-ganado-bg text-primary-dark',
  NUEVO: 'bg-brand-soft text-primary',
}

interface BadgeEstadoProps {
  estado: EstadoLead | null
  /**
   * Un escalón más chico, para las filas de una línea de Mi día: ahí el badge
   * comparte renglón con las acciones y el botón de interacción. En el resto
   * de las pantallas se queda en el tamaño del original.
   */
  chico?: boolean
}

export function BadgeEstado({ estado, chico = false }: BadgeEstadoProps) {
  const clave: Clave = estado ?? 'NUEVO'

  return (
    <span
      className={`inline-block rounded-sm font-bold uppercase ${chico ? 'px-2 py-0.5 text-[9.5px]' : 'px-2.5 py-1 text-[10px]'} ${ESTILOS[clave]}`}
    >
      {clave}
    </span>
  )
}
