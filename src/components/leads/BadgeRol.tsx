import { etiquetaRol, type RolLead } from '../../lib/api/rolLead'

/**
 * Comprador / vendedor: dato neutro, texto gris. El color queda reservado
 * para la temperatura (`BadgeEstado`); el rol es otra dimensión y no compite.
 */
interface BadgeRolProps {
  rol: RolLead | null
}

export function BadgeRol({ rol }: BadgeRolProps) {
  // Sin señal no se dibuja nada: un "sin rol" en cada fila sería ruido.
  if (!rol) return null

  return (
    <span className="inline-block shrink-0 text-meta font-medium whitespace-nowrap text-ink-3">
      {etiquetaRol(rol)}
    </span>
  )
}
