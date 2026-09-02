import { Link } from 'react-router-dom'

export type VarianteResumen = 'calientes' | 'nuevos' | 'seguimientos'

/**
 * Color del número, igual que `.resumen-card.X .resumen-numero` del original.
 * Clases literales: Tailwind escanea el fuente y no resolvería `text-${x}`.
 */
const NUMERO: Record<VarianteResumen, string> = {
  calientes: 'text-caliente',
  nuevos: 'text-primary',
  seguimientos: 'text-tibio',
}

/** Filete superior, para que las tres cards se distingan de un vistazo. */
const FILETE: Record<VarianteResumen, string> = {
  calientes: 'bg-caliente',
  nuevos: 'bg-primary',
  seguimientos: 'bg-tibio',
}

interface CardResumenProps {
  variante: VarianteResumen
  numero: number
  label: string
  /** A dónde lleva el click. */
  a: string
  /** Se lee después del número: "12 leads calientes". */
  descripcion: string
}

export function CardResumen({ variante, numero, label, a, descripcion }: CardResumenProps) {
  return (
    <Link
      to={a}
      aria-label={`${numero} ${descripcion}`}
      className="relative flex min-w-0 flex-col gap-1 overflow-hidden rounded-[14px] bg-surface px-3.5 pt-[18px] pb-3.5 shadow-md transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:px-5"
    >
      <span aria-hidden className={`absolute inset-x-0 top-0 h-1 ${FILETE[variante]}`} />

      <span
        className={`text-[1.6rem] leading-none font-bold tabular-nums sm:text-[2rem] ${NUMERO[variante]}`}
      >
        {numero}
      </span>
      {/* "PRIORITARIOS" es una sola palabra sin punto de corte: en una columna
          de ~96px se desbordaba de la card, así que achica antes del breakpoint. */}
      <span className="text-[0.6rem] font-bold tracking-[0.03em] text-ink-3 uppercase sm:text-[0.7rem] sm:tracking-[0.06em]">
        {label}
      </span>
    </Link>
  )
}
