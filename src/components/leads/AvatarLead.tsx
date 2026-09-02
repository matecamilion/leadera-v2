import type { EstadoLead } from '../../lib/api/leads'

type Clave = EstadoLead | 'NUEVO'

/**
 * Colores de `.av-*` del Angular. El original mandaba todo lo que no fuera
 * caliente/tibio/frío a `av-inactivo`; acá separamos NUEVO (estado null) con
 * los tokens de marca, igual que hace BadgeEstado.
 */
const FONDOS: Record<Clave, string> = {
  CALIENTE: 'bg-badge-caliente-bg text-caliente',
  TIBIO: 'bg-badge-tibio-bg text-badge-tibio-ink',
  FRIO: 'bg-badge-frio-bg text-frio',
  GANADO: 'bg-badge-ganado-bg text-primary-dark',
  INACTIVO: 'bg-surface-2 text-inactivo',
  NUEVO: 'bg-brand-soft text-primary',
}

interface AvatarLeadProps {
  nombre: string
  apellido: string | null
  estado: EstadoLead | null
  className?: string
}

export function AvatarLead({ nombre, apellido, estado, className = '' }: AvatarLeadProps) {
  const iniciales = `${nombre?.charAt(0) ?? ''}${apellido?.charAt(0) ?? ''}`.toUpperCase()

  return (
    <span
      aria-hidden
      className={`flex size-[58px] shrink-0 items-center justify-center rounded-full text-xl font-bold ${FONDOS[estado ?? 'NUEVO']} ${className}`}
    >
      {iniciales || '—'}
    </span>
  )
}
