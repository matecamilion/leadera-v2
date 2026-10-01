import type { ReactNode } from 'react'
import { URL_LEADERA } from './catalogo'

interface Asesor {
  nombre: string
  apellido: string
}

function iniciales({ nombre, apellido }: Asesor): string {
  return `${nombre.trim().charAt(0)}${apellido.trim().charAt(0)}`.toUpperCase()
}

/** El asesor es el protagonista: quien consulta le escribe a una persona, no a un sistema. */
export function Encabezado({ asesor, inmobiliaria }: { asesor: Asesor; inmobiliaria: string }) {
  return (
    <header className="flex items-center gap-3">
      <span
        aria-hidden
        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-[0.95rem] font-semibold tracking-wide text-primary-contrast"
      >
        {iniciales(asesor)}
      </span>
      <div className="min-w-0">
        <p className="truncate text-[0.95rem] font-semibold text-ink">
          {asesor.nombre} {asesor.apellido}
        </p>
        <p className="truncate text-sm text-ink-muted">{inmobiliaria}</p>
      </div>
    </header>
  )
}

/** Barra de progreso de la encuesta. */
export function Progreso({ actual, total }: { actual: number; total: number }) {
  const pct = Math.round((actual / total) * 100)
  return (
    <div
      role="progressbar"
      aria-label="Progreso de la consulta"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={actual}
      aria-valuetext={`Paso ${actual} de ${total}`}
      className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted"
    >
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out motion-reduce:transition-none"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

/** Pie discreto: la herramienta no compite con el asesor. */
export function Pie() {
  return (
    <footer className="mt-8 pb-2 text-center">
      <a
        href={URL_LEADERA}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-sm text-xs text-ink-subtle transition-colors hover:text-ink-muted motion-reduce:transition-none"
      >
        <svg width="12" height="12" viewBox="0 0 48 48" aria-hidden className="shrink-0">
          <g transform="rotate(45 24 24)" fill="currentColor">
            <path d="M9 12.5 A3.5 3.5 0 0 1 12.5 9 H22 V22 H9 Z" />
            <path d="M9 26 H22 V39 H12.5 A3.5 3.5 0 0 1 9 35.5 Z" />
            <path d="M26 26 H35.5 A3.5 3.5 0 0 1 39 29.5 V39 H26 Z" />
            <path d="M26 9 H35.5 A3.5 3.5 0 0 1 39 12.5 V22 H26 Z" opacity="0.32" />
          </g>
        </svg>
        Consultas con LeadEra
      </a>
    </footer>
  )
}

/** Columna única, mobile first; en desktop queda centrada y angosta. */
export function Marco({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-background">
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pt-5 pb-4 sm:pt-10">
        <div className="flex-1">{children}</div>
        <Pie />
      </main>
    </div>
  )
}

/** Tarjeta blanca del contenido. */
export function Tarjeta({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-lg bg-surface p-5 shadow-card ${className}`}>{children}</div>
}
