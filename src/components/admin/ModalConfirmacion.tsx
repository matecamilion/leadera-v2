import { useEffect, useRef, type ReactNode } from 'react'

/**
 * Confirmación simple de una acción del panel, sin nota.
 *
 * Para lo que el RPC no pide motivo (cambiar el tipo de cuenta). Las acciones
 * que sí lo piden usan `ModalAccionConNota`. Mismo shell: <dialog> nativo,
 * `onCancel` interceptado y el error de la mutación tal cual lo redactó el RPC.
 */
export function ModalConfirmacion({
  abierto,
  titulo,
  subtitulo,
  descripcion,
  textoConfirmar,
  textoConfirmando,
  destructivo = false,
  guardando,
  error,
  onCerrar,
  onConfirmar,
}: {
  abierto: boolean
  titulo: string
  subtitulo?: string
  descripcion: ReactNode
  textoConfirmar: string
  textoConfirmando: string
  /** Pinta el botón de confirmar en rojo. */
  destructivo?: boolean
  guardando: boolean
  error: string | null
  onCerrar: () => void
  onConfirmar: () => void
}) {
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
      aria-label={titulo}
      onCancel={(e) => {
        e.preventDefault()
        if (!guardando) onCerrar()
      }}
      className="m-auto w-[440px] max-w-[92vw] rounded-[20px] border-none p-0 shadow-modal backdrop:bg-[rgba(15,23,42,0.6)] backdrop:backdrop-blur-[4px]"
    >
      <div className="box-border max-h-[85vh] overflow-y-auto p-[30px] text-left">
        <h3 className="mb-1 text-center text-titulo font-bold text-ink">{titulo}</h3>
        {subtitulo && <p className="mb-4 text-center text-cuerpo text-ink-3">{subtitulo}</p>}

        <p className="mb-0 rounded-xl border border-border bg-background px-4 py-3 text-cuerpo text-ink-2">
          {descripcion}
        </p>

        {error && (
          <p role="alert" className="mt-3 mb-0 text-cuerpo text-peligro-ink">
            {error}
          </p>
        )}

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onCerrar}
            disabled={guardando}
            className="flex-1 rounded-lg border border-border bg-surface px-4 py-2.5 text-cuerpo font-semibold text-ink-2 transition-colors hover:border-ink-subtle hover:text-ink disabled:opacity-60 motion-reduce:transition-none"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            disabled={guardando}
            className={`flex-1 rounded-lg px-4 py-2.5 text-cuerpo font-semibold text-primary-contrast transition-colors disabled:opacity-60 motion-reduce:transition-none ${
              destructivo ? 'bg-peligro hover:bg-peligro-hover' : 'bg-primary hover:bg-primary-hover'
            }`}
          >
            {guardando ? textoConfirmando : textoConfirmar}
          </button>
        </div>
      </div>
    </dialog>
  )
}
