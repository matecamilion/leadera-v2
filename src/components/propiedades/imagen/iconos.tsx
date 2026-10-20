import type { ReactNode } from 'react'
import type { ClaveIcono } from './tipos'

/** Lineal, trazo uniforme y sin relleno: heredan el color con `currentColor`. */
function Base({ tamano, children }: { tamano: number; children: ReactNode }) {
  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ display: 'block' }}
    >
      {children}
    </svg>
  )
}

type Props = { tamano: number }

/** Plano con habitaciones. */
export function IconoAmbientes({ tamano }: Props) {
  return (
    <Base tamano={tamano}>
      <rect x="3" y="3" width="18" height="18" rx="1.5" />
      <path d="M10 3v7M3 10h7M14 21v-6M14 15h7" />
    </Base>
  )
}

/** Cama. */
export function IconoDormitorios({ tamano }: Props) {
  return (
    <Base tamano={tamano}>
      <path d="M3 6v13M3 15h18v4M21 15v-3a3 3 0 0 0-3-3h-8v6" />
      <circle cx="6.5" cy="11.5" r="1.8" />
    </Base>
  )
}

/** Ducha. */
export function IconoBanos({ tamano }: Props) {
  return (
    <Base tamano={tamano}>
      <path d="M4 21V7a3 3 0 0 1 3-3h9v1" />
      <path d="M12 9a4 4 0 0 1 8 0z" />
      <path d="M12.5 12.5v2M16 12.5v4M19.5 12.5v2" />
    </Base>
  )
}

/** Casa. */
export function IconoM2Cubiertos({ tamano }: Props) {
  return (
    <Base tamano={tamano}>
      <path d="M3 11l9-8 9 8M5 9.5V21h14V9.5M10 21v-6h4v6" />
    </Base>
  )
}

/** Cuadrado con flechas hacia afuera en las esquinas. */
export function IconoM2Terreno({ tamano }: Props) {
  return (
    <Base tamano={tamano}>
      <rect x="7" y="7" width="10" height="10" />
      <path d="M3 9V3h6M3 3l4 4M21 9V3h-6M21 3l-4 4M3 15v6h6M3 21l4-4M21 15v6h-6M21 21l-4-4" />
    </Base>
  )
}

/** Auto. */
export function IconoCocheras({ tamano }: Props) {
  return (
    <Base tamano={tamano}>
      <path d="M5 15l1.6-5.2a2 2 0 0 1 1.9-1.3h7a2 2 0 0 1 1.9 1.3L19 15" />
      <rect x="3" y="15" width="18" height="4" rx="1.5" />
      <path d="M7 19v1.5M17 19v1.5M6.5 17h.01M17.5 17h.01" />
    </Base>
  )
}

/** Árbol. */
export function IconoParque({ tamano }: Props) {
  return (
    <Base tamano={tamano}>
      <path d="M12 3a5 5 0 0 0-4.6 7A4 4 0 0 0 8 15h8a4 4 0 0 0 .6-5A5 5 0 0 0 12 3z" />
      <path d="M12 15v6M9 21h6" />
    </Base>
  )
}

/** Olas. */
export function IconoPileta({ tamano }: Props) {
  return (
    <Base tamano={tamano}>
      <path d="M3 8c1.5-1.5 3-1.5 4.5 0s3 1.5 4.5 0 3-1.5 4.5 0 3 1.5 4.5 0" />
      <path d="M3 13c1.5-1.5 3-1.5 4.5 0s3 1.5 4.5 0 3-1.5 4.5 0 3 1.5 4.5 0" />
      <path d="M3 18c1.5-1.5 3-1.5 4.5 0s3 1.5 4.5 0 3-1.5 4.5 0 3 1.5 4.5 0" />
    </Base>
  )
}

/** Llama. */
export function IconoParrilla({ tamano }: Props) {
  return (
    <Base tamano={tamano}>
      <path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5.3 1.3 1 2 2 2.5C10.5 8 11 5.5 12 3z" />
      <path d="M12 21a2.5 2.5 0 0 1-2.5-2.5c0-1.5 1.5-2 2.5-3.5 1 1.5 2.5 2 2.5 3.5A2.5 2.5 0 0 1 12 21z" />
    </Base>
  )
}

/** El ícono de un dato según su clave. "Sin ícono" no dibuja nada. */
export function IconoDato({ clave, tamano }: { clave: ClaveIcono; tamano: number }) {
  switch (clave) {
    case 'ambientes':
      return <IconoAmbientes tamano={tamano} />
    case 'dormitorios':
      return <IconoDormitorios tamano={tamano} />
    case 'banos':
      return <IconoBanos tamano={tamano} />
    case 'm2_cubiertos':
      return <IconoM2Cubiertos tamano={tamano} />
    case 'm2_terreno':
      return <IconoM2Terreno tamano={tamano} />
    case 'cocheras':
      return <IconoCocheras tamano={tamano} />
    case 'parque':
      return <IconoParque tamano={tamano} />
    case 'pileta':
      return <IconoPileta tamano={tamano} />
    case 'parrilla':
      return <IconoParrilla tamano={tamano} />
    case 'ninguno':
      return null
  }
}
