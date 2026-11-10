import { etiquetaEstado, type EstadoLead } from '../../lib/etiquetasLead'
import { ESTILOS, type Clave } from './estilosEstado'

interface BadgeEstadoProps {
  estado: EstadoLead | null
  /** Se conserva por compatibilidad con las filas de Mi día; ya no cambia el tamaño. */
  chico?: boolean
}

export function BadgeEstado({ estado }: BadgeEstadoProps) {
  const clave: Clave = estado ?? 'NUEVO'

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-meta font-semibold whitespace-nowrap ${ESTILOS[clave]}`}
    >
      <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />
      {etiquetaEstado(estado)}
    </span>
  )
}
