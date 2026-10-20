import type { EstadoPropiedad } from '../../lib/api/propiedades'

/**
 * Clases literales, no armadas por template string: Tailwind escanea el
 * fuente y no encontraría `bg-badge-${x}-bg`.
 *
 * DISPONIBLE, RESERVADA y VENDIDA usan los colores del Angular original.
 * ALQUILADA y PAUSADA no existían allá: les asigné azul y naranja para que
 * ninguno de los cinco se confunda con otro.
 */
export const ESTILOS_ESTADO_PROPIEDAD: Record<EstadoPropiedad, string> = {
  DISPONIBLE: 'bg-badge-ganado-bg text-primary',
  RESERVADA: 'bg-badge-tibio-bg text-badge-tibio-ink',
  VENDIDA: 'bg-surface-2 text-inactivo',
  ALQUILADA: 'bg-badge-frio-bg text-frio',
  PAUSADA: 'bg-hot-soft text-caliente',
}
