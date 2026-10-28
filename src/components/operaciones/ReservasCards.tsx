import { Link } from 'react-router-dom'
import {
  etiquetaLeadDeOperacion,
  formatearMonto,
  nombreCompleto,
  type ReservaDeMes,
} from '../../lib/api/operaciones'
import { formatearClaveDia } from '../../lib/mes'
import { BadgeEstadoOperacion } from './BadgeEstadoOperacion'
import { BadgeTipoOperacion } from './BadgeTipoOperacion'

interface ReservasCardsProps {
  reservas: ReservaDeMes[]
  conAgente: boolean
}

/** Mismo contenido que la tabla de reservas, en tarjetas. Se usa por debajo de `md`. */
export function ReservasCards({ reservas, conAgente }: ReservasCardsProps) {
  return (
    <ul className="space-y-3">
      {reservas.map((r) => {
        const cliente = nombreCompleto(r.lead)
        const agente = nombreCompleto(r.agente)
        return (
          <li
            key={r.id}
            className="rounded-[14px] border border-border bg-surface p-4 transition-colors hover:border-primary motion-reduce:transition-none"
          >
            <div className="mb-2.5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-1.5">
                <BadgeTipoOperacion tipo={r.tipo} />
                <BadgeEstadoOperacion tipo={r.tipo} estado={r.estado} />
              </div>
              <span className="text-[0.8rem] text-ink-3 tabular-nums">
                {formatearClaveDia(r.fecha_reserva)}
              </span>
            </div>

            <h3 className="m-0 text-[1.05rem] font-extrabold break-words text-ink">
              {r.titulo || 'Sin título'}
            </h3>
            {r.propiedad && (
              <p className="mt-0.5 mb-0 text-[0.82rem] break-words text-ink-3">
                {r.propiedad.direccion}
              </p>
            )}

            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div className="min-w-0">
                <dt className="text-xs text-ink-3">{etiquetaLeadDeOperacion(r.tipo)}</dt>
                <dd className="truncate">
                  {r.lead && cliente ? (
                    <Link to={`/leads/${r.lead.id}`} className="font-semibold text-primary hover:underline">
                      {cliente}
                    </Link>
                  ) : (
                    <span className="text-ink-4">Sin cliente</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-3">Monto</dt>
                <dd className="tabular-nums text-ink-2">{formatearMonto(r.monto, r.moneda)}</dd>
              </div>
              {conAgente && (
                <div className="col-span-2 min-w-0">
                  <dt className="text-xs text-ink-3">Agente</dt>
                  <dd className="truncate text-ink-2">{agente ?? <span className="text-ink-4">—</span>}</dd>
                </div>
              )}
            </dl>

            <Link
              to={`/operaciones/${r.id}`}
              className="mt-4 block min-h-10 w-full rounded-lg border border-border bg-surface p-2.5 text-center font-semibold text-ink transition-colors hover:bg-background motion-reduce:transition-none"
            >
              Ver detalle
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
