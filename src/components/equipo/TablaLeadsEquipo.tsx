import { Link } from 'react-router-dom'
import { BadgeEstado } from '../leads/BadgeEstado'
import { Paginacion } from '../leads/Paginacion'
import { etiquetaOrigen } from '../../lib/api/leads'
import { tiempoTranscurrido } from '../../lib/formatoFecha'
import type { LeadDelEquipo } from '../../lib/api/equipo'

interface TablaLeadsEquipoProps {
  leads: LeadDelEquipo[]
  total: number
  page: number
  totalPaginas: number
  onCambiarPagina: (page: number) => void
}

/**
 * Todos los leads de la inmobiliaria, de sólo lectura.
 *
 * Se puede abrir la ficha de cada uno, pero no editar desde acá: cada lead lo
 * gestiona su agente. Lo mismo decía el original.
 */
export function TablaLeadsEquipo({
  leads,
  total,
  page,
  totalPaginas,
  onCambiarPagina,
}: TablaLeadsEquipoProps) {
  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-lg border border-border bg-surface-2 px-4 py-2.5 text-[0.82rem] text-ink-2">
        Vista de sólo lectura: cada lead se gestiona desde la cuenta de su agente.
      </p>

      {leads.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-surface-2 px-4 py-10 text-center text-[0.88rem] text-ink-3">
          Todavía no hay leads cargados en la inmobiliaria.
        </p>
      ) : (
        <>
          <p className="text-[0.85rem] text-ink-3">
            {total === 1 ? '1 lead en total' : `${total} leads en total`}
          </p>

          {/* Escritorio: tabla */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-[0.88rem]">
              <thead>
                <tr className="border-b border-border text-left">
                  {['Lead', 'Agente', 'Temperatura', 'Origen', 'Último contacto', ''].map((h) => (
                    <th
                      key={h}
                      className="py-2.5 pr-3 text-xs font-semibold text-ink-3 uppercase"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} className="border-b border-border last:border-0">
                    <td className="py-3 pr-3 font-semibold text-ink">
                      {lead.nombre} {lead.apellido ?? ''}
                    </td>
                    <td className="py-3 pr-3 text-ink-2">
                      {lead.agente
                        ? `${lead.agente.nombre} ${lead.agente.apellido}`
                        : 'Sin asignar'}
                    </td>
                    <td className="py-3 pr-3">
                      <BadgeEstado estado={lead.estado} />
                    </td>
                    <td className="py-3 pr-3 text-ink-2">{etiquetaOrigen(lead.origen)}</td>
                    <td className="py-3 pr-3 text-ink-3">
                      {tiempoTranscurrido(lead.fecha_ultimo_contacto_real)}
                    </td>
                    <td className="py-3 text-right">
                      <Link
                        to={`/leads/${lead.id}`}
                        className="text-[0.82rem] font-semibold whitespace-nowrap text-primary hover:underline"
                      >
                        Ver →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: cards */}
          <ul className="flex flex-col gap-3 md:hidden">
            {leads.map((lead) => (
              <li key={lead.id} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="m-0 font-semibold text-ink">
                    {lead.nombre} {lead.apellido ?? ''}
                  </p>
                  <BadgeEstado estado={lead.estado} />
                </div>
                <p className="mt-1 text-[0.8rem] text-ink-3">
                  {lead.agente
                    ? `${lead.agente.nombre} ${lead.agente.apellido}`
                    : 'Sin asignar'}{' '}
                  · {etiquetaOrigen(lead.origen)}
                </p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-[0.78rem] text-ink-3">
                    {tiempoTranscurrido(lead.fecha_ultimo_contacto_real)}
                  </span>
                  <Link
                    to={`/leads/${lead.id}`}
                    className="text-[0.82rem] font-semibold text-primary hover:underline"
                  >
                    Ver →
                  </Link>
                </div>
              </li>
            ))}
          </ul>

          <Paginacion page={page} totalPaginas={totalPaginas} onCambiar={onCambiarPagina} />
        </>
      )}
    </div>
  )
}
