import type { EstadoSuscripcion } from '../../lib/api/suscripcion'
import { ESTADOS, ETIQUETA_ESTADO } from '../../lib/api/admin'
import { SOLIDO_ESTADO } from './estilosEstado'

/**
 * Cuentas por estado: una barra apilada con la proporción y, abajo, el número
 * de cada uno. La barra da la foto de un vistazo; los números son el dato.
 */
export function DistribucionEstados({
  conteo,
}: {
  conteo: Record<EstadoSuscripcion, number>
}) {
  const total = ESTADOS.reduce((suma, e) => suma + conteo[e], 0)

  return (
    <section
      aria-labelledby="titulo-estados"
      className="rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="titulo-estados" className="m-0 text-[0.95rem] font-bold text-ink">
          Cuentas por estado
        </h2>
        <span className="text-[0.82rem] text-ink-3 tabular-nums">{total} en total</span>
      </div>

      {total > 0 && (
        <div aria-hidden className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-surface-2">
          {ESTADOS.filter((e) => conteo[e] > 0).map((e) => (
            <div
              key={e}
              className={SOLIDO_ESTADO[e]}
              style={{ width: `${(conteo[e] / total) * 100}%` }}
            />
          ))}
        </div>
      )}

      <ul className="m-0 mt-4 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-5">
        {ESTADOS.map((e) => (
          <li key={e} className="flex flex-col gap-0.5">
            <span className="flex items-center gap-1.5 text-[0.78rem] font-semibold text-ink-3">
              <span aria-hidden className={`size-2 rounded-full ${SOLIDO_ESTADO[e]}`} />
              {ETIQUETA_ESTADO[e]}
            </span>
            <span
              className={`text-[1.4rem] leading-none font-bold tabular-nums ${
                e === 'GRACIA' && conteo[e] > 0 ? 'text-peligro-ink' : 'text-ink'
              }`}
            >
              {conteo[e]}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
