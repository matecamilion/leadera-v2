import type { ReactNode } from 'react'

type Tono = 'brand' | 'neutro' | 'aviso' | 'error'

const TONOS: Record<Tono, string> = {
  brand: 'text-primary',
  neutro: 'text-ink',
  aviso: 'text-badge-tibio-ink',
  error: 'text-peligro-ink',
}

interface TarjetaConteoProps {
  valor: number
  titulo: string
  subtexto?: string
  tono?: Tono
  children?: ReactNode
}

/** Un conteo grande. Con valor 0 se atenúa: no hay nada que mirar ahí. */
export function TarjetaConteo({ valor, titulo, subtexto, tono = 'neutro', children }: TarjetaConteoProps) {
  return (
    <div
      className={`min-w-0 rounded-2xl border border-border bg-surface p-3.5 ${valor === 0 ? 'opacity-60' : ''}`}
    >
      <p className={`m-0 text-[1.75rem] leading-none font-bold tabular-nums ${valor === 0 ? 'text-ink-3' : TONOS[tono]}`}>
        {valor.toLocaleString('es-AR')}
      </p>
      <p className="mt-1.5 mb-0 text-[0.85rem] font-semibold text-ink">{titulo}</p>
      {subtexto && <p className="mt-1 mb-0 text-xs text-ink-3">{subtexto}</p>}
      {children}
    </div>
  )
}
