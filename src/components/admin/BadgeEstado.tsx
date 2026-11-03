import { ETIQUETA_ESTADO, type EstadoVisible } from '../../lib/api/admin'
import { BADGE_ESTADO } from './estilosEstado'

/**
 * El estado de la cuenta como etiqueta de color. La usan las tablas, las
 * tarjetas y la ficha del panel. Recibe el estado visible (`estadoVisible`), que
 * distingue una cuenta suspendida de una vencida.
 */
export function BadgeEstado({ estado }: { estado: EstadoVisible }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-meta font-semibold whitespace-nowrap ${BADGE_ESTADO[estado]}`}
    >
      {ETIQUETA_ESTADO[estado]}
    </span>
  )
}
