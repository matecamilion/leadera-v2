import { Link } from 'react-router-dom'
import { SeccionCard } from './SeccionCard'
import {
  IconoCalendario,
  IconoCasa,
  IconoCheck,
  IconoTelefono,
} from '../leads/Iconos'
import { BadgeEstado } from '../leads/BadgeEstado'
import { AccionesContacto } from '../comunes/AccionesContacto'
import { AyudaSeccion } from '../comunes/AyudaSeccion'
import { TONOS, type TonoKpi } from '../comunes/tonos'
import { useEventosCalendario, type EventoCalendario } from '../../hooks/useTareas'
import type { SeguimientoLead } from '../../lib/api/tareas'
import { hoyComoClave } from '../../lib/calendario'

/** Cuántas filas entran en el resumen. El "Ver todo" aparece si hay más. */
const MOSTRADOS = 6

const AYUDA =
  'Tus tareas, los seguimientos de tus leads y las visitas de hoy, ordenados por hora. Los seguimientos vencidos aparecen en Prioritarios y los futuros, el día que corresponda. No incluye leads ganados.'

/** Lo mínimo para abrir el alta de interacción. */
export interface LeadARegistrar {
  id: string
  nombre: string
  apellido: string | null
}

/**
 * Qué se dibuja para cada tipo de evento.
 *
 * Los tres íconos ya existen en el proyecto y se usan para lo mismo en otro
 * lado: la casa es la de `ItemVisita` y la de Propiedades, el teléfono es el de
 * `AccionesContacto` —un seguimiento es un contacto que se debe— y el check es
 * el de una tarea hecha o por hacer.
 *
 * Los tonos son los mismos colores que tenía el punto y que usan los tres
 * bloques de `PanelDiaTareas`, ahora expresados con la tabla compartida para
 * que un evento acá y el mismo evento allá no se pinten distinto.
 */
const ICONO: Record<EventoCalendario['tipo'], typeof IconoCasa> = {
  TAREA: IconoCheck,
  SEGUIMIENTO: IconoTelefono,
  VISITA: IconoCasa,
}

const TONO: Record<EventoCalendario['tipo'], TonoKpi> = {
  TAREA: 'brand',
  SEGUIMIENTO: 'frio',
  VISITA: 'tibio',
}

const ETIQUETA: Record<EventoCalendario['tipo'], string> = {
  TAREA: 'Tarea',
  SEGUIMIENTO: 'Seguimiento',
  VISITA: 'Visita',
}

/**
 * Los eventos sin hora van al final: son los del día entero, y ponerlos entre
 * dos horarios rompería la lectura de arriba abajo de la agenda.
 */
function porHora(a: EventoCalendario, b: EventoCalendario): number {
  if (!a.hora) return b.hora ? 1 : 0
  if (!b.hora) return -1
  // Ambas son `HH:MM` de largo fijo: comparar como texto ya ordena por reloj.
  return a.hora.localeCompare(b.hora)
}

/**
 * La agenda de hoy en seis renglones: tareas, seguimientos de leads y visitas
 * mezclados y ordenados por hora.
 *
 * Tareas y visitas son de sólo lectura a propósito. Completar, cancelar o
 * borrar vive en Tareas, que ya tiene el modelo de permisos y los estados en
 * vuelo; duplicar eso acá significaría montar seis mutaciones en el dashboard.
 * Los seguimientos sí traen sus acciones —llamar, WhatsApp, registrar—: son
 * los contactos del día y se resuelven sin salir de Mi día.
 *
 * Reusa `useEventosCalendario` con el mismo día de los dos lados del rango. Es
 * otra entrada de cache que la del mes que pide Tareas —la clave lleva el
 * rango—, pero las dos cuelgan de `CLAVE_TAREAS`: cualquier alta o cambio
 * hecho allá refresca esto sin wiring extra.
 */
export function ResumenTareasHoy({
  className = '',
  onRegistrar,
}: {
  className?: string
  /** Abre el alta de interacción de un seguimiento. El modal lo monta la página. */
  onRegistrar?: (lead: LeadARegistrar) => void
}) {
  const hoy = hoyComoClave()
  const { data, isPending, isError } = useEventosCalendario(hoy, hoy)

  if (isError) return null
  // El skeleton también lleva las utilidades del contenedor: si no, la sección
  // ocuparía media columna mientras carga y saltaría al ancho completo después.
  if (isPending || !data) return <SkeletonSeccion className={className} />

  // Un lead GANADO ya no es a quién volver a llamar. Se saca acá y no en la
  // query porque el calendario de Tareas comparte esa query y los muestra.
  const eventos = data
    .filter((e) => !(e.tipo === 'SEGUIMIENTO' && e.estadoLead === 'GANADO'))
    .sort(porHora)
  const visibles = eventos.slice(0, MOSTRADOS)
  const hayMas = eventos.length > visibles.length

  return (
    <SeccionCard
      icono={<IconoCalendario className="size-4" />}
      tono="frio"
      titulo="Agenda de hoy"
      ayuda={<AyudaSeccion titulo="Agenda de hoy" texto={AYUDA} />}
      subtitulo="Tareas, seguimientos y visitas del día"
      badge={`${eventos.length} ${eventos.length === 1 ? 'evento' : 'eventos'}`}
      verTodos={hayMas ? { ruta: '/tareas', texto: `Ver todo (${eventos.length}) →` } : undefined}
      className={className}
    >
      {eventos.length === 0 ? (
        <p className="rounded-[14px] border border-dashed border-border bg-surface-2 px-4 py-6 text-center text-[0.88rem] text-ink-3">
          No tenés nada agendado para hoy.
        </p>
      ) : (
        // `@container`: la fila de seguimiento parte sus acciones a un segundo
        // renglón según el ancho de la lista, igual que `FilaLeadDensa`.
        //
        // Sin borde ni radio propios: los pone la card que la envuelve.
        <ul className="@container divide-y divide-border">
          {visibles.map((evento) =>
            evento.tipo === 'SEGUIMIENTO' ? (
              <FilaSeguimiento key={evento.id} evento={evento} onRegistrar={onRegistrar} />
            ) : (
              <FilaEvento key={evento.id} evento={evento} />
            ),
          )}
        </ul>
      )}
    </SeccionCard>
  )
}

/**
 * Una tarea o visita del día. Sin acciones: el punto de color dice de qué tipo
 * es, y se gestionan en el calendario, que es donde viven sus permisos y sus
 * estados.
 */
function FilaEvento({ evento }: { evento: EventoCalendario }) {
  const completada = evento.completada === true
  // Una visita ya resuelta se aclara; una agendada no necesita rótulo, que es
  // lo que se espera de algo que está en la agenda de hoy.
  const cerrada = evento.estadoVisita && evento.estadoVisita !== 'AGENDADA'
  const Icono = ICONO[evento.tipo]

  return (
    <li>
      <Link
        to="/tareas"
        // El outline va hacia adentro: la `ul` recorta con `overflow-hidden` y
        // un offset positivo dejaría el foco de la primera fila invisible.
        className="flex items-center gap-2.5 px-4 py-2 transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
      >
        <span
          aria-hidden
          className={`grid size-7 shrink-0 place-items-center rounded-[10px] ${TONOS[TONO[evento.tipo]]} ${completada ? 'opacity-50' : ''}`}
        >
          <Icono className="size-[15px]" />
        </span>

        <span className="min-w-0 flex-1">
          <span
            className={`block truncate text-[0.9rem] font-semibold ${completada ? 'text-ink-3 line-through' : 'text-ink'}`}
          >
            {evento.titulo}
          </span>
          <span className="mt-0.5 block truncate text-[0.74rem] text-ink-3">
            {ETIQUETA[evento.tipo]}
            {cerrada ? ` · ${evento.estadoVisita?.toLowerCase()}` : ''}
          </span>
        </span>

        <span className="min-w-[3.5rem] shrink-0 text-right text-[0.74rem] whitespace-nowrap text-ink-3 tabular-nums">
          {evento.hora ?? '—'}
        </span>
      </Link>
    </li>
  )
}

/**
 * Un seguimiento del día: a quién hay que volver a contactar, con las mismas
 * acciones que tenía la vieja sección de Seguimientos.
 *
 * Mismo armado que `FilaLeadDensa`: el link a la ficha y las acciones son
 * hermanos, porque un <a> dentro de otro <a> no es HTML válido. Por debajo de
 * 28rem las acciones caen a un segundo renglón.
 */
function FilaSeguimiento({
  evento,
  onRegistrar,
}: {
  evento: EventoCalendario
  onRegistrar?: (lead: LeadARegistrar) => void
}) {
  const lead = evento.raw as SeguimientoLead
  const nombreCompleto = `${lead.nombre} ${lead.apellido ?? ''}`.trim()
  const Icono = ICONO.SEGUIMIENTO

  return (
    <li className="flex flex-wrap items-center gap-x-2.5 gap-y-2 px-4 py-2 transition-colors hover:bg-surface-2 motion-reduce:transition-none">
      <Link
        to={`/leads/${lead.id}`}
        className="flex min-w-0 shrink basis-full items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary @[28rem]:flex-1 @[28rem]:basis-0"
      >
        <span
          aria-hidden
          className={`grid size-7 shrink-0 place-items-center rounded-[10px] ${TONOS[TONO.SEGUIMIENTO]}`}
        >
          <Icono className="size-[15px]" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.9rem] font-semibold text-ink">
            {evento.titulo}
          </span>
          <span className="mt-0.5 block truncate text-[0.74rem] text-ink-3">
            {ETIQUETA.SEGUIMIENTO}
          </span>
        </span>
      </Link>

      <div className="flex w-full items-center gap-2.5 @[28rem]:w-auto">
        <BadgeEstado estado={evento.estadoLead ?? null} />

        {evento.telefono && (
          <AccionesContacto telefono={evento.telefono} nombre={nombreCompleto} />
        )}

        {onRegistrar && (
          <button
            type="button"
            onClick={() => onRegistrar({ id: lead.id, nombre: lead.nombre, apellido: lead.apellido })}
            aria-label={`Registrar una interacción con ${nombreCompleto}`}
            className="rounded-lg bg-brand-soft px-2.5 py-1.5 text-[0.74rem] font-semibold whitespace-nowrap text-primary transition-colors hover:bg-primary hover:text-primary-contrast focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
          >
            Interacción
          </button>
        )}

        {/* Misma columna de hora que las otras filas, para que quede a plomo.
            En el renglón de abajo se va al borde derecho. */}
        <span className="ml-auto min-w-[3.5rem] shrink-0 text-right text-[0.74rem] whitespace-nowrap text-ink-3 tabular-nums">
          {evento.hora ?? '—'}
        </span>
      </div>
    </li>
  )
}

/**
 * Mismo idioma visual que el skeleton de Mi día: barra de título y un bloque
 * del alto que va a ocupar la lista, para que no salte al llegar los datos.
 */
function SkeletonSeccion({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden className={`mb-5 ${className}`.trim()}>
      <div className="mb-3 h-8 w-56 animate-pulse rounded bg-surface-2 motion-reduce:animate-none" />
      <div className="h-[309px] animate-pulse rounded-2xl bg-surface-2 motion-reduce:animate-none" />
    </div>
  )
}
