import { etiquetaEstado, type EstadoPropiedad } from '../../lib/api/propiedades'

/**
 * Clases literales, no armadas por template string: Tailwind escanea el
 * fuente y no encontraría `bg-badge-${x}-bg`.
 *
 * DISPONIBLE, RESERVADA y VENDIDA usan los colores del Angular original.
 * ALQUILADA y PAUSADA no existían allá: les asigné azul y naranja para que
 * ninguno de los cinco se confunda con otro.
 */
const ESTILOS: Record<EstadoPropiedad, string> = {
  DISPONIBLE: 'bg-badge-ganado-bg text-primary',
  RESERVADA: 'bg-badge-tibio-bg text-badge-tibio-ink',
  VENDIDA: 'bg-surface-2 text-inactivo',
  ALQUILADA: 'bg-badge-frio-bg text-frio',
  PAUSADA: 'bg-hot-soft text-caliente',
}

export function BadgeEstadoPropiedad({ estado }: { estado: EstadoPropiedad }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-[3px] text-[0.72rem] font-bold uppercase ${ESTILOS[estado]}`}
    >
      {etiquetaEstado(estado)}
    </span>
  )
}
