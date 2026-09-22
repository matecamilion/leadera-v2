import { formatearArs, formatearArsCompacto, type MesDeIngreso } from '../../lib/api/admin'

const MES_CORTO = new Intl.DateTimeFormat('es-AR', { month: 'short' })
const MES_LARGO = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' })

/**
 * Cobrado por mes: suma de los pagos aprobados, mes calendario.
 *
 * Barras y no línea: son totales de períodos cerrados, no una magnitud que
 * varía en continuo, y con pocos meses de historia una línea de dos puntos no
 * dice nada. El mes en curso va en un tono más claro porque todavía no cerró.
 *
 * El rango lo decide `ingresosPorMes`; acá no hay ningún número de meses fijo.
 */
export function GraficoIngresos({ meses }: { meses: MesDeIngreso[] }) {
  const maximo = Math.max(0, ...meses.map((m) => m.total))
  const ultimo = meses.length - 1
  const sinDatos = maximo === 0

  return (
    <section
      aria-labelledby="titulo-ingresos"
      className="flex flex-col rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5"
    >
      <h2 id="titulo-ingresos" className="m-0 text-[0.95rem] font-bold text-ink">
        Ingresos por mes
      </h2>
      <p className="mt-0.5 mb-4 text-[0.78rem] text-ink-3">
        Pagos aprobados en ARS, últimos {meses.length} meses. El mes en curso todavía no cerró.
      </p>

      {sinDatos && (
        <p className="m-0 mb-2 text-[0.82rem] text-ink-3">Todavía no hay pagos aprobados en este período.</p>
      )}

      <div aria-hidden className="flex h-48 items-end gap-1.5 sm:gap-2">
        {meses.map((m, i) => {
          const alto = sinDatos ? 0 : (m.total / maximo) * 100
          return (
            <div key={m.clave} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
              {m.total > 0 && (
                <span className="hidden text-[0.68rem] font-semibold whitespace-nowrap text-ink-2 tabular-nums sm:block">
                  {formatearArsCompacto(m.total)}
                </span>
              )}
              <div
                title={`${MES_LARGO.format(m.inicio)}: ${formatearArs(m.total)} (${m.cantidadPagos} pagos)`}
                className={`w-full max-w-10 rounded-t-md ${i === ultimo ? 'bg-primary/45' : 'bg-primary'}`}
                style={{ height: `${alto}%`, minHeight: m.total > 0 ? 3 : 0 }}
              />
            </div>
          )
        })}
      </div>
      <div aria-hidden className="mt-1.5 flex gap-1.5 border-t border-border pt-1.5 sm:gap-2">
        {meses.map((m) => (
          <span key={m.clave} className="min-w-0 flex-1 text-center text-[0.7rem] text-ink-3 capitalize">
            {MES_CORTO.format(m.inicio).replace('.', '')}
          </span>
        ))}
      </div>

      {/* Lo mismo en texto, para lector de pantalla: las barras son sólo forma. */}
      <table className="sr-only">
        <caption>Ingresos por mes</caption>
        <thead>
          <tr>
            <th scope="col">Mes</th>
            <th scope="col">Cobrado</th>
            <th scope="col">Pagos</th>
          </tr>
        </thead>
        <tbody>
          {meses.map((m) => (
            <tr key={m.clave}>
              <th scope="row">{MES_LARGO.format(m.inicio)}</th>
              <td>{formatearArs(m.total)}</td>
              <td>{m.cantidadPagos}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
