import { Link } from 'react-router-dom'
import { etiquetaOrigen, type Lead, type ResumenOperaciones } from '../../lib/api/leads'
import { esVencido, formatearFecha, tiempoTranscurrido } from '../../lib/formatoFecha'
import { AccionesContacto } from '../comunes/AccionesContacto'
import type { RolLead } from '../../lib/api/rolLead'
import { BadgeEstado } from './BadgeEstado'
import { BadgeRol } from './BadgeRol'
import { IconoTacho } from './Iconos'

interface LeadsCardsProps {
  leads: Lead[]
  operaciones: (leadId: string) => ResumenOperaciones
  interacciones: (leadId: string) => { cantidad: number; ultimoDetalle: string | null }
  rol: (leadId: string) => RolLead | null
  /** Abre el alta de interacción. El modal lo monta la página. */
  onRegistrar: (lead: Lead) => void
  onEliminar: (lead: Lead) => void
}

/** Mismo contenido que la tabla, en tarjetas. Se usa por debajo de `md`. */
export function LeadsCards({
  leads,
  operaciones,
  interacciones,
  rol,
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
    <ul className="space-y-3">
      {leads.map((lead) => {
        const ops = operaciones(lead.id)
        const ints = interacciones(lead.id)
        const nombre = `${lead.nombre} ${lead.apellido ?? ''}`.trim()
        const contacto = tiempoTranscurrido(lead.fecha_ultimo_contacto_real)
        // Misma regla que la columna de la tabla: vencido en rojo, si no la fecha.
        const vencido = esVencido(lead.fecha_proximo_seguimiento)

        return (
          <li
            key={lead.id}
            className="flex flex-col gap-3 rounded-[16px] border border-border bg-surface p-4"
          >
            {/* Fila 1: el nombre trunca y el tacho no se mueve. */}
            <div className="flex items-center gap-2">
              <h2 className="m-0 min-w-0 flex-1 truncate text-[1.05rem] font-bold text-ink">
                {nombre}
              </h2>
              {/* Mismo botón que la tabla: la confirmación la monta la página. */}
              <button
                type="button"
                aria-label={`Eliminar el lead ${lead.nombre}`}
                onClick={() => onEliminar(lead)}
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-peligro-borde text-peligro-ink transition-colors hover:bg-peligro-soft motion-reduce:transition-none"
              >
                <IconoTacho className="size-4" />
              </button>
            </div>

            {/* Fila 2: temperatura y rol, y las operaciones sólo si hay. */}
            <div className="-mt-1 flex flex-wrap items-center gap-2">
              <BadgeEstado estado={lead.estado} />
              <BadgeRol rol={rol(lead.id)} />
              {ops.venta > 0 && <ChipOperaciones cantidad={ops.venta} singular="venta" plural="ventas" />}
              {ops.compra > 0 && <ChipOperaciones cantidad={ops.compra} singular="compra" plural="compras" />}
            </div>

            {/* Fila 3: origen y último contacto; el seguimiento, sólo si hay. */}
            <p className="m-0 text-[0.8rem] text-ink-3">
              {etiquetaOrigen(lead.origen)} ·{' '}
              {lead.fecha_ultimo_contacto_real ? `Contacto: ${contacto}` : contacto}
              {lead.fecha_proximo_seguimiento && (
                <>
                  {' · '}
                  {vencido ? (
                    <span className="font-bold text-caliente">Vencido</span>
                  ) : (
                    <span className="whitespace-nowrap">
                      Próx.: {formatearFecha(lead.fecha_proximo_seguimiento)}
                    </span>
                  )}
                </>
              )}
            </p>

            {/* El clamp va en el <p> de adentro: puesto en la caja, el padding
                de abajo dejaba asomar la mitad del tercer renglón. */}
            <div className="rounded-sm border border-border bg-background px-3 py-2">
              <p className="m-0 line-clamp-2 text-[0.85rem] text-ink">
                <span className="font-bold">Última:</span>{' '}
                {ints.ultimoDetalle ?? 'Sin interacciones registradas'}
              </p>
            </div>

            {/* "+ Interacción" primero y en primario: es la acción del día.
                Sin teléfono no se dibujan los íconos, igual que en la tabla. */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onRegistrar(lead)}
                className="flex-1 rounded-lg border border-primary bg-primary px-3 py-2.5 text-center text-[0.9rem] font-semibold text-primary-contrast transition-colors hover:border-primary-dark hover:bg-primary-dark motion-reduce:transition-none"
              >
                + Interacción
              </button>

              <Link
                to={`/leads/${lead.id}`}
                className="rounded-lg border border-border bg-surface px-4 py-2.5 text-center text-[0.9rem] font-semibold text-ink transition-colors hover:bg-background motion-reduce:transition-none"
              >
                Ver
              </Link>

              {lead.telefono && <AccionesContacto telefono={lead.telefono} nombre={nombre} />}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/** "1 venta", "2 compras": las operaciones del lead, sólo cuando hay alguna. */
function ChipOperaciones({
  cantidad,
  singular,
  plural,
}: {
  cantidad: number
  singular: string
  plural: string
}) {
  return (
    <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[0.72rem] font-semibold text-ink-3 tabular-nums">
      {cantidad} {cantidad === 1 ? singular : plural}
    </span>
  )
}
