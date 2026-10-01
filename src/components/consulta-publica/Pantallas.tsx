import type { ReactNode } from 'react'
import { Tarjeta } from './Marco'

function Estado({
  icono,
  titulo,
  children,
  accion,
}: {
  icono: ReactNode
  titulo: string
  children?: ReactNode
  accion?: ReactNode
}) {
  return (
    <Tarjeta className="mt-6 px-6 py-8 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full">{icono}</div>
      <h1 className="mt-4 text-xl font-semibold tracking-tight text-ink">{titulo}</h1>
      {children && <div className="mt-2 text-[0.95rem] leading-relaxed text-ink-muted">{children}</div>}
      {accion && <div className="mt-6">{accion}</div>}
    </Tarjeta>
  )
}

function Girando({ label }: { label: string }) {
  return (
    <span
      role="status"
      aria-label={label}
      className="block size-7 animate-spin rounded-full border-[3px] border-border border-t-primary motion-reduce:animate-none"
    />
  )
}

function BotonAccion({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-[48px] w-full rounded-md bg-primary px-4 py-3 text-[0.95rem] font-semibold text-primary-contrast transition-colors hover:bg-primary-hover active:bg-primary-active motion-reduce:transition-none"
    >
      {children}
    </button>
  )
}

export function Cargando() {
  return (
    <div className="grid min-h-[60dvh] place-items-center">
      <Girando label="Cargando la consulta" />
    </div>
  )
}

/** También cubre la espera de los 8 s: para quien consulta es lo mismo. */
export function Enviando() {
  return (
    <Estado icono={<Girando label="Enviando tu consulta" />} titulo="Enviando tu consulta…">
      Esto lleva unos segundos.
    </Estado>
  )
}

export function Gracias({ nombre, asesor }: { nombre: string; asesor: string }) {
  return (
    <Estado
      icono={
        <span className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </span>
      }
      titulo={`¡Gracias, ${nombre}!`}
    >
      {asesor} ya recibió tu consulta y te va a contactar a la brevedad.
    </Estado>
  )
}

export function NoDisponible() {
  return (
    <Estado
      icono={
        <span className="flex size-12 items-center justify-center rounded-full bg-surface-2 text-ink-muted">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="12" r="9" />
            <path d="M8 12h8" />
          </svg>
        </span>
      }
      titulo="Este link ya no está disponible"
    >
      Puede que la publicación se haya dado de baja. Si te interesa, contactá directamente a la
      inmobiliaria.
    </Estado>
  )
}

function IconoAlerta() {
  return (
    <span className="flex size-12 items-center justify-center rounded-full bg-warm-soft text-badge-tibio-ink">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7.5v5" />
        <path d="M12 16.2v.3" />
      </svg>
    </span>
  )
}

export function ErrorConReintento({
  titulo,
  texto,
  onReintentar,
}: {
  titulo: string
  texto: string
  onReintentar: () => void
}) {
  return (
    <Estado
      icono={<IconoAlerta />}
      titulo={titulo}
      accion={<BotonAccion onClick={onReintentar}>Reintentar</BotonAccion>}
    >
      {texto}
    </Estado>
  )
}

export function ErrorInvalido({ mensaje, onReiniciar }: { mensaje: string; onReiniciar: () => void }) {
  return (
    <Estado
      icono={<IconoAlerta />}
      titulo="Algo no salió bien"
      accion={<BotonAccion onClick={onReiniciar}>Volver a empezar</BotonAccion>}
    >
      {mensaje}
    </Estado>
  )
}
