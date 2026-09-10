import { Link } from 'react-router-dom'
import { IconoCasa } from '../leads/Iconos'
import { etiquetaTipo, formatearPrecio } from '../../lib/api/propiedades'
import {
  MAXIMO_COINCIDENCIAS,
  type PropiedadCoincidente,
} from '../../lib/api/busquedas'

/**
 * Color del score por tramo.
 *
 * Mismos pares que los badges de temperatura del lead, para no inventar una
 * paleta nueva: verde marca / ámbar / azul frío.
 */
function estilosScore(pct: number): string {
  if (pct >= 75) return 'bg-brand-soft text-primary'
  if (pct >= 40) return 'bg-badge-tibio-bg text-badge-tibio-ink'
  return 'bg-badge-frio-bg text-frio'
}

interface SeccionCoincidenciasProps {
  /** Necesario para armar el link al detalle de cada coincidencia. */
  busquedaId: string
  coincidencias: PropiedadCoincidente[]
  cargando: boolean
  error?: string | null
}

/**
 * Propiedades que matchean la búsqueda de una operación de COMPRA.
 *
 * El RPC no aplica un piso de score: devuelve todas las propiedades
 * disponibles que pudo puntuar, incluidas las de 0%. Por eso el puntaje se
 * muestra grande y con color — es lo que separa una coincidencia real del
 * relleno — y la lista viene cortada en las mejores `MAXIMO_COINCIDENCIAS`.
 */
export function SeccionCoincidencias({
  coincidencias,
  busquedaId,
  cargando,
  error,
}: SeccionCoincidenciasProps) {
  if (cargando) {
    return (
      <div aria-busy="true" aria-label="Buscando coincidencias" className="space-y-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-[16px] bg-surface-2 motion-reduce:animate-none"
          />
        ))}
      </div>
    )
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
          Todavía no hay propiedades que coincidan con esta búsqueda.
        </p>
        <p className="mt-1 text-[0.82rem] text-ink-4">
          Se buscan sólo propiedades disponibles de tu inmobiliaria.
        </p>
      </div>
    )
  }

  return (
    <>
      {coincidencias.length === MAXIMO_COINCIDENCIAS && (
        <p className="mb-3 text-[0.82rem] text-ink-3">
          Mostrando las {MAXIMO_COINCIDENCIAS} propiedades con mejor puntaje. Afiná
          los criterios para acotar la lista.
        </p>
      )}

      <ul className="space-y-3">
        {coincidencias.map((p) => {
          const foto = p.fotos_urls[0]
          return (
            <li key={p.id}>
              <Link
                // Al detalle del match, no a la ficha de la propiedad: acá
                // lo que importa es por qué le sirve a este lead. El score va
                // por query string para no recalcularlo del otro lado.
                to={`/coincidencias/${busquedaId}/${p.id}?score=${p.scorePct}`}
                className="flex items-stretch gap-4 rounded-[16px] border border-border bg-surface p-4 transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
              >
                {foto ? (
                  <img
                    src={foto}
                    alt=""
                    loading="lazy"
                    className="size-20 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <span
                    aria-hidden
                    className="flex size-20 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-ink-4"
                  >
                    <IconoCasa className="size-7" />
                  </span>
                )}

                <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-ink">{p.direccion}</p>
                    <p className="mt-0.5 truncate text-[0.82rem] text-ink-3">
                      {etiquetaTipo(p.tipo)}
                      {p.zona ? ` · ${p.zona}` : ''}
                      {p.ambientes != null ? ` · ${p.ambientes} amb.` : ''}
                      {p.metros_cuadrados != null ? ` · ${p.metros_cuadrados} m²` : ''}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-ink">
                      {formatearPrecio(p.precio, p.moneda)}
                    </span>

                    <span
                      className={`rounded-full px-2.5 py-1 text-[0.78rem] font-bold ${estilosScore(p.scorePct)}`}
                    >
                      {p.scorePct}% — cumple {p.criteriosCumplidos} de{' '}
                      {p.criteriosEvaluados}{' '}
                      {p.criteriosEvaluados === 1 ? 'criterio' : 'criterios'}
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </>
  )
}
