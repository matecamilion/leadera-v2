import { Link } from 'react-router-dom'
import { SeccionCard } from './SeccionCard'
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

/** Flecha de doble sentido entre la propiedad y el interesado. */
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
 * Interesados de la cartera propia que encajan con propiedades disponibles.
 *
 * "Interesados" y no "compradores": una búsqueda puede ser de compra o de
 * alquiler. Los identificadores (`compradores`, `CompradorCompatible`) siguen
 * con el nombre viejo porque vienen de la capa de API; sólo se generalizó el
 * texto que ve el usuario.
 *
 * A diferencia del original no existe la distinción "mío" / "vía agente": todo
 * lo que se ve acá es de la misma inmobiliaria, porque el cruce ya viene
 * acotado desde `obtenerCoincidenciasDelDia`. No hay matching entre agencias.
 */
export function SeccionCoincidencias({ coincidencias }: Props) {
  const totalPares = coincidencias.reduce((suma, c) => suma + c.compradores.length, 0)

  // Con `SeccionCard` como el resto de Mi día: al bajar debajo de los leads
  // quedó entre dos secciones que la usan, y un header distinto se leía como
  // otra pantalla. El ✦ entra como ícono del chip, en el tono tibio que ya
  // tenía.
  return (
    <SeccionCard
      icono={<span className="text-[0.95rem] leading-none">✦</span>}
      tono="tibio"
      titulo="Coincidencias encontradas"
      subtitulo="Interesados de tu cartera que buscan propiedades como las tuyas"
      badge={String(totalPares)}
    >
      <ul className="divide-y divide-border">
        {coincidencias.map((coincidencia) =>
          coincidencia.compradores.map((comprador) => {
            const rango = rangoPrecio(comprador.precioMin, comprador.precioMax)

            return (
              <li key={`${coincidencia.propiedadId}-${comprador.busquedaId}`}>
                <Link
                  // Al detalle del match: los dos ids ya están en los datos,
                  // uno por cada lado del cruce.
                  to={`/coincidencias/${comprador.busquedaId}/${coincidencia.propiedadId}`}
                  // Un par por renglón desde md: propiedad en una columna de
                  // ancho fijo, así los interesados quedan a plomo entre filas.
                  // Más angosto se apila, como antes.
                  className="flex flex-col gap-2 px-4 py-2 transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none md:grid md:grid-cols-[minmax(0,15rem)_auto_minmax(0,1fr)_auto] md:items-center md:gap-3"
                >
                  {/* Propiedad */}
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span
                      aria-hidden
                      className="grid size-7 shrink-0 place-items-center rounded-[10px] bg-brand-softer text-primary"
                    >
                      <IconoCasa className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[0.88rem] font-semibold text-ink">
                        {coincidencia.direccion}
                      </span>
                      {/* Zona y precio, sin el tipo: en la columna de 15rem el
                          tipo empujaba el precio al truncado. Casi siempre ya se lee
                          en el chip de "Busca …" del interesado; el detalle del
                          match lo muestra completo. */}
                      <span className="block truncate text-[0.74rem] text-ink-3">
                        {[
                          coincidencia.zona,
                          coincidencia.precio != null
                            ? formatearPrecio(coincidencia.precio, coincidencia.moneda)
                            : null,
                        ]
                          .filter(Boolean)
                          .join(' · ') || etiquetaTipo(coincidencia.tipo)}
                      </span>
                    </span>
                  </span>

                  <IconoCruce className="hidden size-4 shrink-0 text-ink-4 md:block" />

                  {/* El interesado y lo que busca, en el mismo renglón */}
                  <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <span className="text-[0.88rem] font-semibold text-ink">
                      {comprador.nombre} {comprador.apellido ?? ''}
                    </span>
                    <BadgeEstado estado={comprador.estadoLead} chico />

                    <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[0.7rem] font-semibold text-ink-2">
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
                      <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[0.7rem] font-semibold text-primary">
                        {rango}
                      </span>
                    )}

                    {comprador.ambientesMin != null && (
                      <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[0.7rem] font-semibold text-ink-2">
                        {comprador.ambientesMin}+ amb.
                      </span>
                    )}
                  </span>

                  <span className="text-[0.78rem] font-semibold whitespace-nowrap text-primary">
                    Ver →
                  </span>
                </Link>
              </li>
            )
          }),
        )}
      </ul>
    </SeccionCard>
  )
}
