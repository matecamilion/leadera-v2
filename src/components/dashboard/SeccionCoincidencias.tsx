import { Link } from 'react-router-dom'
import { BadgeEstado } from '../leads/BadgeEstado'
import { IconoCasa, IconoLupa } from '../leads/Iconos'
import { etiquetaTipo, formatearPrecio } from '../../lib/api/propiedades'
import type { CoincidenciaDelDia } from '../../lib/api/dashboard'

const MONTOS = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 })

function rangoPrecio(min: number | null, max: number | null): string | null {
  if (min != null && max != null) return `USD ${MONTOS.format(min)} – ${MONTOS.format(max)}`
  if (max != null) return `hasta USD ${MONTOS.format(max)}`
  if (min != null) return `desde USD ${MONTOS.format(min)}`
  return null
}

/** Flecha de doble sentido entre la propiedad y el comprador. */
function IconoCruce({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <path
        d="M7 10h14m0 0-3-3m3 3-3 3M17 14H3m0 0 3-3m-3 3 3 3"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

interface Props {
  coincidencias: CoincidenciaDelDia[]
}

/**
 * Compradores de la cartera propia que encajan con propiedades disponibles.
 *
 * A diferencia del original no existe la distinción "mío" / "vía agente": todo
 * lo que se ve acá es de la misma inmobiliaria, porque el cruce ya viene
 * acotado desde `obtenerCoincidenciasDelDia`. No hay matching entre agencias.
 */
export function SeccionCoincidencias({ coincidencias }: Props) {
  const totalPares = coincidencias.reduce((suma, c) => suma + c.compradores.length, 0)

  return (
    <section className="mb-7 rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <header className="mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <span aria-hidden className="text-[1.1rem] text-tibio">
            ✦
          </span>
          <h2 className="m-0 text-[0.95rem] font-bold text-ink">
            Coincidencias encontradas
          </h2>
          <span className="rounded-full bg-primary px-2.5 py-0.5 text-[0.72rem] font-bold text-white">
            {totalPares}
          </span>
        </div>
        <p className="mt-1 text-[0.8rem] text-ink-3">
          Compradores de tu cartera que buscan propiedades como las tuyas
        </p>
      </header>

      <div className="flex flex-col">
        {coincidencias.map((coincidencia) =>
          coincidencia.compradores.map((comprador) => {
            const rango = rangoPrecio(comprador.precioMin, comprador.precioMax)

            return (
              <Link
                key={`${coincidencia.propiedadId}-${comprador.busquedaId}`}
                to={`/propiedades/${coincidencia.propiedadId}`}
                className="-mx-3 flex flex-col gap-3 rounded-[10px] px-3 py-3.5 transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none md:flex-row md:items-start md:gap-5 [&+a]:border-t [&+a]:border-border"
              >
                {/* Propiedad */}
                <div className="flex min-w-0 items-center gap-2.5 md:flex-[0_1_auto]">
                  <span
                    aria-hidden
                    className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-brand-softer text-primary"
                  >
                    <IconoCasa className="size-5" />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-[0.9rem] font-semibold text-ink">
                      {coincidencia.direccion}
                    </span>
                    <span className="truncate text-[0.78rem] text-ink-3">
                      {[coincidencia.zona, etiquetaTipo(coincidencia.tipo)]
                        .filter(Boolean)
                        .join(' · ')}
                      {coincidencia.precio != null &&
                        ` · ${formatearPrecio(coincidencia.precio, coincidencia.moneda)}`}
                    </span>
                  </span>
                </div>

                <IconoCruce
                  className="hidden size-5 shrink-0 self-center text-ink-4 md:block"
                />

                {/* Comprador */}
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[0.9rem] font-semibold text-ink">
                      {comprador.nombre} {comprador.apellido ?? ''}
                    </span>
                    <BadgeEstado estado={comprador.estadoLead} />
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-[0.72rem] font-semibold text-ink-2">
                      <IconoLupa className="size-3 shrink-0 text-primary" />
                      {/* tipo null = le sirve cualquier tipo; el guión de
                          etiquetaTipo() no se lee bien dentro de la frase. */}
                      Busca{' '}
                      {comprador.tipoBuscado
                        ? etiquetaTipo(comprador.tipoBuscado).toLowerCase()
                        : 'cualquier tipo'}
                      {comprador.zona ? ` en ${comprador.zona}` : ''}
                    </span>

                    {rango && (
                      <span className="rounded-full bg-brand-soft px-2.5 py-1 text-[0.72rem] font-semibold text-primary">
                        {rango}
                      </span>
                    )}

                    {comprador.ambientesMin != null && (
                      <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[0.72rem] font-semibold text-ink-2">
                        {comprador.ambientesMin}+ amb.
                      </span>
                    )}
                  </div>
                </div>

                <span className="shrink-0 self-center text-[0.8rem] font-semibold whitespace-nowrap text-primary">
                  Ver →
                </span>
              </Link>
            )
          }),
        )}
      </div>
    </section>
  )
}
