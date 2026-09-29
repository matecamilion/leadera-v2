/** Mismo radio que el original; la circunferencia sale de acá. */
const RADIO = 56
const CIRCUNFERENCIA = 2 * Math.PI * RADIO

interface DonutTemperaturaProps {
  calientes: number
  tibios: number
  frios: number
  /**
   * Leads activos sin temperatura todavía (`estado` null). Sin este segmento
   * el total del donut no coincidía con "Leads activos". En 0 no se dibuja.
   */
  sinClasificar?: number
}

/**
 * Donut de temperatura de la cartera.
 *
 * Cada arco se dibuja con `stroke-dasharray = "<largo> <circunferencia>"` y se
 * corre con un `stroke-dashoffset` negativo igual a lo que ocupan los arcos
 * anteriores, así se encadenan sin superponerse. El SVG va rotado -90° para
 * que el primero arranque arriba y no a las 3 en punto.
 */
export function DonutTemperatura({
  calientes,
  tibios,
  frios,
  sinClasificar = 0,
}: DonutTemperaturaProps) {
  const clasificados = calientes + tibios + frios
  const total = clasificados + sinClasificar

  const arco = (valor: number) => (total === 0 ? 0 : (valor / total) * CIRCUNFERENCIA)
  const porcentaje = (valor: number) => (total === 0 ? 0 : Math.round((valor / total) * 100))

  // "Sin clasificar" va último y en gris: es lo que falta ordenar, no una
  // temperatura más, y no tiene que competir con los tres colores.
  const segmentos = [
    { clave: 'caliente', label: 'Caliente', valor: calientes, punto: 'bg-caliente', trazo: 'stroke-caliente' },
    { clave: 'tibio', label: 'Tibio', valor: tibios, punto: 'bg-tibio', trazo: 'stroke-tibio' },
    { clave: 'frio', label: 'Frío', valor: frios, punto: 'bg-frio', trazo: 'stroke-frio' },
    ...(sinClasificar > 0
      ? [
          {
            clave: 'sin-clasificar',
            label: 'Sin clasificar',
            valor: sinClasificar,
            punto: 'bg-ink-4',
            trazo: 'stroke-ink-4',
          },
        ]
      : []),
  ]

  // Offset de cada arco: lo que ya ocuparon los anteriores.
  let recorrido = 0
  const arcos = segmentos.map((s) => {
    const largo = arco(s.valor)
    const offset = recorrido
    recorrido += largo
    return { clave: s.clave, trazo: s.trazo, largo, offset }
  })

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
            {total > 0 &&
              arcos.map((a) => (
                <circle
                  key={a.clave}
                  cx="70"
                  cy="70"
                  r={RADIO}
                  fill="none"
                  strokeWidth="14"
                  strokeDasharray={`${a.largo} ${CIRCUNFERENCIA}`}
                  strokeDashoffset={-a.offset}
                  className={a.trazo}
                />
              ))}
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

      {clasificados === 0 && (
        <p className="mt-4 text-center text-[0.85rem] text-ink-3">
          Todavía no clasificaste ningún lead por temperatura.
        </p>
      )}
    </section>
  )
}
