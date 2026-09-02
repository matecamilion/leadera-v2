import { Link } from 'react-router-dom'
import { BadgeEstadoPropiedad } from '../propiedades/BadgeEstadoPropiedad'
import { etiquetaTipo, formatearPrecio } from '../../lib/api/propiedades'
import type { OperacionDetalle } from '../../lib/api/operaciones'
import { IconoCasa } from '../leads/Iconos'

type Propiedad = NonNullable<OperacionDetalle['propiedad']>

export function ChipPropiedadVinculada({ propiedad }: { propiedad: Propiedad }) {
  const meta = [
    propiedad.zona,
    etiquetaTipo(propiedad.tipo),
    propiedad.ambientes ? `${propiedad.ambientes} amb.` : null,
    propiedad.metros_cuadrados ? `${propiedad.metros_cuadrados} m²` : null,
    propiedad.precio != null ? formatearPrecio(propiedad.precio, propiedad.moneda) : null,
  ].filter(Boolean)

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-[14px] border border-border bg-surface p-5">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-softer text-primary">
        <IconoCasa className="size-5" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="font-bold text-ink">{propiedad.direccion}</p>
        {meta.length > 0 && (
          <p className="mt-0.5 text-[0.82rem] text-ink-3">{meta.join(' · ')}</p>
        )}
      </div>

      <BadgeEstadoPropiedad estado={propiedad.estado} />

      {propiedad.link_portal && (
        <a
          href={propiedad.link_portal}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[0.85rem] font-semibold text-primary hover:underline"
        >
          Ver publicación ↗
        </a>
      )}

      <Link
        to={`/propiedades/${propiedad.id}`}
        className="text-[0.85rem] font-semibold text-primary hover:underline"
      >
        Ver propiedad →
      </Link>
    </div>
  )
}
