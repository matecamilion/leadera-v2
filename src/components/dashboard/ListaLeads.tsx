import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { SeccionCard } from './SeccionCard'
import { AvatarLead } from '../leads/AvatarLead'
import { BadgeEstado } from '../leads/BadgeEstado'
import { IconoAlerta, IconoPersonaMas, IconoReloj } from '../leads/Iconos'
import { AccionesContacto } from '../comunes/AccionesContacto'
import { tiempoTranscurrido } from '../../lib/formatoFecha'
import type { TonoKpi } from '../comunes/tonos'
import type { Lead } from '../../lib/api/leads'

export type VarianteLista = 'prioritarios' | 'nuevos' | 'seguimientos'

/**
 * Tono de la sección, en el vocabulario de `CardKpi`.
 *
 * Reemplaza al viejo `ACENTO`, que repetía las mismas clases para el ícono y
 * para el badge: ahora las pone `SeccionCard` desde una sola tabla.
 */
const TONO: Record<VarianteLista, TonoKpi> = {
  prioritarios: 'caliente',
  nuevos: 'brand',
  seguimientos: 'tibio',
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
  const hayMas = total > leads.length

  return (
    <SeccionCard
      icono={<Icono className="size-[18px]" />}
      tono={TONO[variante]}
      titulo={titulo}
      subtitulo={subtitulo}
      badge={`${leads.length} ${textoBadge}`}
      verTodos={hayMas ? { ruta: verTodosRuta, texto: `Ver todos (${total}) →` } : undefined}
    >
      {leads.length === 0 ? (
        <p className="rounded-[14px] border border-dashed border-border bg-surface-2 px-4 py-6 text-center text-[0.88rem] text-ink-3">
          No hay leads en esta sección.
        </p>
      ) : (
        // `@container`: las filas miden esta lista, no la ventana. Sin esto,
        // en la grilla de Mi día una columna de 352px seguía armando la fila
        // de una línea porque el viewport superaba los 640px.
        //
        // Sin borde ni radio propios: los pone la card que la envuelve.
        <ul className="@container divide-y divide-border">
          {leads.map((lead) => (
            <FilaLead key={lead.id} lead={lead} onRegistrar={onRegistrar} />
          ))}
        </ul>
      )}
    </SeccionCard>
  )
}

/**
 * Contexto secundario del lead, con lo que ya viene en la fila.
 *
 * Un lead sin primer contacto es el caso que hay que ver de lejos; el resto
 * muestra el teléfono, que es con lo que se actúa desde una lista de llamados.
 */
function contexto(lead: Lead): string {
  // "Todavía sin contactar" y no "sin interacciones": lo que se está mirando es
  // `fecha_primer_contacto_real`, que es otra cosa. Hoy los dos casos suelen
  // coincidir, pero un lead puede tener interacciones cargadas sin que ninguna
  // le haya movido la fecha de primer contacto. Mismo texto que usa el resumen
  // de la ficha para esta misma condición.
  if (!lead.fecha_primer_contacto_real) return 'Todavía sin contactar'
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
        className="flex min-w-0 shrink basis-full items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary @[40rem]:flex-1 @[40rem]:basis-0"
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
      <div className="flex w-full items-center gap-3 @[40rem]:ml-auto @[40rem]:w-auto">
        <BadgeEstado estado={lead.estado} />

        {/* Las acciones van acá y no pegadas al teléfono de arriba: allá el
            número vive adentro del <Link> a la ficha, y un <a> dentro de otro
            <a> no es HTML válido. */}
        {lead.telefono && (
          <AccionesContacto telefono={lead.telefono} nombre={nombreCompleto} />
        )}

        {/* Ancho mínimo para que la columna quede a plomo entre filas aunque
            diga "Ayer" en una y "28 días" en la siguiente. */}
        <span
          className={[
            'min-w-[4.5rem] text-[0.78rem] whitespace-nowrap text-ink-3 tabular-nums @[40rem]:text-right',
            // El "hace cuánto" es lo único que se cae en un contenedor
            // angosto: es contexto. Llamar y WhatsApp se quedan siempre —son
            // la acción que el agente necesita justo cuando está en el
            // teléfono—, y lo que manda ContactadosHoy tampoco se esconde: ahí
            // con qué y a qué hora se contactó es el dato de la pantalla.
            enLugarDelTiempo ? '' : '@max-[30rem]:hidden',
          ]
            .join(' ')
            .trim()}
        >
          {enLugarDelTiempo ?? tiempoTranscurrido(lead.fecha_ultimo_contacto_real)}
        </span>

        {/* Botón y no <Link>: el alta se abre en un modal para no sacar al
            agente de la jornada, que es justo la pantalla que recorre fila
            por fila. */}
        <button
          type="button"
          onClick={() => onRegistrar(lead)}
          aria-label={`Registrar una interacción con ${nombreCompleto}`}
          className="ml-auto rounded-lg bg-brand-soft px-3 py-2 text-[0.78rem] font-semibold whitespace-nowrap text-primary transition-colors hover:bg-primary hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none @[40rem]:ml-0"
        >
          Interacción
        </button>
      </div>
    </li>
  )
}
