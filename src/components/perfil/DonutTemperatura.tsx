/** Mismo radio que el original; la circunferencia sale de acá. */
const RADIO = 56
const CIRCUNFERENCIA = 2 * Math.PI * RADIO

interface DonutTemperaturaProps {
  calientes: number
  tibios: number
  frios: number
}

/**
 * Donut de temperatura de la cartera.
 *
 * Cada arco se dibuja con `stroke-dasharray = "<largo> <circunferencia>"` y se
 * corre con un `stroke-dashoffset` negativo igual a lo que ocupan los arcos
 * anteriores, así los tres se encadenan sin superponerse. El SVG va rotado
 * -90° para que el primero arranque arriba y no a las 3 en punto.
 */
export function DonutTemperatura({ calientes, tibios, frios }: DonutTemperaturaProps) {
  const total = calientes + tibios + frios

  const arco = (valor: number) => (total === 0 ? 0 : (valor / total) * CIRCUNFERENCIA)
  const porcentaje = (valor: number) => (total === 0 ? 0 : Math.round((valor / total) * 100))

  const arcoCaliente = arco(calientes)
  const arcoTibio = arco(tibios)
  const arcoFrio = arco(frios)

  const segmentos = [
    { clave: 'caliente', label: 'Caliente', valor: calientes, punto: 'bg-caliente' },
    { clave: 'tibio', label: 'Tibio', valor: tibios, punto: 'bg-tibio' },
    { clave: 'frio', label: 'Frío', valor: frios, punto: 'bg-frio' },
  ]

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <h2 className="m-0 mb-4 text-[0.95rem] font-bold text-ink">Temperatura de leads</h2>

      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-6">
        <div className="relative grid shrink-0 place-items-center">
          <svg viewBox="0 0 140 140" aria-hidden className="size-[140px] -rotate-90">
            <circle
              cx="70"
              cy="70"
              r={RADIO}
              fill="none"
              strokeWidth="14"
              className="stroke-border"
            />
            {total > 0 && (
              <>
                <circle
                  cx="70"
                  cy="70"
                  r={RADIO}
                  fill="none"
                  strokeWidth="14"
                  strokeDasharray={`${arcoCaliente} ${CIRCUNFERENCIA}`}
                  strokeDashoffset={0}
                  className="stroke-caliente"
                />
                <circle
                  cx="70"
                  cy="70"
                  r={RADIO}
                  fill="none"
                  strokeWidth="14"
                  strokeDasharray={`${arcoTibio} ${CIRCUNFERENCIA}`}
                  strokeDashoffset={-arcoCaliente}
                  className="stroke-tibio"
                />
                <circle
                  cx="70"
                  cy="70"
                  r={RADIO}
                  fill="none"
                  strokeWidth="14"
                  strokeDasharray={`${arcoFrio} ${CIRCUNFERENCIA}`}
                  strokeDashoffset={-(arcoCaliente + arcoTibio)}
                  className="stroke-frio"
                />
              </>
            )}
          </svg>

          <div className="absolute text-center">
            <div className="text-[1.6rem] leading-none font-bold text-ink tabular-nums">
              {total}
            </div>
            <div className="mt-0.5 text-[0.7rem] text-ink-3">total</div>
          </div>
        </div>

        <ul className="flex w-full flex-col gap-2.5">
          {segmentos.map((s) => (
            <li key={s.clave} className="flex items-center gap-2.5 text-[0.85rem]">
              <span aria-hidden className={`size-2.5 shrink-0 rounded-full ${s.punto}`} />
              <span className="flex-1 text-ink-2">{s.label}</span>
              <span className="font-semibold text-ink tabular-nums">
                {s.valor} · {porcentaje(s.valor)}%
              </span>
            </li>
          ))}
        </ul>
      </div>

      {total === 0 && (
        <p className="mt-4 text-center text-[0.85rem] text-ink-3">
          Todavía no clasificaste ningún lead por temperatura.
        </p>
      )}
    </section>
  )
}
