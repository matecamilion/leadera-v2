import type { TotalPorMoneda } from '../../lib/api/perfil'

const MONTOS = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 })

/**
 * Valor de las operaciones que todavía están en juego (publicadas, reservadas
 * o en negociación). Un total por moneda: sumar USD con ARS daría un número
 * sin significado, mismo criterio que en el Kanban.
 */
export function PipelineAbierto({ totales }: { totales: TotalPorMoneda[] }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <header className="mb-3">
        <h2 className="m-0 text-[0.95rem] font-bold text-ink">Pipeline abierto</h2>
        <p className="mt-0.5 text-[0.8rem] text-ink-3">
          Publicadas, reservadas y en negociación
        </p>
      </header>

      {totales.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-surface-2 px-4 py-6 text-center text-[0.85rem] text-ink-3">
          No tenés operaciones abiertas con monto cargado.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {totales.map((t) => (
            <li key={t.moneda} className="flex items-baseline gap-2">
              <span className="text-[0.85rem] font-semibold text-ink-3">{t.moneda}</span>
              <span className="text-[1.6rem] leading-none font-bold text-ink tabular-nums">
                {MONTOS.format(t.total)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
