import { useEffect, useRef } from 'react'

/**
 * Confirmación de prender la importación de Google Calendar.
 *
 * Existe porque el toggle solo no alcanza para que quede claro el alcance: la
 * primera corrida trae TODO el calendario de los próximos 90 días, y eso
 * incluye la agenda personal del agente. Prenderlo con un click y que aparezcan
 * los turnos del médico como tareas es la clase de sorpresa que hace desconfiar
 * de la app entera.
 *
 * Apagar no tiene modal: la fricción se pone donde algo empieza a pasar, no
 * donde deja de pasar. Mismo criterio que `ModalDesconectarGoogle`, que no
 * destruye nada y por eso confirma en `bg-primary` y no en `bg-peligro`.
 */
export function ModalActivarImportacion({
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
      aria-label="Activar la importación de Google Calendar"
      // El Escape del <dialog> cierra sin avisarle al padre: se intercepta para
      // que el estado de React no quede desincronizado.
      onCancel={(e) => {
        e.preventDefault()
        if (!activando) onCancelar()
      }}
      className="m-auto w-[420px] max-w-[95vw] rounded-[20px] border-none p-0 shadow-modal backdrop:bg-[rgba(15,23,42,0.6)] backdrop:backdrop-blur-[4px]"
    >
      <div className="box-border p-[30px]">
        <h3 className="m-0 text-lg font-bold text-ink">
          ¿Traer tu calendario a LeadEra?
        </h3>

        <p className="mt-2 text-[0.9rem] leading-relaxed text-ink-3">
          Esto va a incluir <strong className="font-semibold text-ink-2">todos</strong> los
          eventos de tu calendario de los próximos 90 días, incluidos los
          personales (turnos, cumpleaños, etc.) que no tengan el prefijo
          “Visita:”.
        </p>

        <p className="mt-3 text-[0.9rem] leading-relaxed text-ink-3">
          Podés desactivarlo cuando quieras. Lo que ya se haya importado queda
          en tu calendario de LeadEra y lo borrás a mano si no lo querés.
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
            Confirmar
          </button>
        </div>
      </div>
    </dialog>
  )
}
