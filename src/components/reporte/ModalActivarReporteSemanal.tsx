import { useEffect, useRef } from 'react'

/**
 * Confirmación de activar el reporte semanal.
 *
 * Más corto que `ModalActivarImportacion` a propósito: aquel tiene que avisar
 * que entra la agenda personal entera del agente, y acá lo único que pasa es
 * que llega un mail por semana que se puede apagar de un click. La confirmación
 * existe para que nadie estrene una suscripción a mails sin enterarse, no para
 * advertir de un riesgo.
 *
 * Apagar no pasa por acá, igual que en el toggle de Calendar.
 */
export function ModalActivarReporteSemanal({
  activando,
  error,
  onConfirmar,
  onCancelar,
}: {
  activando: boolean
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
      aria-label="Activar el reporte semanal"
      // El Escape del <dialog> cierra sin avisarle al padre: se intercepta para
      // que el estado de React no quede desincronizado.
      onCancel={(e) => {
        e.preventDefault()
        if (!activando) onCancelar()
      }}
      className="m-auto w-[400px] max-w-[95vw] rounded-[20px] border-none p-0 shadow-modal backdrop:bg-[rgba(15,23,42,0.6)] backdrop:backdrop-blur-[4px]"
    >
      <div className="box-border p-[30px]">
        <h3 className="m-0 text-lg font-bold text-ink">¿Activar el reporte semanal?</h3>

        <p className="mt-2 text-[0.9rem] leading-relaxed text-ink-3">
          Vas a recibir un mail todos los lunes a las 9 de la mañana con tu
          resumen semanal. Podés desactivarlo cuando quieras desde tu perfil.
        </p>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-peligro-borde bg-peligro-soft px-3 py-2 text-[0.85rem] text-peligro-ink"
          >
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancelar}
            disabled={activando}
            className="rounded-lg border border-border bg-surface px-4 py-2.5 text-[0.85rem] font-semibold text-ink transition-colors hover:bg-background disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={onConfirmar}
            disabled={activando}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-[0.85rem] font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
          >
            {activando && (
              <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white motion-reduce:animate-none" />
            )}
            Activar
          </button>
        </div>
      </div>
    </dialog>
  )
}
