import { DETALLE_PLAN, PLANES, type Plan } from '../../lib/api/suscripcion'

/**
 * Cuentas por plan, en barras horizontales. Barras y no torta: con tres o
 * cuatro categorías de tamaños parecidos, los largos se comparan a ojo y los
 * ángulos no.
 *
 * Cuenta todas las cuentas, en cualquier estado. "Sin plan" sólo aparece si
 * hay alguna: es la que se registró sin elegir uno.
 */
export function GraficoPlanes({ conteo }: { conteo: Map<Plan | null, number> }) {
  const filas: { clave: string; label: string; cantidad: number }[] = PLANES.map((p) => ({
    clave: p,
    label: DETALLE_PLAN[p].nombre,
    cantidad: conteo.get(p) ?? 0,
  }))
  const sinPlan = conteo.get(null) ?? 0
  if (sinPlan > 0) filas.push({ clave: 'sin-plan', label: 'Sin plan', cantidad: sinPlan })

  const total = filas.reduce((s, f) => s + f.cantidad, 0)
  const maximo = Math.max(1, ...filas.map((f) => f.cantidad))

  return (
    <section
      aria-labelledby="titulo-planes"
      className="flex flex-col rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5"
    >
      <h2 id="titulo-planes" className="m-0 text-[0.95rem] font-bold text-ink">
        Cuentas por plan
      </h2>
      <p className="mt-0.5 mb-4 text-[0.78rem] text-ink-3">Todas las cuentas, en cualquier estado.</p>

      <ul className="m-0 flex list-none flex-col gap-4 p-0">
        {filas.map((f) => (
          <li key={f.clave}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[0.82rem]">
              <span className={`font-semibold ${f.clave === 'sin-plan' ? 'text-ink-3' : 'text-ink-2'}`}>
                {f.label}
              </span>
              <span className="text-ink-3 tabular-nums">
                <strong className="text-ink">{f.cantidad}</strong>
                {total > 0 && ` · ${Math.round((f.cantidad / total) * 100)}%`}
              </span>
            </div>
            <div aria-hidden className="h-2.5 overflow-hidden rounded-full bg-surface-2">
              <div
                className={`h-full rounded-full ${f.clave === 'sin-plan' ? 'bg-ink-4' : 'bg-primary'}`}
                style={{ width: `${(f.cantidad / maximo) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
