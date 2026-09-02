import { etiquetaTipoInteraccion, type Interaccion } from '../../lib/api/interacciones'
import { IconoCasa, IconoChat, IconoConversacion } from '../leads/Iconos'

const DIA_MES = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long' })
const DIA_MES_ANIO = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})
const HORA = new Intl.DateTimeFormat('es-AR', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/** "24 de agosto, 14:30". El año sólo aparece si no es el actual. */
function formatearMomento(iso: string): string {
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) return '—'
  const esteAnio = fecha.getFullYear() === new Date().getFullYear()
  const dia = (esteAnio ? DIA_MES : DIA_MES_ANIO).format(fecha)
  return `${dia}, ${HORA.format(fecha)}`
}

const ESTILOS_BADGE: Record<string, string> = {
  VISITA: 'bg-badge-frio-bg text-frio',
  CONSULTA: 'bg-badge-tibio-bg text-badge-tibio-ink',
}

interface TimelineEventosProps {
  eventos: Interaccion[]
  cargando: boolean
  errorCarga?: string | null
}

/**
 * Actividad de la operación. Sólo lectura.
 *
 * Tuvo un formulario para cargar eventos a mano; se sacó a propósito. Lo que
 * aparece acá se genera solo: al marcar una visita como realizada, la
 * interacción que se crea hereda el `operacion_id` de esa visita. Un camino
 * único evita que el mismo hecho quede cargado dos veces —una a mano y otra
 * por la visita— y que el timeline discuta con el historial del lead.
 */
export function TimelineEventos({ eventos, cargando, errorCarga }: TimelineEventosProps) {
  if (cargando) {
    return (
      <div className="rounded-[14px] border border-border bg-surface px-6 py-5">
        <div aria-busy="true" aria-label="Cargando eventos" className="space-y-4 pl-8">
          {Array.from({ length: 2 }, (_, i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-xl bg-surface-2 motion-reduce:animate-none"
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-[14px] border border-border bg-surface px-6 py-5">
      {errorCarga ? (
        <p role="alert" className="text-[0.9rem] text-peligro-ink">
          {errorCarga}
        </p>
      ) : eventos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-background px-5 py-8 text-center text-ink-3">
          <div className="mb-2 flex justify-center text-ink-4">
            <IconoConversacion className="size-8" />
          </div>
          <p className="text-[0.9rem]">Sin actividad registrada aún.</p>
          {/* Sin formulario acá, el usuario necesita saber de dónde sale esto o
              el panel vacío es un callejón. */}
          <p className="mt-1 text-[0.8rem] text-ink-4">
            Se registra sola cuando marcás como realizada una visita vinculada a
            esta operación.
          </p>
        </div>
      ) : (
        <ol className="relative space-y-4 pl-8 before:absolute before:top-2 before:bottom-0 before:left-[7px] before:w-0.5 before:bg-border">
          {eventos.map((evento) => (
            <li key={evento.id} className="relative">
              <span
                aria-hidden
                className="absolute top-3 -left-8 z-[2] size-3 rounded-full border-[3px] border-surface bg-primary"
              />
              <article className="rounded-xl border border-border bg-surface px-5 py-4 shadow-sm">
                <header className="mb-2 flex flex-col gap-1 min-[600px]:flex-row min-[600px]:items-center min-[600px]:justify-between min-[600px]:gap-3">
                  <span
                    className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.7rem] font-extrabold uppercase ${
                      ESTILOS_BADGE[evento.tipo] ?? 'bg-surface-2 text-ink-2'
                    }`}
                  >
                    {evento.tipo === 'VISITA' ? (
                      <IconoCasa className="size-3.5" />
                    ) : (
                      <IconoChat className="size-3.5" />
                    )}
                    {etiquetaTipoInteraccion(evento.tipo)}
                  </span>
                  <span className="text-[0.85rem] text-ink-4">
                    {formatearMomento(evento.fecha)}
                  </span>
                </header>
                <p className="m-0 text-[0.95rem] leading-relaxed break-words text-ink-2">
                  {evento.detalle || 'Sin detalle'}
                </p>
              </article>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
