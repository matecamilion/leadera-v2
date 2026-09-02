import { etiquetaOrigen } from '../../lib/api/leads'
import type { ConteoOrigen } from '../../lib/api/perfil'

/**
 * ORIGEN_COLORS del original (brand, brand-deep, cool, warm, ink-3, ink-4)
 * mapeado a nuestros tokens. Se asigna por posición, así el origen más usado
 * se queda con el verde de marca.
 */
const COLORES = [
  'bg-primary',
  'bg-primary-dark',
  'bg-frio',
  'bg-tibio',
  'bg-ink-3',
  'bg-ink-4',
]

/**
 * Barras horizontales y no un donut: con 2 o 3 orígenes activos un donut se
 * lee peor que una barra, y acá el nombre de cada origen es largo y necesita
 * su propia línea igual.
 */
export function GraficoOrigenes({ origenes }: { origenes: ConteoOrigen[] }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <header className="mb-4">
        <h2 className="m-0 text-[0.95rem] font-bold text-ink">Origen de tus leads</h2>
        <p className="mt-0.5 text-[0.8rem] text-ink-3">Sobre toda tu cartera</p>
      </header>

      {origenes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-surface-2 px-4 py-6 text-center text-[0.85rem] text-ink-3">
          Todavía no cargaste ningún lead.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {origenes.map((o, i) => (
            <li key={o.origen}>
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <span className="truncate text-[0.85rem] text-ink-2">
                  {etiquetaOrigen(o.origen)}
                </span>
                <span className="shrink-0 text-[0.8rem] font-semibold text-ink tabular-nums">
                  {o.cantidad} · {o.porcentaje}%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                {/* Piso de 2%: un origen con pocos leads redondea a 0% y la
                    barra desaparecería aunque el conteo diga que existe. */}
                <span
                  className={`block h-full rounded-full ${COLORES[i % COLORES.length]}`}
                  style={{ width: `${Math.max(o.porcentaje, 2)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
