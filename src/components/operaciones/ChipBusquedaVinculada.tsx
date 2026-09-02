import { etiquetaTipo } from '../../lib/api/propiedades'
import type { OperacionDetalle } from '../../lib/api/operaciones'
import { IconoLupa } from '../leads/Iconos'

type Busqueda = NonNullable<OperacionDetalle['busqueda']>

const MONTOS = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 })

function rango(min: number | null, max: number | null): string | null {
  if (min != null && max != null) return `USD ${MONTOS.format(min)} – ${MONTOS.format(max)}`
  if (max != null) return `hasta USD ${MONTOS.format(max)}`
  if (min != null) return `desde USD ${MONTOS.format(min)}`
  return null
}

export function ChipBusquedaVinculada({ busqueda }: { busqueda: Busqueda }) {
  const presupuesto = rango(busqueda.precio_min, busqueda.precio_max)

  return (
    <div className="rounded-[14px] border border-border bg-surface p-5">
      <div className="flex items-start gap-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-softer text-primary">
          <IconoLupa className="size-5" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="font-bold text-ink">
            {/* tipo_propiedad null significa "le sirve cualquier tipo". */}
            {busqueda.tipo_propiedad
              ? etiquetaTipo(busqueda.tipo_propiedad)
              : 'Cualquier tipo'}
            {busqueda.zona ? ` en ${busqueda.zona}` : ''}
          </p>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {presupuesto && (
              <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-primary">
                {presupuesto}
              </span>
            )}
            {busqueda.ambientes_min && (
              <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold text-ink-2">
                {busqueda.ambientes_min}+ amb.
              </span>
            )}
          </div>

          {busqueda.notas && (
            <p className="mt-3 text-[0.9rem] leading-relaxed text-ink-2">
              {busqueda.notas}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
