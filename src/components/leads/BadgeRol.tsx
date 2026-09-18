import { etiquetaRol, type RolLead } from '../../lib/api/rolLead'

/**
 * Comprador / vendedor, al lado del badge de estado.
 *
 * Misma forma que `BadgeEstado` —chico, en mayúsculas, esquinas apenas
 * redondeadas— pero con borde y fondo blanco en vez de relleno: el color
 * relleno ya significa temperatura, y un segundo badge relleno se leería como
 * otro estado. El rol es otra dimensión y tiene que verse como tal.
 */
const ESTILOS: Record<RolLead, string> = {
  COMPRADOR: 'border-info/40 text-info',
  VENDEDOR: 'border-primary/40 text-primary-dark',
  AMBOS: 'border-ink-3/40 text-ink-2',
}

interface BadgeRolProps {
  rol: RolLead | null
}

export function BadgeRol({ rol }: BadgeRolProps) {
  // Sin señal no se dibuja nada: un "sin rol" en cada fila sería ruido.
  if (!rol) return null

  return (
    <span
      className={`inline-block shrink-0 rounded-sm border bg-surface px-2 py-[3px] text-[10px] font-bold whitespace-nowrap uppercase ${ESTILOS[rol]}`}
    >
      {etiquetaRol(rol)}
    </span>
  )
}
