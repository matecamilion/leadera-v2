/**
 * Íconos del listado de leads.
 *
 * El Angular usa Material Symbols como webfont. Acá van como SVG inline con
 * los mismos glifos: evita una dependencia externa y, sobre todo, que la PWA
 * dependa de fonts.googleapis.com para renderizar la pantalla offline.
 * Trazo 1.5 para acercarse al 'wght' 300 del original.
 */
type Props = { className?: string }

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

export function IconoLupa({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
}

export function IconoMas({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function IconoTabla({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9.5h18M9 9.5V20" />
    </svg>
  )
}

export function IconoTacho({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M4 7h16M10 4h4M6 7l1 13h10l1-13" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  )
}

export function IconoTelefono({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M6.5 3h3l1.5 4-2 1.5a12 12 0 0 0 5.5 5.5L16 12l4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4 6.2 2 2 0 0 1 6 4z" />
    </svg>
  )
}

export function IconoMail({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.5 6.5 8.5 6 8.5-6" />
    </svg>
  )
}

export function IconoReloj({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 1.8" />
    </svg>
  )
}

export function IconoChat({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M20 12a7.5 7.5 0 0 1-11 6.6L4 20l1.4-4.2A7.5 7.5 0 1 1 20 12z" />
    </svg>
  )
}

export function IconoAlerta({ className }: Props) {
  return (
    <svg {...base} className={className} strokeWidth={1.75}>
      <path d="M12 4.5 2.8 20h18.4z" />
      <path d="M12 10v4.5M12 17.5h.01" />
    </svg>
  )
}

// --- Fase 4a-ii: alta y detalle ---------------------------------------------

export function IconoPersonaMas({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <circle cx="10" cy="8" r="3.5" />
      <path d="M3.5 20v-1a5 5 0 0 1 5-5h3" />
      <path d="M17 14v6M14 17h6" />
    </svg>
  )
}

export function IconoLapiz({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z" />
      <path d="M15 6l3 3" />
    </svg>
  )
}

export function IconoCalendario({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 10h17M8 3.5v3M16 3.5v3" />
    </svg>
  )
}

export function IconoLink({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M10 13.5a4 4 0 0 0 5.7.4l2.6-2.6a4 4 0 0 0-5.7-5.7l-1.5 1.5" />
      <path d="M14 10.5a4 4 0 0 0-5.7-.4l-2.6 2.6a4 4 0 0 0 5.7 5.7l1.5-1.5" />
    </svg>
  )
}

/** local_fire_department — CALIENTE */
export function IconoFuego({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M12 3s5 4.2 5 8.6a5 5 0 0 1-10 0C7 9.5 9 7.6 9 7.6s.6 2 1.7 2C11.6 9.6 12 6.6 12 3z" />
    </svg>
  )
}

/** device_thermostat — TIBIO */
export function IconoTermometro({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M10 13.6V5.5a2 2 0 1 1 4 0v8.1a4 4 0 1 1-4 0z" />
    </svg>
  )
}

/** ac_unit — FRÍO */
export function IconoCopo({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9" />
    </svg>
  )
}

/** skull — INACTIVO */
export function IconoCalavera({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M12 3a7.5 7.5 0 0 0-4.5 13.5V19a1.5 1.5 0 0 0 1.5 1.5h6A1.5 1.5 0 0 0 16.5 19v-2.5A7.5 7.5 0 0 0 12 3z" />
      <circle cx="9.3" cy="11.5" r="1.3" />
      <circle cx="14.7" cy="11.5" r="1.3" />
    </svg>
  )
}

export function IconoCerrar({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

/** workspaces — estado vacío de Operaciones */
export function IconoCajas({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="6.5" r="3" />
      <circle cx="6.5" cy="16" r="3" />
      <circle cx="17.5" cy="16" r="3" />
    </svg>
  )
}

/** home — estado vacío de Propiedades */
export function IconoCasa({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20h14V9.5" />
    </svg>
  )
}

// --- Fase 4a-iii: interacciones -------------------------------------------

/** groups — REUNION */
export function IconoUsuarios({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20v-1a4.5 4.5 0 0 1 4.5-4.5h3A4.5 4.5 0 0 1 15 19v1" />
      <path d="M16.5 5.2a3.2 3.2 0 0 1 0 5.6M17.5 14.6A4.5 4.5 0 0 1 21 19v1" />
    </svg>
  )
}

/** forum — estado vacío del timeline */
export function IconoConversacion({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M8 14H5.5A1.5 1.5 0 0 1 4 12.5v-6A1.5 1.5 0 0 1 5.5 5h9A1.5 1.5 0 0 1 16 6.5V9" />
      <path d="M9.5 10h9a1.5 1.5 0 0 1 1.5 1.5v6a1.5 1.5 0 0 1-1.5 1.5H13l-3.5 2.5V19h-.5A1.5 1.5 0 0 1 8 17.5v-6A1.5 1.5 0 0 1 9.5 10z" />
    </svg>
  )
}

/** arrow_back — volver */
export function IconoFlechaAtras({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </svg>
  )
}

/** check — pasos completados del stepper */
export function IconoCheck({ className }: Props) {
  return (
    <svg {...base} className={className} strokeWidth={2.5}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  )
}
