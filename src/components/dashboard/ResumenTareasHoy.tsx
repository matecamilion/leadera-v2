import { Link } from 'react-router-dom'
import { IconoCalendario } from '../leads/Iconos'
import { useEventosCalendario, type EventoCalendario } from '../../hooks/useTareas'
import { hoyComoClave } from '../../lib/calendario'

/** Cuántas filas entran en el resumen. El "Ver todo" aparece si hay más. */
const MOSTRADOS = 4

/** Mismos colores que los tres bloques de `PanelDiaTareas`, ya que es lo mismo. */
const PUNTO: Record<EventoCalendario['tipo'], string> = {
  TAREA: 'bg-primary',
  SEGUIMIENTO: 'bg-frio',
  VISITA: 'bg-tibio',
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
 * La agenda de hoy en cuatro renglones: tareas, seguimientos de leads y visitas
 * mezclados y ordenados por hora.
 *
 * Es de sólo lectura a propósito. Completar, cancelar o borrar vive en Tareas,
 * que ya tiene el modelo de permisos y los estados en vuelo; duplicar eso acá
 * significaría montar seis mutaciones en el dashboard para cuatro filas.
 *
 * Reusa `useEventosCalendario` con el mismo día de los dos lados del rango. Es
 * otra entrada de cache que la del mes que pide Tareas —la clave lleva el
 * rango—, pero las dos cuelgan de `CLAVE_TAREAS`: cualquier alta o cambio
 * hecho allá refresca esto sin wiring extra.
 */
export function ResumenTareasHoy() {
  const hoy = hoyComoClave()
  const { data, isPending, isError } = useEventosCalendario(hoy, hoy)

  if (isError) return null
  if (isPending || !data) return <SkeletonSeccion />

  const eventos = [...data].sort(porHora)
  const visibles = eventos.slice(0, MOSTRADOS)
  const hayMas = eventos.length > visibles.length

  return (
    <section className="mb-8">
      <header className="mb-3">
        <div className="flex flex-wrap items-center gap-2">
          <span
            aria-hidden
            className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-cool-soft text-frio"
          >
            <IconoCalendario className="size-[18px]" />
          </span>

          <h2 className="m-0 text-[1.05rem] font-bold text-ink">Agenda de hoy</h2>

          <span className="rounded-full bg-cool-soft px-2.5 py-0.5 text-[0.72rem] font-bold text-frio">
            {eventos.length} {eventos.length === 1 ? 'evento' : 'eventos'}
          </span>

          {hayMas && (
            <Link
              to="/tareas"
              className="ml-auto text-[0.82rem] font-semibold whitespace-nowrap text-primary hover:underline"
            >
              Ver todo ({eventos.length}) →
            </Link>
          )}
        </div>

        <p className="mt-1 text-[0.85rem] text-ink-3">
          Tareas, seguimientos y visitas del día
        </p>
      </header>

      {eventos.length === 0 ? (
        <p className="rounded-[14px] border border-dashed border-border bg-surface-2 px-4 py-6 text-center text-[0.88rem] text-ink-3">
          No tenés nada agendado para hoy.
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-[14px] border border-border bg-surface">
          {visibles.map((evento) => (
            <FilaEvento key={evento.id} evento={evento} />
          ))}
        </ul>
      )}
    </section>
  )
}

/**
 * Un evento del día. Sin acciones: el punto de color dice de qué tipo es.
 *
 * Un seguimiento se resuelve en la ficha del lead —ahí está el historial y el
 * alta de interacción—, así que va derecho ahí. Tareas y visitas se gestionan
 * en el calendario, que es donde viven sus permisos y sus estados.
 */
function FilaEvento({ evento }: { evento: EventoCalendario }) {
  const completada = evento.completada === true
  // Una visita ya resuelta se aclara; una agendada no necesita rótulo, que es
  // lo que se espera de algo que está en la agenda de hoy.
  const cerrada = evento.estadoVisita && evento.estadoVisita !== 'AGENDADA'

  const destino =
    evento.tipo === 'SEGUIMIENTO' && evento.leadId
      ? `/leads/${evento.leadId}`
      : '/tareas'

  return (
    <li>
      <Link
        to={destino}
        // El outline va hacia adentro: la `ul` recorta con `overflow-hidden` y
        // un offset positivo dejaría el foco de la primera fila invisible.
        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
      >
        <span
          aria-hidden
          className={`size-2 shrink-0 rounded-full ${PUNTO[evento.tipo]} ${completada ? 'opacity-40' : ''}`}
        />

        <span className="min-w-0 flex-1">
          <span
            className={`block truncate font-semibold ${completada ? 'text-ink-3 line-through' : 'text-ink'}`}
          >
            {evento.titulo}
          </span>
          <span className="mt-0.5 block truncate text-[0.78rem] text-ink-3">
            {ETIQUETA[evento.tipo]}
            {cerrada ? ` · ${evento.estadoVisita?.toLowerCase()}` : ''}
          </span>
        </span>

        <span className="min-w-[3.5rem] shrink-0 text-right text-[0.8rem] whitespace-nowrap text-ink-3 tabular-nums">
          {evento.hora ?? '—'}
        </span>
      </Link>
    </li>
  )
}

/**
 * Mismo idioma visual que el skeleton de Mi día: barra de título y un bloque
 * del alto que va a ocupar la lista, para que no salte al llegar los datos.
 */
function SkeletonSeccion() {
  return (
    <div aria-hidden className="mb-8">
      <div className="mb-3 h-8 w-56 animate-pulse rounded bg-surface-2 motion-reduce:animate-none" />
      <div className="h-[229px] animate-pulse rounded-[14px] bg-surface-2 motion-reduce:animate-none" />
    </div>
  )
}
