import { Link } from 'react-router-dom'
import type { Lead, ResumenOperaciones } from '../../lib/api/leads'
import { tiempoTranscurrido } from '../../lib/formatoFecha'
import { EmailLink, TelefonoConAcciones } from '../comunes/AccionesContacto'
import { BadgeEstado } from './BadgeEstado'
import { IconoChat, IconoMail, IconoReloj, IconoTacho, IconoTelefono } from './Iconos'

interface LeadsCardsProps {
  leads: Lead[]
  operaciones: (leadId: string) => ResumenOperaciones
  interacciones: (leadId: string) => { cantidad: number; ultimoDetalle: string | null }
  /** Abre el alta de interacción. El modal lo monta la página. */
  onRegistrar: (lead: Lead) => void
  onEliminar: (lead: Lead) => void
}

/** Mismo contenido que la tabla, en tarjetas. Se usa por debajo de `md`. */
export function LeadsCards({
  leads,
  operaciones,
  interacciones,
  onRegistrar,
  onEliminar,
}: LeadsCardsProps) {
  if (leads.length === 0) {
    return (
      <p className="rounded-[16px] border border-border bg-surface p-8 text-center text-[0.88rem] text-ink-3 italic">
        No hay leads que coincidan con el filtro.
      </p>
    )
  }

  return (
    <ul className="space-y-4">
      {leads.map((lead) => {
        const ops = operaciones(lead.id)
        const ints = interacciones(lead.id)

        return (
          <li
            key={lead.id}
            className="flex flex-col gap-5 rounded-[16px] border border-border bg-surface p-5"
          >
            <div className="flex-1">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h2 className="m-0 text-[1.1rem] font-bold text-ink">
                  {lead.nombre} {lead.apellido ?? ''}
                </h2>
                <BadgeEstado estado={lead.estado} />

                <button
                  type="button"
                  onClick={() => onEliminar(lead)}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-peligro-borde px-3.5 py-[7px] text-[0.8rem] font-medium text-peligro-ink opacity-65 transition hover:bg-peligro-soft hover:opacity-100 motion-reduce:transition-none"
                >
                  <IconoTacho className="size-4" />
                  Eliminar
                </button>
              </div>

              <div className="mb-3 flex flex-col gap-2 min-[600px]:flex-row min-[600px]:gap-5">
                <span className="flex items-center text-[0.85rem] break-all text-ink-2">
                  <IconoTelefono className="mr-2 size-[18px] shrink-0 text-ink-3" />
                  {lead.telefono ? (
                    <TelefonoConAcciones
                      telefono={lead.telefono}
                      nombre={`${lead.nombre} ${lead.apellido ?? ''}`.trim()}
                    />
                  ) : (
                    '—'
                  )}
                </span>
                <span className="flex items-center text-[0.85rem] break-all text-ink-2">
                  <IconoMail className="mr-2 size-[18px] shrink-0 text-ink-3" />
                  {lead.email ? <EmailLink email={lead.email} /> : '—'}
                </span>
              </div>

              <div className="flex flex-wrap gap-3 text-[0.8rem] text-ink-3">
                <span className="flex items-center">
                  <IconoReloj className="mr-1 size-4 shrink-0 text-border" />
                  {tiempoTranscurrido(lead.fecha_ultimo_contacto_real)}
                </span>
                <span className="flex items-center">
                  <IconoChat className="mr-1 size-4 shrink-0 text-border" />
                  {ints.cantidad} interacciones
                </span>
              </div>

              <p className="mt-4 rounded-sm border border-border bg-background p-3 text-[0.85rem] text-ink">
                <span className="font-bold">Última:</span>{' '}
                {ints.ultimoDetalle ?? 'Sin interacciones registradas'}
              </p>
            </div>

            <div className="flex flex-col justify-between gap-3 border-t border-dashed border-border pt-4">
              <div className="flex flex-row justify-start gap-2">
                <MiniCard label="Venta" valor={ops.venta} />
                <MiniCard label="Compra" valor={ops.compra} />
              </div>

              {/* El atajo que la tabla ya tenía y la card no: registrar era
                  el único camino que obligaba a entrar a la ficha. Va primero
                  y en primario porque es la acción del día; "Ver detalle"
                  queda de secundaria. */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onRegistrar(lead)}
                  className="flex-1 rounded-lg border border-primary bg-primary p-3 text-center font-semibold text-white transition-colors hover:border-primary-dark hover:bg-primary-dark motion-reduce:transition-none"
                >
                  + Interacción
                </button>

                <Link
                  to={`/leads/${lead.id}`}
                  className="flex-1 rounded-lg border border-border bg-surface p-3 text-center font-semibold text-ink transition-colors hover:bg-background motion-reduce:transition-none"
                >
                  Ver detalle
                </Link>
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function MiniCard({ label, valor }: { label: string; valor: number }) {
  return (
    <div className="flex min-w-[86px] flex-col gap-1 rounded-md border border-border bg-background px-3 py-2.5">
      <span className="text-xs font-semibold text-ink-3">{label}</span>
      <strong className="text-[1.2rem] leading-none text-ink">{valor}</strong>
    </div>
  )
}
