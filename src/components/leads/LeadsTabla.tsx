import { Link } from 'react-router-dom'
import { etiquetaOrigen, type Lead, type LeadConAsignado } from '../../lib/api/leads'
import { nombreAsignado } from '../../lib/opcionesAsignacion'
import { esVencido, formatearFecha, tiempoTranscurrido } from '../../lib/formatoFecha'
import { AccionesContacto } from '../comunes/AccionesContacto'
import type { RolLead } from '../../lib/api/rolLead'
import { BadgeEstado } from './BadgeEstado'
import { BadgeRol } from './BadgeRol'
import { IconoTacho } from './Iconos'

interface LeadsTablaProps {
  leads: LeadConAsignado[]
  /** La columna "Asignado a": solo tiene sentido si la cuenta tiene asistentes. */
  mostrarAsignado?: boolean
  /** Detalle de la última interacción del lead, o null. */
  ultimaInteraccion: (leadId: string) => string | null
  /** Comprador / vendedor inferido, o null sin señal. */
  rol: (leadId: string) => RolLead | null
  /** Abre el alta de interacción. El modal lo monta la página. */
  onRegistrar: (lead: Lead) => void
  onEliminar: (lead: Lead) => void
}

/**
 * Qué columnas se ven según el ancho de la card (container queries, no de la
 * ventana: con el sidebar abierto la misma pantalla da cards más angostas).
 *
 * Cuando falta lugar se van, en este orden: Origen, Asignado a, Último contacto.
 * Lead, Temperatura, Próx. seguimiento y Acciones no se esconden nunca. Los
 * umbrales salen de sumar los anchos de abajo más ~13rem para la columna Lead
 * (el resto de la fila se reparte lo que sobra): 42rem la base, +9.5 Último
 * contacto = 52, +8.5 Asignado a = 60.5, +8 Origen = 68 (60.5 si no hay Asignado).
 *
 * Clases literales: Tailwind no ve las que se arman con interpolación.
 */
interface Columna {
  titulo: string
  /** Ancho de la columna; la de Lead no tiene y se queda con lo que sobra. */
  ancho?: string
  /** Visibilidad de la celda y de su `<col>` (display distinto): vacío = siempre. */
  visible: Visibilidad
}

interface Visibilidad {
  celda: string
  col: string
}

const SIEMPRE: Visibilidad = { celda: '', col: '' }

const DESDE_52: Visibilidad = { celda: 'hidden @[52rem]:table-cell', col: 'hidden @[52rem]:table-column' }
const DESDE_60: Visibilidad = { celda: 'hidden @[60.5rem]:table-cell', col: 'hidden @[60.5rem]:table-column' }
const DESDE_68: Visibilidad = { celda: 'hidden @[68rem]:table-cell', col: 'hidden @[68rem]:table-column' }

function columnas(conAsignado: boolean): Columna[] {
  return [
    { titulo: 'Lead', visible: SIEMPRE },
    { titulo: 'Temperatura', ancho: 'w-[7.5rem]', visible: SIEMPRE },
    {
      titulo: 'Origen',
      ancho: 'w-[8rem]',
      visible: conAsignado ? DESDE_68 : DESDE_60,
    },
    ...(conAsignado
      ? [{ titulo: 'Asignado a', ancho: 'w-[8.5rem]', visible: DESDE_60 }]
      : []),
    { titulo: 'Último contacto', ancho: 'w-[9.5rem]', visible: DESDE_52 },
    { titulo: 'Próx. seguimiento', ancho: 'w-[7.5rem]', visible: SIEMPRE },
    // Registrar (5.5) + llamada y WhatsApp (3.75) + eliminar (2) + gaps + padding.
    { titulo: 'Acciones', ancho: 'w-[14.5rem]', visible: SIEMPRE },
  ]
}

/**
 * Listado en tabla. Visible de `md` para arriba; abajo va LeadsCards.
 *
 * El contenedor (`@container`) es quien mide: no hay scroll horizontal, la
 * tabla se adapta escondiendo columnas. Antes tenía un `min-width` de 68/76rem
 * adentro de un `overflow-x-auto`: con el sidebar la card rara vez llegaba a
 * ese ancho, la tabla scrolleaba y la columna de Acciones —la última— quedaba
 * con el tacho cortado en el borde derecho.
 */
export function LeadsTabla({
  leads,
  mostrarAsignado = false,
  ultimaInteraccion,
  rol,
  onRegistrar,
  onEliminar,
}: LeadsTablaProps) {
  const cols = columnas(mostrarAsignado)
  const visible = (titulo: string) => cols.find((c) => c.titulo === titulo)?.visible.celda ?? ''

  return (
    <table className="w-full table-fixed border-collapse text-[0.88rem]">
      <colgroup>
        {cols.map((c) => (
          <col key={c.titulo} className={`${c.ancho ?? ''} ${c.visible.col}`} />
        ))}
      </colgroup>

      <thead>
        <tr>
          {cols.map((c) => (
            <th
              key={c.titulo}
              scope="col"
              className={`border-b border-border px-3.5 py-2.5 text-left text-xs leading-tight font-semibold tracking-[0.04em] text-ink-3 uppercase ${c.titulo === 'Último contacto' ? 'whitespace-nowrap' : ''} ${c.visible.celda}`}
            >
              {c.titulo}
            </th>
          ))}
        </tr>
      </thead>

      <tbody>
        {leads.length === 0 ? (
          <tr>
            <td
              colSpan={cols.length}
              className="p-8 text-center text-[0.88rem] text-ink-3 italic"
            >
              No hay leads que coincidan con el filtro.
            </td>
          </tr>
        ) : (
          leads.map((lead) => {
            const vencido = esVencido(lead.fecha_proximo_seguimiento)
            const nombreCompleto = `${lead.nombre} ${lead.apellido ?? ''}`.trim()
            return (
              // Fila clickeable con "stretched link": el nombre es un <Link> real
              // y su ::after cubre la fila entera (la <tr> es el bloque de
              // referencia). Así andan Ctrl/Cmd+clic, clic medio y Tab/Enter,
              // cosa que un onClick en la <tr> no da. Lo que tiene que
              // responder por su cuenta va con `relative z-10`, por encima.
              <tr
                key={lead.id}
                className="relative cursor-pointer border-b border-border transition-colors last:border-b-0 hover:bg-background motion-reduce:transition-none"
              >
                <td className="px-3.5 py-4 align-middle">
                  {/* El nombre trunca y el badge no: si no entra, se achica
                      el nombre, nunca el rol. */}
                  <span className="flex min-w-0 items-center gap-2">
                    <Link
                      to={`/leads/${lead.id}`}
                      className="truncate font-bold text-ink outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-primary"
                    >
                      {nombreCompleto}
                    </Link>
                    <BadgeRol rol={rol(lead.id)} />
                  </span>
                  <span className="mt-0.5 block truncate text-[0.78rem] text-ink-3">
                    {ultimaInteraccion(lead.id) ?? 'Sin interacciones registradas'}
                  </span>
                </td>

                <td className="px-3.5 py-4 align-middle">
                  <BadgeEstado estado={lead.estado} />
                </td>

                {/* La fecha de ingreso va debajo del origen —de dónde vino y
                    cuándo— para que el orden por fecha se vea sin sumar una
                    columna. No entra "Ingresó" delante sin ensanchar la
                    columna, así que el rótulo queda para lectores y tooltip;
                    la Lead ya tiene dos renglones, así que la fila no crece. */}
                <td className={`px-3.5 py-4 align-middle text-ink ${visible('Origen')}`}>
                  {etiquetaOrigen(lead.origen)}
                  <span
                    title="Fecha de ingreso"
                    className="mt-0.5 block truncate text-[0.78rem] text-ink-3 tabular-nums"
                  >
                    <span className="sr-only">Ingresó el </span>
                    {formatearFecha(lead.fecha_ingreso)}
                  </span>
                </td>

                {mostrarAsignado && (
                  <td className={`px-3.5 py-4 align-middle text-ink ${visible('Asignado a')}`}>
                    <span className="block truncate">{nombreAsignado(lead.asignado) ?? '—'}</span>
                  </td>
                )}

                <td className={`px-3.5 py-4 align-middle whitespace-nowrap text-ink ${visible('Último contacto')}`}>
                  {tiempoTranscurrido(lead.fecha_ultimo_contacto_real)}
                </td>

                <td
                  className={`px-3.5 py-4 align-middle ${vencido ? 'font-bold text-caliente' : 'text-ink'}`}
                >
                  {vencido ? 'Vencido' : formatearFecha(lead.fecha_proximo_seguimiento)}
                </td>

                <td className="px-3.5 py-4 align-middle">
                  {/* Cuatro lugares fijos, todos del mismo ancho en todas las
                      filas: Registrar, llamada + WhatsApp, y eliminar. El de
                      contacto se reserva aunque el lead no tenga teléfono, para
                      que el tacho no salte de columna. `w-fit`: el contenedor
                      es sólo lo que se toca; el resto de la celda sigue siendo
                      clic en la fila. */}
                  <div className="relative z-10 flex w-fit items-center gap-2">
                    {/* Botón y no <Link>: navegar a la página de alta tiraba
                        el filtro y la página del listado, que viven en el
                        estado de `Leads` y no en la URL. */}
                    <button
                      type="button"
                      onClick={() => onRegistrar(lead)}
                      aria-label={`Registrar una interacción con ${lead.nombre}`}
                      className="inline-flex h-8 w-22 shrink-0 items-center justify-center rounded-lg border border-primary bg-primary px-3 text-[0.78rem] font-semibold whitespace-nowrap text-primary-contrast transition-colors hover:border-primary-dark hover:bg-primary-dark motion-reduce:transition-none"
                    >
                      Registrar
                    </button>

                    {/* Sin teléfono el lugar queda vacío: los links
                        apuntarían a `tel:` y `wa.me` vacíos. */}
                    <div className="flex w-15 shrink-0 items-center">
                      {lead.telefono && (
                        <AccionesContacto telefono={lead.telefono} nombre={nombreCompleto} />
                      )}
                    </div>

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
  )
}
