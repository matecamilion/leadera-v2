import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AvatarLead } from '../leads/AvatarLead'
import { BadgeEstado } from '../leads/BadgeEstado'
import { IconoAlerta, IconoPersonaMas, IconoReloj } from '../leads/Iconos'
import { AccionesContacto } from '../comunes/AccionesContacto'
import { tiempoTranscurrido } from '../../lib/formatoFecha'
import type { Lead } from '../../lib/api/leads'

export type VarianteLista = 'prioritarios' | 'nuevos' | 'seguimientos'

/** Color del ícono y del badge de conteo, igual que `.section-icon.X`. */
const ACENTO: Record<VarianteLista, { icono: string; badge: string }> = {
  prioritarios: { icono: 'bg-hot-soft text-caliente', badge: 'bg-hot-soft text-caliente' },
  nuevos: { icono: 'bg-brand-soft text-primary', badge: 'bg-brand-soft text-primary' },
  seguimientos: {
    icono: 'bg-warm-soft text-badge-tibio-ink',
    badge: 'bg-warm-soft text-badge-tibio-ink',
  },
}

const ICONO: Record<VarianteLista, typeof IconoAlerta> = {
  prioritarios: IconoAlerta,
  nuevos: IconoPersonaMas,
  seguimientos: IconoReloj,
}

interface ListaLeadsProps {
  titulo: string
  subtitulo: string
  /** Palabra que sigue al número en el badge: "3 urgentes". */
  textoBadge: string
  variante: VarianteLista
  leads: Lead[]
  /** Total real en la base. Si supera a `leads.length` aparece el "Ver todos". */
  total: number
  verTodosRuta: string
  /** Abre el alta de interacción. El modal lo monta la página. */
  onRegistrar: (lead: Lead) => void
}

/**
 * Sección de leads del dashboard: filas de ancho completo separadas por una
 * línea, dentro de una sola superficie.
 *
 * Antes era un carrusel horizontal de tarjetas de 230px. Con tres secciones
 * apiladas eso obligaba a scrollear de costado tres veces para leer una lista
 * que se recorre de arriba a abajo, y cada lead venía envuelto en su propia
 * card. Acá la card es la sección y los leads son filas: se comparan de un
 * vistazo por la columna de la derecha, que queda alineada.
 */
export function ListaLeads({
  titulo,
  subtitulo,
  textoBadge,
  variante,
  leads,
  total,
  verTodosRuta,
  onRegistrar,
}: ListaLeadsProps) {
  const Icono = ICONO[variante]
  const acento = ACENTO[variante]
  const hayMas = total > leads.length

  return (
    <section className="mb-8">
      <header className="mb-3">
        <div className="flex flex-wrap items-center gap-2">
          <span
            aria-hidden
            className={`flex size-8 shrink-0 items-center justify-center rounded-[10px] ${acento.icono}`}
          >
            <Icono className="size-[18px]" />
          </span>

          <h2 className="m-0 text-[1.05rem] font-bold text-ink">{titulo}</h2>

          <span
            className={`rounded-full px-2.5 py-0.5 text-[0.72rem] font-bold ${acento.badge}`}
          >
            {leads.length} {textoBadge}
          </span>

          {hayMas && (
            <Link
              to={verTodosRuta}
              className="ml-auto text-[0.82rem] font-semibold whitespace-nowrap text-primary hover:underline"
            >
              Ver todos ({total}) →
            </Link>
          )}
        </div>

        <p className="mt-1 text-[0.85rem] text-ink-3">{subtitulo}</p>
      </header>

      {leads.length === 0 ? (
        <p className="rounded-[14px] border border-dashed border-border bg-surface-2 px-4 py-6 text-center text-[0.88rem] text-ink-3">
          No hay leads en esta sección.
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-[14px] border border-border bg-surface">
          {leads.map((lead) => (
            <FilaLead key={lead.id} lead={lead} onRegistrar={onRegistrar} />
          ))}
        </ul>
      )}
    </section>
  )
}

/**
 * Contexto secundario del lead, con lo que ya viene en la fila.
 *
 * Un lead sin primer contacto es el caso que hay que ver de lejos; el resto
 * muestra el teléfono, que es con lo que se actúa desde una lista de llamados.
 */
function contexto(lead: Lead): string {
  if (!lead.fecha_primer_contacto_real) return 'Sin interacciones registradas'
  return lead.telefono ?? 'Sin teléfono cargado'
}

interface FilaLeadProps {
  lead: Lead
  /** Abre el alta de interacción. El modal lo monta la página. */
  onRegistrar: (lead: Lead) => void
  /**
   * Reemplaza la columna de "hace cuánto fue el último contacto".
   *
   * En la pantalla de contactados ese dato diría "hace un rato" en todas las
   * filas; el slot deja poner ahí con qué y a qué hora se lo contactó, que es
   * lo que sí distingue una fila de la otra.
   */
  enLugarDelTiempo?: ReactNode
}

/** Una fila: quién es a la izquierda, en qué estado y qué hacer a la derecha. */
export function FilaLead({ lead, onRegistrar, enLugarDelTiempo }: FilaLeadProps) {
  const nombreCompleto = `${lead.nombre} ${lead.apellido ?? ''}`.trim()

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2.5 px-4 py-3 transition-colors hover:bg-surface-2 motion-reduce:transition-none">
      {/* `basis-full` hasta sm: el bloque de acciones cae a una segunda línea
          en vez de apretujarse contra el nombre. De sm para arriba, `basis-0`
          lo deja crecer y todo entra en una sola. */}
      <Link
        to={`/leads/${lead.id}`}
        className="flex min-w-0 shrink basis-full items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:flex-1 sm:basis-0"
      >
        <AvatarLead
          nombre={lead.nombre}
          apellido={lead.apellido}
          estado={lead.estado}
          className="!size-10 !text-[0.95rem]"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-ink">{nombreCompleto}</span>
          <span className="mt-0.5 block truncate text-[0.78rem] text-ink-3">
            {contexto(lead)}
          </span>
        </span>
      </Link>

      {/* En una línea a la derecha desde sm; abajo y de ancho completo en
          mobile, con el botón contra el borde para que siga siendo el destino
          más grande de la fila. */}
      <div className="flex w-full items-center gap-3 sm:ml-auto sm:w-auto">
        <BadgeEstado estado={lead.estado} />

        {/* Las acciones van acá y no pegadas al teléfono de arriba: allá el
            número vive adentro del <Link> a la ficha, y un <a> dentro de otro
            <a> no es HTML válido. */}
        {lead.telefono && (
          <AccionesContacto telefono={lead.telefono} nombre={nombreCompleto} />
        )}

        {/* Ancho mínimo para que la columna quede a plomo entre filas aunque
            diga "Ayer" en una y "28 días" en la siguiente. */}
        <span className="min-w-[4.5rem] text-[0.78rem] whitespace-nowrap text-ink-3 tabular-nums sm:text-right">
          {enLugarDelTiempo ?? tiempoTranscurrido(lead.fecha_ultimo_contacto_real)}
        </span>

        {/* Botón y no <Link>: el alta se abre en un modal para no sacar al
            agente de la jornada, que es justo la pantalla que recorre fila
            por fila. */}
        <button
          type="button"
          onClick={() => onRegistrar(lead)}
          aria-label={`Registrar una interacción con ${nombreCompleto}`}
          className="ml-auto rounded-lg bg-brand-soft px-3 py-2 text-[0.78rem] font-semibold whitespace-nowrap text-primary transition-colors hover:bg-primary hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none sm:ml-0"
        >
          Interacción
        </button>
      </div>
    </li>
  )
}
