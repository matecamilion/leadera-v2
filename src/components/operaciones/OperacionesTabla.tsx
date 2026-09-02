import { Link } from 'react-router-dom'
import { formatearMonto, type OperacionListada } from '../../lib/api/operaciones'
import { formatearFecha } from '../../lib/formatoFecha'
import { BadgeEstadoOperacion } from './BadgeEstadoOperacion'
import { BadgeTipoOperacion } from './BadgeTipoOperacion'
import { VinculoOperacion } from './VinculoOperacion'

const COLUMNAS = ['Título', 'Tipo', 'Estado', 'Lead', 'Asociado', 'Monto', 'Fecha', '']

/** Listado en tabla. Visible de `md` para arriba; abajo van las cards. */
export function OperacionesTabla({
  operaciones,
}: {
  operaciones: OperacionListada[]
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
      <table className="w-full min-w-[62rem] border-collapse text-[0.93rem]">
        <thead className="bg-surface-2">
          <tr>
            {COLUMNAS.map((c, i) => (
              <th
                key={c || i}
                scope="col"
                className={`border-b border-border px-4 py-3 text-xs font-bold tracking-[0.04em] whitespace-nowrap text-ink-2 uppercase ${
                  c === 'Monto' ? 'text-right' : 'text-left'
                }`}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {operaciones.map((op) => (
            <tr
              key={op.id}
              className="border-b border-surface-2 transition-colors last:border-b-0 hover:bg-surface-2 motion-reduce:transition-none"
            >
              <td className="px-4 py-3.5 align-middle font-semibold text-ink">
                {op.titulo || 'Sin título'}
              </td>
              <td className="px-4 py-3.5 align-middle">
                <BadgeTipoOperacion tipo={op.tipo} />
              </td>
              <td className="px-4 py-3.5 align-middle">
                <BadgeEstadoOperacion estado={op.estado} />
              </td>
              <td className="px-4 py-3.5 align-middle">
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
              </td>
              <td className="px-4 py-3.5 align-middle text-ink-2">
                <VinculoOperacion operacion={op} />
              </td>
              <td className="px-4 py-3.5 text-right align-middle tabular-nums text-ink-2">
                {op.monto == null ? (
                  <span className="text-ink-4">—</span>
                ) : (
                  formatearMonto(op.monto, op.moneda)
                )}
              </td>
              <td className="px-4 py-3.5 align-middle whitespace-nowrap text-ink-3">
                {formatearFecha(op.created_at)}
              </td>
              <td className="px-4 py-3.5 align-middle whitespace-nowrap">
                <Link
                  to={`/operaciones/${op.id}`}
                  className="text-[0.88rem] font-semibold text-primary-dark hover:underline"
                >
                  Ver detalle →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
