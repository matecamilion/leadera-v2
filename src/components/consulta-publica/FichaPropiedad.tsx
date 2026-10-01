import { ETIQUETA_FINALIDAD, ETIQUETA_TIPO, formatearPrecio } from './catalogo'
import type { PropiedadDisponible } from './tipos'

function IconoCasa() {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3.5 10.5 12 4l8.5 6.5" />
      <path d="M5.5 9v10.5h13V9" />
      <path d="M10 19.5v-5h4v5" />
    </svg>
  )
}

/**
 * Lo que se muestra de la propiedad. Nunca la dirección: la edge function ni
 * siquiera la manda.
 */
export function FichaPropiedad({ propiedad }: { propiedad: PropiedadDisponible }) {
  const titulo = `${ETIQUETA_TIPO[propiedad.tipo]}${propiedad.zona ? ` en ${propiedad.zona}` : ''}`
  const precio = formatearPrecio(propiedad.precio, propiedad.moneda)
  const fotos = propiedad.fotos_urls

  const datos = [
    propiedad.finalidad ? ETIQUETA_FINALIDAD[propiedad.finalidad] : null,
    propiedad.ambientes ? `${propiedad.ambientes} amb.` : null,
    propiedad.metros_cuadrados ? `${propiedad.metros_cuadrados} m²` : null,
  ].filter((d): d is string => d !== null)

  return (
    <article className="overflow-hidden rounded-lg bg-surface shadow-card">
      {fotos.length > 0 ? (
        <div
          className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none]"
          aria-label={`Fotos: ${fotos.length}`}
        >
          {fotos.map((url, i) => (
            <img
              key={url}
              src={url}
              alt={i === 0 ? titulo : ''}
              loading={i === 0 ? 'eager' : 'lazy'}
              className="aspect-[3/2] w-full shrink-0 snap-center bg-surface-muted object-cover"
            />
          ))}
        </div>
      ) : (
        <div className="flex aspect-[3/2] w-full flex-col items-center justify-center gap-2 bg-primary-soft text-primary">
          <IconoCasa />
          <span className="text-sm font-medium">{ETIQUETA_TIPO[propiedad.tipo]}</span>
        </div>
      )}

      <div className="p-5">
        {fotos.length > 1 && (
          <p className="mb-2 text-xs text-ink-subtle">Deslizá para ver las {fotos.length} fotos</p>
        )}
        <h2 className="text-lg font-semibold tracking-tight text-ink">{titulo}</h2>
        {precio && <p className="mt-1 text-xl font-bold tracking-tight text-ink">{precio}</p>}
        {datos.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {datos.map((d) => (
              <li key={d} className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-ink-2">
                {d}
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  )
}
