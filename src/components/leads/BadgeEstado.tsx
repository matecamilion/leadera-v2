import { etiquetaEstado, type EstadoLead } from '../../lib/etiquetasLead'

type Clave = EstadoLead | 'NUEVO'

/**
 * Temperatura del lead: punto + texto del color de la temperatura, sin caja
 * ni fondo. Es el único badge con color de la app (ver tokens `temp-*` en
 * src/index.css). Clases literales: Tailwind escanea el fuente y no
 * encontraría `text-temp-${x}`.
 *
 * NUEVO (`estado IS NULL`) no es una temperatura: va en gris.
 */
const ESTILOS: Record<Clave, string> = {
  CALIENTE: 'text-temp-caliente',
  TIBIO: 'text-temp-tibio',
  FRIO: 'text-temp-frio',
  INACTIVO: 'text-temp-inactivo',
  GANADO: 'text-temp-ganado',
  NUEVO: 'text-ink-3',
}

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
