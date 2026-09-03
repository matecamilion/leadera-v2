import { Link } from 'react-router-dom'
import { BadgeEstado } from '../leads/BadgeEstado'
import { IconoLupa } from '../leads/Iconos'
import { etiquetaTipo, type CoincidenciaInterna } from '../../lib/api/propiedades'

const MONTOS = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 })

function rangoPrecio(min: number | null, max: number | null): string | null {
  if (min != null && max != null) return `USD ${MONTOS.format(min)} – ${MONTOS.format(max)}`
  if (max != null) return `hasta USD ${MONTOS.format(max)}`
  if (min != null) return `desde USD ${MONTOS.format(min)}`
  return null
}

interface Props {
  coincidencias: CoincidenciaInterna[]
  cargando: boolean
  error?: string | null
}

/**
 * Interesados de la propia inmobiliaria: leads cuya búsqueda matchea.
 *
 * "Interesados" y no "compradores" porque una búsqueda puede ser de compra o de
 * alquiler; el RPC ya filtra los candidatos por la finalidad de la propiedad.
 *
 * A diferencia del original no hay distinción "mío" / "ajeno": la consulta ya
 * viene acotada a la inmobiliaria del usuario, así que todo lo que se ve acá
 * es propio. El cruce entre agencias es otra cosa y todavía no existe.
 */
export function SeccionCoincidenciasInternas({ coincidencias, cargando, error }: Props) {
  if (cargando) {
    return <p className="py-3 text-[0.9rem] text-ink-3">Buscando coincidencias…</p>
  }

  if (error) {
    return (
      <p
        role="alert"
        className="rounded-lg border border-peligro-borde bg-peligro-soft px-4 py-3 text-[0.9rem] text-peligro-ink"
      >
        {error}
      </p>
    )
  }

  if (coincidencias.length === 0) {
    return (
      <div className="rounded-[16px] border border-dashed border-border bg-background px-5 py-8 text-center">
        <p className="text-[0.9rem] text-ink-3">
          No hay interesados de tu inmobiliaria que coincidan con esta propiedad por ahora.
        </p>
      </div>
    )
  }

  return (
    <ul className="space-y-3">
      {coincidencias.map((c) => {
        const rango = rangoPrecio(c.precioMin, c.precioMax)
        return (
          <li
            key={c.busquedaId}
            className="rounded-[16px] border border-border bg-surface p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold text-ink">
                {c.nombre} {c.apellido ?? ''}
              </span>
              <BadgeEstado estado={c.estadoLead} />
            </div>

            <p className="mt-2 flex items-center gap-2 text-[0.85rem] text-ink-2">
              <IconoLupa className="size-4 shrink-0 text-primary" />
              {/* tipo_propiedad null significa "le sirve cualquier tipo": el
                  guión de etiquetaTipo() no se lee bien dentro de la frase. */}
              Busca {c.tipoBuscado ? etiquetaTipo(c.tipoBuscado).toLowerCase() : 'cualquier tipo'}
              {c.zona ? ` en ${c.zona}` : ''}
            </p>

            {(rango || c.ambientesMin) && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {rango && (
                  <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-primary">
                    {rango}
                  </span>
                )}
                {c.ambientesMin && (
                  <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold text-ink-2">
                    {c.ambientesMin}+ amb.
                  </span>
                )}
              </div>
            )}

            <div className="mt-3">
              <Link
                to={`/leads/${c.leadId}`}
                className="text-[0.85rem] font-semibold text-primary hover:underline"
              >
                Ver lead →
              </Link>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
