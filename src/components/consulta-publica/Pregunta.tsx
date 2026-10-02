import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import type { Opcion } from './catalogo'

/**
 * Marco de una pregunta: Atrás, título y contenido.
 *
 * El título recibe el foco al montarse (cada paso se monta con su propia
 * `key`), así quien usa lector de pantalla oye la pregunta nueva sin tener que
 * buscarla.
 */
export function Pregunta({
  titulo,
  ayuda,
  onAtras,
  children,
}: {
  titulo: string
  ayuda?: string
  onAtras?: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    ref.current?.focus()
  }, [])

  return (
    <section>
      {onAtras && (
        <button
          type="button"
          onClick={onAtras}
          className="-ml-1 mb-3 inline-flex items-center gap-1 rounded-sm px-1 py-1 text-sm font-medium text-ink-muted transition-colors hover:text-ink motion-reduce:transition-none"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Atrás
        </button>
      )}
      <h1
        ref={ref}
        tabIndex={-1}
        className="text-[1.35rem] leading-snug font-semibold tracking-tight text-ink focus:outline-none"
      >
        {titulo}
      </h1>
      {ayuda && <p className="mt-1.5 text-sm text-ink-muted">{ayuda}</p>}
      <div className="mt-5">{children}</div>
    </section>
  )
}

/** Opción única: tocar elige y avanza. Botones y no radios, para que las flechas no avancen solas. */
export function ListaOpciones<T extends string>({
  opciones,
  elegida,
  onElegir,
}: {
  opciones: Opcion<T>[]
  elegida: T | undefined
  onElegir: (valor: T) => void
}) {
  return (
    <ul className="flex flex-col gap-2.5">
      {opciones.map((o) => {
        const activa = o.valor === elegida
        return (
          <li key={o.valor}>
            <button
              type="button"
              aria-pressed={activa}
              onClick={() => onElegir(o.valor)}
              className={[
                'flex min-h-[52px] w-full items-center justify-between gap-3 rounded-md border px-4 py-3 text-left text-[0.95rem] font-medium',
                'transition-colors motion-reduce:transition-none',
                activa
                  ? 'border-primary bg-primary-soft text-primary-dark'
                  : 'border-border bg-surface text-ink hover:border-primary/50 active:bg-surface-muted',
              ].join(' ')}
            >
              <span>{o.label}</span>
              {activa && (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/** La zona es opcional: se puede escribir o seguir sin preferencia. */
export function CampoZona({
  inicial,
  onContinuar,
}: {
  inicial: string
  onContinuar: (zona: string) => void
}) {
  const [zona, setZona] = useState(inicial)

  function enviar(e: FormEvent) {
    e.preventDefault()
    onContinuar(zona.trim().slice(0, 60))
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-3">
      <label htmlFor="zona" className="sr-only">
        Zona o barrio
      </label>
      <input
        id="zona"
        value={zona}
        onChange={(e) => setZona(e.target.value)}
        maxLength={60}
        autoComplete="off"
        placeholder="Ej.: Centro, Güemes, Los Troncos"
        className="block w-full rounded-md border border-border bg-surface px-3.5 py-3 text-base text-ink placeholder:text-ink-subtle hover:border-ink-subtle focus:border-primary focus:outline-2 focus:outline-offset-0 focus:outline-primary"
      />
      <button
        type="submit"
        className="min-h-[48px] w-full rounded-md bg-primary px-4 py-3 text-[0.95rem] font-semibold text-primary-contrast transition-colors hover:bg-primary-hover active:bg-primary-active motion-reduce:transition-none"
      >
        {zona.trim() ? 'Continuar' : 'No tengo preferencia'}
      </button>
    </form>
  )
}

/**
 * Pesos o dólares, arriba de los rangos de un alquiler: hoy conviven los dos
 * mercados y cada uno lo piensa en su moneda.
 */
export function SelectorMoneda({
  valor,
  onCambiar,
}: {
  valor: 'ARS' | 'USD'
  onCambiar: (moneda: 'ARS' | 'USD') => void
}) {
  return (
    <div role="group" aria-label="Moneda" className="mb-4 inline-flex rounded-lg bg-surface-muted p-1">
      {(['ARS', 'USD'] as const).map((m) => {
        const activa = valor === m
        return (
          <button
            key={m}
            type="button"
            aria-pressed={activa}
            onClick={() => onCambiar(m)}
            className={[
              'min-h-[40px] min-w-[96px] rounded-md px-4 text-[0.9rem] font-semibold transition-colors motion-reduce:transition-none',
              activa ? 'bg-surface text-primary-dark shadow-sm' : 'text-ink-3 hover:text-ink',
            ].join(' ')}
          >
            {m === 'ARS' ? 'Pesos' : 'Dólares'}
          </button>
        )
      })}
    </div>
  )
}
