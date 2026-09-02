import type { Interaccion, TipoInteraccion } from '../../lib/api/interacciones'
import {
  dentroDeVentanaDeEdicion,
  etiquetaTipoInteraccion,
  HORAS_DE_EDICION,
} from '../../lib/api/interacciones'
import {
  IconoCasa,
  IconoChat,
  IconoConversacion,
  IconoLapiz,
  IconoMail,
  IconoReloj,
  IconoTacho,
  IconoTelefono,
  IconoUsuarios,
} from './Iconos'

const ICONOS: Record<TipoInteraccion, (p: { className?: string }) => React.ReactElement> = {
  LLAMADA: IconoTelefono,
  WHATSAPP: IconoChat,
  EMAIL: IconoMail,
  VISITA: IconoCasa,
  REUNION: IconoUsuarios,
  NOTA_INTERNA: IconoLapiz,
  SEGUIMIENTO: IconoReloj,
  // Se registra desde el timeline de una operación, pero cae en el historial
  // del lead como cualquier otra.
  CONSULTA: IconoConversacion,
}

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

/**
 * "24 de agosto, 14:30". El año sólo aparece si no es el actual: en un
 * historial que casi siempre es reciente, repetirlo es ruido.
 */
function formatearMomento(iso: string): string {
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) return '—'
  const esteAnio = fecha.getFullYear() === new Date().getFullYear()
  const dia = (esteAnio ? DIA_MES : DIA_MES_ANIO).format(fecha)
  return `${dia}, ${HORA.format(fecha)}`
}

interface TimelineInteraccionesProps {
  interacciones: Interaccion[]
  cargando: boolean
  error?: string | null
  /**
   * Acciones por fila. Si no vienen, el timeline queda de sólo lectura: así lo
   * usa cualquier pantalla que muestre el historial sin poder tocarlo.
   */
  onEditar?: (interaccion: Interaccion) => void
  onEliminar?: (interaccion: Interaccion) => void
}

export function TimelineInteracciones({
  interacciones,
  cargando,
  error,
  onEditar,
  onEliminar,
}: TimelineInteraccionesProps) {
  if (cargando) return <Skeleton />

  if (error) {
    return (
      <p
        role="alert"
        className="rounded-lg border border-peligro-borde bg-peligro-soft px-4 py-3 text-[0.9rem] text-peligro-ink"
      >
        {error}
      </p>
    )
  }

  if (interacciones.length === 0) {
    return (
      <div className="rounded-[16px] border border-dashed border-border bg-surface-2 px-5 py-10 text-center text-ink-3">
        <div className="mb-2 flex justify-center text-ink-4">
          <IconoConversacion className="size-10" />
        </div>
        <h3 className="mb-1.5 font-semibold text-ink-2">Sin interacciones</h3>
        <p className="text-[0.9rem]">
          Todavía no registraste ninguna conversación con este lead.
        </p>
      </div>
    )
  }

  return (
    // La línea vertical es un ::before del contenedor; los puntos se posicionan
    // encima de ella con `-left-8`, igual que el original.
    <ol className="relative space-y-5 pl-8 before:absolute before:top-2 before:bottom-0 before:left-[7px] before:w-0.5 before:bg-border">
      {interacciones.map((interaccion) => {
        const Icono = ICONOS[interaccion.tipo] ?? IconoReloj
        // La policy de la base es la que decide; esto sólo evita ofrecer un
        // botón que iba a rebotar. Se calcula en el render: la ventana casi
        // nunca vence con la pantalla abierta, y si pasa, el error de la base
        // lo explica.
        const editable = dentroDeVentanaDeEdicion(interaccion.created_at)
        const hayAcciones = Boolean(onEditar || onEliminar)
        return (
          <li key={interaccion.id} className="relative">
            <span
              aria-hidden
              className="absolute top-3 -left-8 z-[2] size-3 rounded-full border-[3px] border-surface bg-primary"
            />

            <article className="rounded-xl border border-border bg-surface px-5 py-4 shadow-sm">
              <header className="mb-2 flex flex-col gap-1 min-[600px]:flex-row min-[600px]:flex-wrap min-[600px]:items-center min-[600px]:justify-between min-[600px]:gap-3">
                <span className="flex items-center gap-2 font-semibold text-ink-2">
                  <Icono className="size-5 text-primary" />
                  {etiquetaTipoInteraccion(interaccion.tipo)}
                </span>
                <span className="text-[0.85rem] text-ink-4">
                  {formatearMomento(interaccion.fecha)}
                </span>
              </header>

              <p className="m-0 text-[0.95rem] leading-relaxed break-words text-ink-2">
                {interaccion.detalle || 'Sin detalle'}
              </p>

              {hayAcciones && (
                <footer className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-border pt-2.5">
                  {editable ? (
                    <>
                      {onEditar && (
                        <button
                          type="button"
                          onClick={() => onEditar(interaccion)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-transparent px-3 py-[6px] text-[0.8rem] font-medium text-ink-3 transition hover:border-primary hover:text-primary motion-reduce:transition-none"
                        >
                          <IconoLapiz className="size-4" />
                          Editar
                        </button>
                      )}
                      {onEliminar && (
                        <button
                          type="button"
                          onClick={() => onEliminar(interaccion)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-caliente bg-transparent px-3 py-[6px] text-[0.8rem] font-medium text-caliente opacity-65 transition hover:bg-hot-soft hover:opacity-100 motion-reduce:transition-none"
                        >
                          <IconoTacho className="size-4" />
                          Eliminar
                        </button>
                      )}
                    </>
                  ) : (
                    // Texto chico en vez de botones apagados: es el mismo
                    // recurso que usa la ficha de la operación cerrada, y no
                    // deja un control que no lleva a ningún lado.
                    <p className="text-[0.8rem] text-ink-3">
                      No editable (pasaron {HORAS_DE_EDICION}hs)
                    </p>
                  )}
                </footer>
              )}
            </article>
          </li>
        )
      })}
    </ol>
  )
}

function Skeleton() {
  return (
    <div aria-busy="true" aria-label="Cargando interacciones" className="space-y-5 pl-8">
      {Array.from({ length: 3 }, (_, i) => (
        <div
          key={i}
          className="h-24 animate-pulse rounded-xl bg-surface-2 motion-reduce:animate-none"
        />
      ))}
    </div>
  )
}
