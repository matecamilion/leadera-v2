import { useEffect, useRef } from 'react'

const PASOS = [
  'Abrí LeadEra en Safari y tocá el botón Compartir (el cuadrado con una flecha hacia arriba).',
  'Elegí «Agregar a pantalla de inicio».',
  'Tocá «Agregar».',
]

/**
 * Cómo instalar LeadEra en iPhone y iPad. iOS no ofrece diálogo de instalación:
 * hay que hacerlo a mano desde Safari.
 */
export function GuiaInstalarIos({ onCerrar }: { onCerrar: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  return (
    <dialog
      ref={ref}
      aria-label="Instalar LeadEra en tu iPhone"
      // El Escape del <dialog> cierra sin avisarle al padre: se intercepta para
      // que el estado de React no quede desincronizado.
      onCancel={(e) => {
        e.preventDefault()
        onCerrar()
      }}
      className="m-auto w-[400px] max-w-[95vw] rounded-[20px] border-none p-0 shadow-modal backdrop:bg-[rgba(15,23,42,0.6)] backdrop:backdrop-blur-[4px]"
    >
      <div className="box-border p-[30px]">
        <h3 className="m-0 text-lg font-bold text-ink">Instalá LeadEra en tu iPhone</h3>

        <ol className="mt-4 mb-0 list-decimal space-y-2 pl-5 text-[0.9rem] leading-relaxed text-ink-2">
          {PASOS.map((paso) => (
            <li key={paso}>{paso}</li>
          ))}
        </ol>

        <p className="mt-4 mb-0 text-[0.9rem] leading-relaxed text-ink-3">
          Después abrí LeadEra desde ese ícono, no desde Safari: es necesario para recibir
          notificaciones más adelante.
        </p>

        <div className="mt-6 flex sm:justify-end">
          <button
            type="button"
            onClick={onCerrar}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-[0.85rem] font-semibold text-primary-contrast transition-colors hover:bg-primary-dark motion-reduce:transition-none sm:w-auto"
          >
            Entendido
          </button>
        </div>
      </div>
    </dialog>
  )
}
