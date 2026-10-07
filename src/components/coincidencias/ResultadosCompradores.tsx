import { Link } from 'react-router-dom'
import type { CompradorParaOferta } from '../../lib/api/busquedas'
import { etiquetaTipo, formatearPrecio } from '../../lib/api/propiedades'
import { haceCuantoTiempo } from '../../lib/formatoFecha'
import { AccionesContacto } from '../comunes/AccionesContacto'
import { BadgeEstado } from '../leads/BadgeEstado'

/** Lo mínimo que necesita el modal de "Registrar". */
export interface LeadARegistrar {
  id: string
  nombre: string
  apellido: string | null
}

interface ResultadosCompradoresProps {
  /** Ya agrupadas: una por lead (ver `mejorBusquedaPorLead`). */
  compradores: CompradorParaOferta[]
  /** ¿La búsqueda tiene precio? Sin precio no hay nada que decir del presupuesto. */
  conPrecio: boolean
  onRegistrar: (lead: LeadARegistrar) => void
}

/** "USD 90.000 a USD 130.000", "hasta USD 130.000", "desde USD 90.000" o null. */
function rangoDePrecio(c: CompradorParaOferta): string | null {
  const { precio_min: min, precio_max: max, moneda } = c
  if (min != null && max != null) return `${formatearPrecio(min, moneda)} a ${formatearPrecio(max, moneda)}`
  if (max != null) return `hasta ${formatearPrecio(max, moneda)}`
  if (min != null) return `desde ${formatearPrecio(min, moneda)}`
  return null
}

/** Qué busca, en una línea: "Departamento · Centro · 3+ amb. · USD 90.000 a 130.000". */
function resumenDeBusqueda(c: CompradorParaOferta): string {
  return [
    c.tipo_propiedad ? etiquetaTipo(c.tipo_propiedad) : 'Cualquier tipo',
    c.zona,
    c.ambientes_min != null ? `${c.ambientes_min}+ amb.` : null,
    rangoDePrecio(c),
  ]
    .filter(Boolean)
    .join(' · ')
}

/**
 * Los compradores donde encaja lo que se ofrece, uno por lead.
 *
 * Una sola lista para todos los anchos: cada fila se apila en mobile y se
 * acomoda en una línea de `md` para arriba. Las acciones son las mismas que
 * las del listado normal (Registrar, Ver, llamar, WhatsApp); "Eliminar" no
 * está porque acá se viene a contactar, no a depurar la cartera.
 */
export function ResultadosCompradores({
  compradores,
  conPrecio,
  onRegistrar,
}: ResultadosCompradoresProps) {
  return (
    <ul className="m-0 list-none space-y-3 p-0">
      {compradores.map((c) => {
        const nombre = `${c.nombre} ${c.apellido ?? ''}`.trim()
        const dif = c.dif_presupuesto_pct
        const porEncima = dif != null && dif > 0
        const buscaba = haceCuantoTiempo(c.busqueda_created_at)

        return (
          <li
            key={c.lead_id}
            className="flex flex-col gap-3 rounded-[16px] border border-border bg-surface p-4 md:flex-row md:items-center md:justify-between md:gap-5"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to={`/leads/${c.lead_id}`}
                  className="truncate text-[0.95rem] font-bold text-ink hover:text-primary hover:underline"
                >
                  {nombre}
                </Link>
                <BadgeEstado estado={c.estado} chico />
                {c.score_pct != null && (
                  <span
                    title={`Cumple ${c.criterios_cumplidos} de ${c.criterios_evaluados} criterios`}
                    className="rounded-full bg-brand-soft px-2 py-0.5 text-[0.75rem] font-bold text-primary"
                  >
                    Coincide {c.score_pct}%
                  </span>
                )}
              </div>

              <p className="mt-1 mb-0 text-[0.85rem] text-ink-2">Busca: {resumenDeBusqueda(c)}</p>

              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8rem]">
                {conPrecio &&
                  (porEncima ? (
                    <span className="rounded-full bg-badge-tibio-bg px-2 py-0.5 font-semibold text-badge-tibio-ink">
                      {Math.ceil(dif)}% por encima de su presupuesto
                    </span>
                  ) : (
                    <span className="font-semibold text-success">Dentro de su presupuesto</span>
                  ))}
                {buscaba && <span className="text-ink-3">Buscaba {buscaba}</span>}
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onRegistrar({ id: c.lead_id, nombre: c.nombre, apellido: c.apellido })}
                aria-label={`Registrar una interacción con ${c.nombre}`}
                className="inline-flex h-8 shrink-0 items-center justify-center rounded-lg border border-primary bg-primary px-3 text-[0.78rem] font-semibold whitespace-nowrap text-primary-contrast transition-colors hover:border-primary-dark hover:bg-primary-dark motion-reduce:transition-none"
              >
                Registrar
              </button>
              <Link
                to={`/leads/${c.lead_id}`}
                className="inline-flex h-8 shrink-0 items-center justify-center rounded-lg border border-primary bg-surface px-3 text-[0.78rem] font-semibold whitespace-nowrap text-primary transition-colors hover:border-primary-dark hover:bg-brand-soft motion-reduce:transition-none"
              >
                Ver
              </Link>
              {c.telefono && <AccionesContacto telefono={c.telefono} nombre={nombre} />}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
