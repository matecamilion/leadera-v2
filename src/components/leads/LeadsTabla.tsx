import { Link } from 'react-router-dom'
import { etiquetaOrigen, type Lead } from '../../lib/api/leads'
import { esVencido, formatearFecha, tiempoTranscurrido } from '../../lib/formatoFecha'
import { AccionesContacto } from '../comunes/AccionesContacto'
import { BadgeEstado } from './BadgeEstado'
import { IconoTacho } from './Iconos'

interface LeadsTablaProps {
  leads: Lead[]
  /** Detalle de la última interacción del lead, o null. */
  ultimaInteraccion: (leadId: string) => string | null
  /** Abre el alta de interacción. El modal lo monta la página. */
  onRegistrar: (lead: Lead) => void
  onEliminar: (lead: Lead) => void
}

const COLUMNAS = [
  'Lead',
  'Temperatura',
  'Origen',
  'Último contacto',
  'Próx. seguimiento',
  'Acciones',
]

/** Listado en tabla. Visible de `md` para arriba; abajo va LeadsCards. */
export function LeadsTabla({
  leads,
  ultimaInteraccion,
  onRegistrar,
  onEliminar,
}: LeadsTablaProps) {
  return (
    // `table-fixed` respeta las proporciones del original, pero con columnas
    // muy angostas los encabezados `nowrap` se pisan entre sí. El min-width
    // marca el piso donde el diseño entra entero; abajo de eso, scrollea.
    //
    // Los anchos se recalcularon al sumar los íconos de contacto: la celda de
    // Acciones mide 268px con sus cinco controles, y con 18% / 62rem tenía
    // 179px. Ya venía justa de antes —lo de adentro pedía 202px y nada de eso
    // encoge, así que el contenido se salía de la celda—; ahora 26% de 68rem
    // da 283px y entra entero. Lo que cedió es la columna Lead, que trunca.
    <div className="overflow-x-auto">
    <table className="w-full min-w-[68rem] table-fixed border-collapse text-[0.88rem]">
      <colgroup>
        <col className="w-[26%]" />
        <col className="w-[11%]" />
        <col className="w-[11%]" />
        <col className="w-[13%]" />
        <col className="w-[13%]" />
        <col className="w-[26%]" />
      </colgroup>

      <thead>
        <tr>
          {COLUMNAS.map((c) => (
            <th
              key={c}
              scope="col"
              className="border-b border-border px-3.5 py-2.5 text-left text-xs font-semibold tracking-[0.04em] whitespace-nowrap text-ink-3 uppercase"
            >
              {c}
            </th>
          ))}
        </tr>
      </thead>

      <tbody>
        {leads.length === 0 ? (
          <tr>
            <td
              colSpan={6}
              className="p-8 text-center text-[0.88rem] text-ink-3 italic"
            >
              No hay leads que coincidan con el filtro.
            </td>
          </tr>
        ) : (
          leads.map((lead) => {
            const vencido = esVencido(lead.fecha_proximo_seguimiento)
            return (
              <tr
                key={lead.id}
                className="border-b border-border transition-colors last:border-b-0 hover:bg-background motion-reduce:transition-none"
              >
                <td className="px-3.5 py-4 align-middle">
                  <span className="block truncate font-bold text-ink">
                    {lead.nombre} {lead.apellido ?? ''}
                  </span>
                  <span className="mt-0.5 block truncate text-[0.78rem] text-ink-3">
                    {ultimaInteraccion(lead.id) ?? 'Sin interacciones registradas'}
                  </span>
                </td>

                <td className="px-3.5 py-4 align-middle">
                  <BadgeEstado estado={lead.estado} />
                </td>

                <td className="px-3.5 py-4 align-middle text-ink">
                  {etiquetaOrigen(lead.origen)}
                </td>

                <td className="px-3.5 py-4 align-middle text-ink">
                  {tiempoTranscurrido(lead.fecha_ultimo_contacto_real)}
                </td>

                <td
                  className={`px-3.5 py-4 align-middle ${vencido ? 'font-bold text-caliente' : 'text-ink'}`}
                >
                  {vencido ? 'Vencido' : formatearFecha(lead.fecha_proximo_seguimiento)}
                </td>

                <td className="px-3.5 py-4 align-middle">
                  <div className="flex flex-nowrap items-center gap-2">
                    {/* Botón y no <Link>: navegar a la página de alta tiraba
                        el filtro y la página del listado, que viven en el
                        estado de `Leads` y no en la URL. */}
                    <button
                      type="button"
                      onClick={() => onRegistrar(lead)}
                      aria-label={`Registrar una interacción con ${lead.nombre}`}
                      className="inline-flex h-8 shrink-0 items-center justify-center rounded-lg border border-primary bg-primary px-3 text-[0.78rem] font-semibold whitespace-nowrap text-white transition-colors hover:border-primary-dark hover:bg-primary-dark motion-reduce:transition-none"
                    >
                      Registrar
                    </button>

                    <Link
                      to={`/leads/${lead.id}`}
                      className="inline-flex h-8 shrink-0 items-center justify-center rounded-lg border border-primary bg-surface px-3 text-[0.78rem] font-semibold whitespace-nowrap text-primary transition-colors hover:border-primary-dark hover:bg-brand-soft motion-reduce:transition-none"
                    >
                      Ver
                    </Link>

                    {/* Sin teléfono no se dibuja nada: los links quedarían
                        apuntando a `tel:` y `wa.me` vacíos. */}
                    {lead.telefono && (
                      <AccionesContacto
                        telefono={lead.telefono}
                        nombre={`${lead.nombre} ${lead.apellido ?? ''}`.trim()}
                      />
                    )}

                    <button
                      type="button"
                      aria-label={`Eliminar el lead ${lead.nombre}`}
                      onClick={() => onEliminar(lead)}
                      className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-peligro-borde text-peligro-ink transition-colors hover:bg-peligro-soft motion-reduce:transition-none"
                    >
                      <IconoTacho className="size-4" />
                    </button>
                  </div>
                </td>
              </tr>
            )
          })
        )}
      </tbody>
    </table>
    </div>
  )
}
