import type { ReactNode } from 'react'

export type TonoKpi = 'brand' | 'caliente' | 'tibio' | 'frio' | 'neutro'

/** Fondo y color del ícono. Clases literales: Tailwind escanea el fuente. */
const TONOS: Record<TonoKpi, string> = {
  brand: 'bg-brand-soft text-primary',
  caliente: 'bg-hot-soft text-caliente',
  tibio: 'bg-warm-soft text-badge-tibio-ink',
  frio: 'bg-cool-soft text-frio',
  neutro: 'bg-surface-2 text-ink-3',
}

interface CardKpiProps {
  label: string
  /** Ya formateado: la card no sabe de unidades ni de '—'. */
  valor: string
  /** Línea chica debajo del número. */
  contexto?: string
  icono?: ReactNode
  tono?: TonoKpi
}

/** Card de un número. El sparkline llega en la Fase 6b. */
export function CardKpi({ label, valor, contexto, icono, tono = 'brand' }: CardKpiProps) {
  return (
    <article className="flex flex-col rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[0.78rem] font-semibold text-ink-3">{label}</span>
        {icono && (
          <span
            aria-hidden
            className={`grid size-8 shrink-0 place-items-center rounded-[10px] ${TONOS[tono]}`}
          >
            {icono}
          </span>
        )}
      </div>

      <div className="mt-2 text-[1.75rem] leading-none font-bold text-ink tabular-nums">
        {valor}
      </div>

      {contexto && <div className="mt-1.5 text-[0.75rem] text-ink-3">{contexto}</div>}
    </article>
  )
}
