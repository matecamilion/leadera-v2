import { useEffect, useRef } from 'react'
import { IconoAlerta } from './Iconos'

interface ModalEliminarLeadProps {
  abierto: boolean
  /** Nombre mostrado sólo para el aria-label; el copy es el del original. */
  nombreLead: string
  eliminando: boolean
  /** Mensaje a mostrar si el borrado falló. El modal queda abierto. */
  error?: string | null
  onCancelar: () => void
  onConfirmar: () => void
}

/**
 * Confirmación de borrado. Usa <dialog> nativo como el Angular, así se lleva
 * gratis el foco atrapado, el cierre con Escape y el backdrop.
 */
export function ModalEliminarLead({
  abierto,
  nombreLead,
  eliminando,
  error,
  onCancelar,
  onConfirmar,
}: ModalEliminarLeadProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (abierto && !dialog.open) dialog.showModal()
    if (!abierto && dialog.open) dialog.close()
  }, [abierto])

  return (
    <dialog
      ref={ref}
      aria-label={`Eliminar el lead ${nombreLead}`}
      // El Escape del <dialog> cierra sin avisar al padre: lo interceptamos
      // para que el estado de React no quede desincronizado.
      onCancel={(e) => {
        e.preventDefault()
        if (!eliminando) onCancelar()
      }}
      // `m-auto` es necesario: el preflight de Tailwind pone margin:0 en todo
      // y le saca al <dialog> nativo el centrado que trae por defecto.
      className="m-auto w-[350px] max-w-[95vw] rounded-[20px] border-none p-0 shadow-modal backdrop:bg-[rgba(15,23,42,0.6)] backdrop:backdrop-blur-[4px]"
    >
      <div className="box-border p-[30px] text-center">
        <IconoAlerta className="mx-auto size-10 text-peligro" />

        <h3 className="mt-3 text-lg font-bold text-ink">¿Eliminar este lead?</h3>
        <p className="mt-2 text-[0.9rem] leading-relaxed text-ink-3">
          Esta acción es permanente. Una vez eliminado, no vas a poder recuperar su
          información, interacciones ni operaciones asociadas.
        </p>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-sm border border-peligro-borde bg-peligro-soft px-3 py-2 text-[0.85rem] text-peligro-ink"
          >
            {error}
          </p>
        )}

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onCancelar}
            disabled={eliminando}
            className="flex-1 rounded-lg border border-border bg-transparent px-4 py-2 font-semibold text-ink-2 transition-colors hover:bg-background disabled:opacity-60 motion-reduce:transition-none"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            disabled={eliminando}
            className="flex-1 rounded-lg border-none bg-peligro px-4 py-2.5 text-[0.92rem] font-bold text-white transition-colors hover:bg-peligro-hover disabled:opacity-60 motion-reduce:transition-none"
          >
            {eliminando ? 'Eliminando…' : 'Sí, eliminar'}
          </button>
        </div>
      </div>
    </dialog>
  )
}
