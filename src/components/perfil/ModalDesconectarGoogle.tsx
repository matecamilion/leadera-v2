import { useEffect, useRef } from 'react'

/**
 * Confirmación de desconectar Google Calendar.
 *
 * No reusa `ModalConfirmarEliminar` por la misma razón por la que no lo reusa
 * `ModalConfirmarActivo`: aquel está cableado para borrar —ícono de alerta,
 * botón rojo, "Sí, eliminar"— y esto no destruye nada del lado del agente. Se
 * dejan de sincronizar tareas y visitas, y vuelve a conectar cuando quiera.
 *
 * Por eso el botón que confirma va en `bg-primary` y no en `bg-peligro`: es el
 * mismo criterio que ya usa `ModalConfirmarActivo` para su rama reversible.
 */
export function ModalDesconectarGoogle({
  desconectando,
  error,
  onConfirmar,
  onCancelar,
}: {
  desconectando: boolean
  error?: string | null
  onConfirmar: () => void
  onCancelar: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  return (
    <dialog
      ref={ref}
      aria-label="Desconectar Google Calendar"
      // El Escape del <dialog> cierra sin avisarle al padre: se intercepta para
      // que el estado de React no quede desincronizado.
      onCancel={(e) => {
        e.preventDefault()
        if (!desconectando) onCancelar()
      }}
      // `m-auto`: el preflight de Tailwind pone margin:0 y le saca al <dialog>
      // el centrado que trae por defecto.
      className="m-auto w-[380px] max-w-[95vw] rounded-[20px] border-none p-0 shadow-modal backdrop:bg-[rgba(15,23,42,0.6)] backdrop:backdrop-blur-[4px]"
    >
      <div className="box-border p-[30px]">
        <h3 className="m-0 text-lg font-bold text-ink">¿Desconectar Google Calendar?</h3>

        <p className="mt-2 text-[0.9rem] leading-relaxed text-ink-3">
          Vas a dejar de sincronizar tus tareas y visitas automáticamente. Podés
          volver a conectarlo cuando quieras.
        </p>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-peligro-borde bg-peligro-soft px-3 py-2 text-[0.85rem] text-peligro-ink"
          >
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancelar}
            disabled={desconectando}
            className="rounded-lg border border-border px-4 py-2 text-[0.85rem] font-semibold text-ink-2 transition-colors hover:bg-background disabled:opacity-60 motion-reduce:transition-none"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            disabled={desconectando}
            className="rounded-lg bg-primary px-4 py-2 text-[0.85rem] font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-60 motion-reduce:transition-none"
          >
            {desconectando ? 'Desconectando…' : 'Desconectar'}
          </button>
        </div>
      </div>
    </dialog>
  )
}
