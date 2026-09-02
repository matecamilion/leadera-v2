import { Link } from 'react-router-dom'
import { formatearMonto, type OperacionListada } from '../../lib/api/operaciones'
import { formatearFecha } from '../../lib/formatoFecha'
import { BadgeEstadoOperacion } from './BadgeEstadoOperacion'
import { BadgeTipoOperacion } from './BadgeTipoOperacion'
import { VinculoOperacion } from './VinculoOperacion'

/** Mismo contenido que la tabla, en tarjetas. Se usa por debajo de `md`. */
export function OperacionesCards({
  operaciones,
}: {
  operaciones: OperacionListada[]
}) {
  return (
    <ul className="space-y-3">
      {operaciones.map((op) => (
        <li
          key={op.id}
          className="rounded-[14px] border border-border bg-surface p-4 transition-colors hover:border-primary motion-reduce:transition-none"
        >
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              <BadgeTipoOperacion tipo={op.tipo} />
              <BadgeEstadoOperacion estado={op.estado} />
            </div>
            <span className="text-[0.8rem] text-ink-3">
              {formatearFecha(op.created_at)}
            </span>
          </div>

          <h3 className="m-0 text-[1.05rem] font-extrabold text-ink">
            {op.titulo || 'Sin título'}
          </h3>

          <div className="mt-3 rounded-xl border border-border bg-surface-2 px-3.5 py-3 text-sm">
            <p className="text-xs font-semibold text-ink-3 uppercase">Asociado</p>
            <p className="mt-0.5 text-ink-2">
              <VinculoOperacion operacion={op} />
            </p>
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <div className="min-w-0">
              <dt className="text-xs text-ink-3">Lead</dt>
              <dd className="truncate">
                {op.lead ? (
                  <Link
                    to={`/leads/${op.lead.id}`}
                    className="font-semibold text-primary hover:underline"
                  >
                    {op.lead.nombre} {op.lead.apellido ?? ''}
                  </Link>
                ) : (
                  <span className="text-ink-4">—</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-3">Monto</dt>
              <dd className="tabular-nums text-ink-2">
                {formatearMonto(op.monto, op.moneda)}
              </dd>
            </div>
          </dl>

          <Link
            to={`/operaciones/${op.id}`}
            className="mt-4 block w-full rounded-lg border border-border bg-surface p-2.5 text-center font-semibold text-ink transition-colors hover:bg-background motion-reduce:transition-none"
          >
            Ver detalle
          </Link>
        </li>
      ))}
    </ul>
  )
}
