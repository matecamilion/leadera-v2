import { useEffect, useRef } from 'react'
import { IconoAlerta } from '../leads/Iconos'

interface ModalConfirmarEliminarProps {
  abierto: boolean
  titulo: string
  descripcion: string
  /** Nombre de lo que se borra, sólo para el aria-label. */
  nombre?: string
  eliminando: boolean
  error?: string | null
  onCancelar: () => void
  onConfirmar: () => void
}

/**
 * Confirmación de borrado, con el copy como parámetro.
 *
 * Mismo patrón visual que ModalEliminarLead (Fase 4a-i), pero genérico: aquel
 * tiene el texto de leads hardcodeado y hablaba de "interacciones", que no
 * aplica a una propiedad. Cuando toque limpiar, ModalEliminarLead puede
 * reemplazarse por este.
 */
export function ModalConfirmarEliminar({
  abierto,
  titulo,
  descripcion,
  nombre,
  eliminando,
  error,
  onCancelar,
  onConfirmar,
}: ModalConfirmarEliminarProps) {
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
      aria-label={nombre ? `${titulo} ${nombre}` : titulo}
      // El Escape del <dialog> cierra sin avisar al padre: lo interceptamos
      // para que el estado de React no quede desincronizado.
      onCancel={(e) => {
        e.preventDefault()
        if (!eliminando) onCancelar()
      }}
      // `m-auto`: el preflight de Tailwind pone margin:0 y le saca al <dialog>
      // el centrado que trae por defecto.
      className="m-auto w-[350px] max-w-[95vw] rounded-[20px] border-none p-0 shadow-modal backdrop:bg-[rgba(15,23,42,0.6)] backdrop:backdrop-blur-[4px]"
    >
      <div className="box-border p-[30px] text-center">
        <IconoAlerta className="mx-auto size-10 text-peligro" />

        <h3 className="mt-3 text-lg font-bold text-ink">{titulo}</h3>
        <p className="mt-2 text-[0.9rem] leading-relaxed text-ink-3">{descripcion}</p>

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
            className="flex-1 rounded-lg border border-caliente bg-transparent px-4 py-2 font-semibold text-caliente transition-colors hover:bg-hot-soft disabled:opacity-60 motion-reduce:transition-none"
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
