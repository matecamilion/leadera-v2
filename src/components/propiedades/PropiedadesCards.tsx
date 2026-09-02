import { Link } from 'react-router-dom'
import {
  etiquetaTipo,
  formatearPrecio,
  type PropiedadConPropietario,
} from '../../lib/api/propiedades'
import { BadgeEstadoPropiedad } from './BadgeEstadoPropiedad'

interface PropiedadesCardsProps {
  propiedades: PropiedadConPropietario[]
  /**
   * Saca la columna "Propietario".
   *
   * En la tab de la ficha del lead todas las filas dirían el mismo nombre —el
   * del lead que estás mirando—, así que ahí es ruido. Mismo criterio con el
   * que `ListaOperacionesCompacta` recorta columnas conocidas por contexto.
   */
  ocultarPropietario?: boolean
}

/** Mismo contenido que la tabla, apilado. Se usa por debajo de `md`. */
export function PropiedadesCards({
  propiedades,
  ocultarPropietario = false,
}: PropiedadesCardsProps) {
  return (
    <ul className="space-y-3">
      {propiedades.map((p) => (
        <li
          key={p.id}
          className="rounded-xl border border-border bg-surface p-4 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold text-ink">{p.direccion}</p>
              <p className="text-[0.8rem] text-ink-3">
                {etiquetaTipo(p.tipo)}
                {p.zona ? ` · ${p.zona}` : ''}
              </p>
            </div>
            <BadgeEstadoPropiedad estado={p.estado} />
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <div>
              <dt className="text-xs text-ink-3">Precio</dt>
              <dd className="tabular-nums text-ink-2">
                {p.precio == null ? '—' : formatearPrecio(p.precio, p.moneda)}
              </dd>
            </div>
            {!ocultarPropietario && (
              <div className="min-w-0">
                <dt className="text-xs text-ink-3">Propietario</dt>
                <dd className="truncate">
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
                </dd>
              </div>
            )}
          </dl>

          <Link
            to={`/propiedades/${p.id}`}
            className="mt-4 block w-full rounded-lg border border-border bg-surface p-2.5 text-center font-semibold text-ink transition-colors hover:bg-background motion-reduce:transition-none"
          >
            Ver detalle
          </Link>
        </li>
      ))}
    </ul>
  )
}
