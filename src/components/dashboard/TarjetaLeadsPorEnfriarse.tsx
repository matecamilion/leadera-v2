import { useState } from 'react'
import { Link } from 'react-router-dom'
import { SeccionCard } from './SeccionCard'
import type { LeadARegistrar } from './ResumenTareasHoy'
import { BadgeEstado } from '../leads/BadgeEstado'
import { IconoCopo } from '../leads/Iconos'
import { useLeadsPorEnfriarse } from '../../hooks/useDashboard'
import { DIAS_AVISO_ENFRIARSE, type LeadPorEnfriarse } from '../../lib/api/leadsPorEnfriarse'
import { nombreDePorEnfriarse, textoDiasSinContacto } from '../../lib/textoPorEnfriarse'

/** Cuántas filas se ven sin expandir. */
const VISIBLES = 5

/**
 * Leads que llevan 21 días o más sin contacto real y no tienen seguimiento
 * agendado: los que se enfrían si nadie los toca.
 *
 * No existe mientras no haya nada que avisar: ni cargando ni si la query falla.
 * Es un aviso, y un esqueleto que después desaparece sería ruido en las cuentas
 * que están al día. Los leads sin ningún contacto real no están acá: siguen en
 * "Nuevos".
 */
export function TarjetaLeadsPorEnfriarse({
  className = '',
  onRegistrar,
}: {
  className?: string
  /** Abre el alta de interacción. El modal lo monta la página. */
  onRegistrar: (lead: LeadARegistrar) => void
}) {
  const { data } = useLeadsPorEnfriarse()
  const [expandida, setExpandida] = useState(false)

  if (!data || data.leads.length === 0) return null

  const { leads, total } = data
  const visibles = expandida ? leads : leads.slice(0, VISIBLES)
  const restantes = leads.length - VISIBLES
  // La RPC trae como mucho 20; el resto existe pero no hay lista a la que llevar.
  const sinMostrar = total - leads.length

  return (
    <SeccionCard
      icono={<IconoCopo className="size-4" />}
      tono="frio"
      titulo="Por enfriarse"
      subtitulo={`${DIAS_AVISO_ENFRIARSE} días o más sin contacto y sin seguimiento agendado`}
      badge={String(total)}
      className={className}
    >
      <ul className="divide-y divide-border">
        {visibles.map((lead) => (
          <FilaPorEnfriarse key={lead.lead_id} lead={lead} onRegistrar={onRegistrar} />
        ))}
      </ul>

      {restantes > 0 && (
        <button
          type="button"
          onClick={() => setExpandida((v) => !v)}
          aria-expanded={expandida}
          className="mt-1 min-h-10 w-full rounded-lg text-[0.8rem] font-semibold text-primary transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
        >
          {expandida ? 'Ver menos' : `Ver ${restantes === 1 ? 'el restante' : `los ${restantes} restantes`}`}
        </button>
      )}

      {expandida && sinMostrar > 0 && (
        <p className="m-0 mt-1 text-center text-[0.76rem] text-ink-3">
          y {sinMostrar} más, que van apareciendo a medida que atendés estos
        </p>
      )}
    </SeccionCard>
  )
}

/**
 * Sin estado se rotula "Sin clasificar" como el chip del listado, con el punto
 * hueco, y solo acá: `BadgeEstado` dice "Nuevo" para ese caso y para un lead que
 * ya fue contactado eso confundiría.
 */
function EstadoDeFila({ estado }: { estado: LeadPorEnfriarse['estado'] }) {
  if (estado) return <BadgeEstado estado={estado} />
  return (
    <span className="inline-flex items-center gap-1.5 text-meta font-semibold whitespace-nowrap text-ink-3">
      <span
        aria-hidden="true"
        className="size-1.5 shrink-0 rounded-full border-[1.5px] border-ink-3 bg-transparent"
      />
      Sin clasificar
    </span>
  )
}

function FilaPorEnfriarse({
  lead,
  onRegistrar,
}: {
  lead: LeadPorEnfriarse
  onRegistrar: (lead: LeadARegistrar) => void
}) {
  const nombre = nombreDePorEnfriarse(lead)

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
      <Link
        to={`/leads/${lead.lead_id}`}
        className="min-w-0 flex-1 basis-40 rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <span className="block truncate text-[0.88rem] font-semibold text-ink">{nombre}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.76rem] text-ink-3">
          <EstadoDeFila estado={lead.estado} />
          <span>
            {textoDiasSinContacto(lead.dias_sin_contacto)}
            {lead.importado && ' · importado'}
          </span>
        </span>
      </Link>

      <button
        type="button"
        onClick={() => onRegistrar({ id: lead.lead_id, nombre: lead.nombre, apellido: lead.apellido })}
        aria-label={`Registrar contacto con ${nombre}`}
        className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-3.5 py-2 text-[0.8rem] font-semibold whitespace-nowrap text-ink transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:min-h-10 motion-reduce:transition-none"
      >
        Registrar contacto
      </button>
    </li>
  )
}
