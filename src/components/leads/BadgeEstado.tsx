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

export function BadgeEstado({ estado }: { estado: EstadoLead | null }) {
  const clave: Clave = estado ?? 'NUEVO'

  return (
    <span
      className={`inline-block rounded-sm px-2.5 py-1 text-[10px] font-bold uppercase ${ESTILOS[clave]}`}
    >
      {clave}
    </span>
  )
}
