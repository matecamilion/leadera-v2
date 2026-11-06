import type { ReactNode } from 'react'

/** Encabezado de la sección y sus filas, separadas por líneas finas. */
export function BloqueSeccion({
  titulo,
  descripcion,
  children,
  pie,
}: {
  titulo: string
  descripcion: string
  children: ReactNode
  /** Lo que va abajo de las filas: botones de guardar, avisos. */
  pie?: ReactNode
}) {
  return (
    <section>
      <header className="mb-2">
        <h2 className="m-0 text-[1.1rem] font-bold text-ink">{titulo}</h2>
        <p className="mt-1 mb-0 text-[0.88rem] text-ink-3">{descripcion}</p>
      </header>
      <div className="divide-y divide-border border-b border-border">{children}</div>
      {pie && <div className="mt-5">{pie}</div>}
    </section>
  )
}

/**
 * Un ajuste: qué es y qué implica a la izquierda, el control a la derecha. En
 * mobile, el control baja abajo del texto.
 */
export function FilaAjuste({
  titulo,
  descripcion,
  htmlFor,
  children,
}: {
  titulo: string
  descripcion?: ReactNode
  /** Si el control es un input, el título hace de label. */
  htmlFor?: string
  children: ReactNode
}) {
  const Titulo = htmlFor ? 'label' : 'p'
  return (
    <div className="grid gap-x-8 gap-y-3 py-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] sm:items-center">
      <div className="min-w-0">
        <Titulo
          {...(htmlFor ? { htmlFor } : {})}
          className="m-0 block text-[0.9rem] font-semibold text-ink"
        >
          {titulo}
        </Titulo>
        {descripcion && (
          <p className="mt-1 mb-0 text-[0.84rem] leading-relaxed text-ink-3">{descripcion}</p>
        )}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

/**
 * El switch de prender y apagar, con la misma forma en todas partes. La
 * perilla es `bg-surface` y no blanca fija: en claro es blanca igual, y en
 * oscuro contrasta con el verde claro del modo oscuro.
 */
export function Interruptor({
  encendido,
  etiqueta,
  deshabilitado = false,
  onAlternar,
}: {
  encendido: boolean
  /** Lo que lee un lector de pantalla: el switch no tiene texto propio. */
  etiqueta: string
  deshabilitado?: boolean
  onAlternar: () => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={encendido}
      aria-label={etiqueta}
      onClick={onAlternar}
      disabled={deshabilitado}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none ${
        encendido ? 'bg-primary' : 'bg-ink-4'
      }`}
    >
      <span
        aria-hidden
        className={`inline-block size-5 rounded-full bg-surface shadow-sm transition-transform motion-reduce:transition-none ${
          encendido ? 'translate-x-[22px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}
