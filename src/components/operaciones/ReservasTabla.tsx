import { Link, useNavigate } from 'react-router-dom'
import {
  etiquetaLeadDeOperacion,
  formatearMonto,
  nombreCompleto,
  type ReservaDeMes,
} from '../../lib/api/operaciones'
import { formatearClaveDia } from '../../lib/mes'
import { BadgeEstadoOperacion } from './BadgeEstadoOperacion'
import { BadgeTipoOperacion } from './BadgeTipoOperacion'

interface ReservasTablaProps {
  reservas: ReservaDeMes[]
  /** La columna Agente sólo tiene sentido cuando el mes tiene más de uno. */
  conAgente: boolean
}

/** Reservas de un mes en tabla. Visible de `md` para arriba; abajo van las cards. */
export function ReservasTabla({ reservas, conAgente }: ReservasTablaProps) {
  const navigate = useNavigate()
  const columnas = ['Fecha', 'Título', 'Tipo', 'Cliente', 'Monto', 'Estado', ...(conAgente ? ['Agente'] : [])]

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
      <table className="w-full min-w-[52rem] border-collapse text-[0.93rem]">
        <thead className="bg-surface-2">
          <tr>
            {columnas.map((c) => (
              <th
                key={c}
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
          {reservas.map((r) => {
            const cliente = nombreCompleto(r.lead)
            return (
              <tr
                key={r.id}
                onClick={() => navigate(`/operaciones/${r.id}`)}
                className="cursor-pointer border-b border-surface-2 transition-colors last:border-b-0 hover:bg-surface-2 motion-reduce:transition-none"
              >
                <td className="px-4 py-3.5 align-middle whitespace-nowrap text-ink-3 tabular-nums">
                  {formatearClaveDia(r.fecha_reserva)}
                </td>
                <td className="px-4 py-3.5 align-middle">
                  <Link
                    to={`/operaciones/${r.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="font-semibold text-ink hover:underline"
                  >
                    {r.titulo || 'Sin título'}
                  </Link>
                  {r.propiedad && (
                    <span className="mt-0.5 block text-[0.78rem] text-ink-3">
                      {r.propiedad.direccion}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3.5 align-middle">
                  <BadgeTipoOperacion tipo={r.tipo} />
                </td>
                <td className="px-4 py-3.5 align-middle">
                  {r.lead && cliente ? (
                    <>
                      <span className="block text-[0.72rem] text-ink-3">
                        {etiquetaLeadDeOperacion(r.tipo)}
                      </span>
                      <Link
                        to={`/leads/${r.lead.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-semibold text-primary hover:underline"
                      >
                        {cliente}
                      </Link>
                    </>
                  ) : (
                    <span className="text-ink-4">Sin cliente</span>
                  )}
                </td>
                <td className="px-4 py-3.5 text-right align-middle tabular-nums text-ink-2">
                  {r.monto == null ? (
                    <span className="text-ink-4">—</span>
                  ) : (
                    formatearMonto(r.monto, r.moneda)
                  )}
                </td>
                <td className="px-4 py-3.5 align-middle">
                  <BadgeEstadoOperacion tipo={r.tipo} estado={r.estado} />
                </td>
                {conAgente && (
                  <td className="px-4 py-3.5 align-middle text-ink-2">
                    {nombreCompleto(r.agente) ?? <span className="text-ink-4">—</span>}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
