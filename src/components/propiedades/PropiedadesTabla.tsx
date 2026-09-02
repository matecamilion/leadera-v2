import { Link } from 'react-router-dom'
import {
  etiquetaTipo,
  formatearPrecio,
  type PropiedadConPropietario,
} from '../../lib/api/propiedades'
import { BadgeEstadoPropiedad } from './BadgeEstadoPropiedad'

const COLUMNAS = ['Dirección', 'Tipo', 'Estado', 'Precio', 'Propietario', '']

/** Listado en tabla. Visible de `md` para arriba; abajo van las cards. */
export function PropiedadesTabla({
  propiedades,
}: {
  propiedades: PropiedadConPropietario[]
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
      <table className="w-full min-w-[52rem] border-collapse text-[0.93rem]">
        <thead className="bg-surface-2">
          <tr>
            {COLUMNAS.map((c, i) => (
              <th
                key={c || i}
                scope="col"
                className={`border-b border-border px-4 py-3 text-xs font-bold tracking-[0.04em] whitespace-nowrap text-ink-2 uppercase ${
                  c === 'Precio' ? 'text-right' : 'text-left'
                }`}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {propiedades.map((p) => (
            <tr
              key={p.id}
              className="border-b border-surface-2 transition-colors last:border-b-0 hover:bg-surface-2 motion-reduce:transition-none"
            >
              <td className="px-4 py-3.5 align-middle font-semibold text-ink">
                {p.direccion}
                {p.zona && (
                  <span className="block text-[0.78rem] font-normal text-ink-3">
                    {p.zona}
                  </span>
                )}
              </td>

              <td className="px-4 py-3.5 align-middle text-ink-2">
                {etiquetaTipo(p.tipo)}
              </td>

              <td className="px-4 py-3.5 align-middle">
                <BadgeEstadoPropiedad estado={p.estado} />
              </td>

              <td className="px-4 py-3.5 text-right align-middle tabular-nums text-ink-2">
                {p.precio == null ? (
                  <span className="text-ink-4">—</span>
                ) : (
                  formatearPrecio(p.precio, p.moneda)
                )}
              </td>

              <td className="px-4 py-3.5 align-middle">
                {p.lead_propietario ? (
                  <Link
                    to={`/leads/${p.lead_propietario.id}`}
                    className="font-semibold text-primary hover:underline"
                  >
                    {p.lead_propietario.nombre} {p.lead_propietario.apellido ?? ''}
                  </Link>
                ) : (
                  <span className="text-ink-4">—</span>
                )}
              </td>

              <td className="px-4 py-3.5 align-middle whitespace-nowrap">
                <Link
                  to={`/propiedades/${p.id}`}
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
