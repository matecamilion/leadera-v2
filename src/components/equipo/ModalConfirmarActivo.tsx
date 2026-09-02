import { useEffect, useRef } from 'react'
import type { Miembro } from '../../lib/api/equipo'

/**
 * Confirmación de activar/desactivar.
 *
 * No reusa `ModalConfirmarEliminar` porque ese está cableado para borrar: el
 * ícono es de alerta, los botones son rojos y el confirmar dice "Sí, eliminar".
 * Acá desactivar es reversible y activar directamente no tiene nada de
 * destructivo, así que el modal cambia de tono según la acción.
 */
export function ModalConfirmarActivo({
  miembro,
  guardando,
  onConfirmar,
  onCancelar,
}: {
  miembro: Miembro
  guardando: boolean
  onConfirmar: () => void
  onCancelar: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const desactivando = miembro.activo
  const nombre = `${miembro.nombre} ${miembro.apellido}`.trim()

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  return (
    <dialog
      ref={ref}
      aria-label={desactivando ? `Desactivar a ${nombre}` : `Activar a ${nombre}`}
      onCancel={(e) => {
        e.preventDefault()
        if (!guardando) onCancelar()
      }}
      className="m-auto w-[380px] max-w-[95vw] rounded-[20px] border-none p-0 shadow-modal backdrop:bg-[rgba(15,23,42,0.6)] backdrop:backdrop-blur-[4px]"
    >
      <div className="box-border p-[30px]">
        <h3 className="m-0 text-lg font-bold text-ink">
          {desactivando ? `¿Desactivar a ${nombre}?` : `¿Activar a ${nombre}?`}
        </h3>

        <p className="mt-2 text-[0.9rem] leading-relaxed text-ink-3">
          {desactivando
            ? 'No va a poder entrar hasta que lo reactives. Sus leads y su historial quedan como están, y el lugar en el plan lo sigue ocupando.'
            : 'Va a volver a poder entrar con su cuenta y con los mismos datos de antes.'}
        </p>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancelar}
            disabled={guardando}
            className="rounded-lg border border-border px-4 py-2 text-[0.85rem] font-semibold text-ink-2 transition-colors hover:bg-background disabled:opacity-60 motion-reduce:transition-none"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            disabled={guardando}
            className={[
              'rounded-lg px-4 py-2 text-[0.85rem] font-semibold text-white',
              'transition-colors disabled:opacity-60 motion-reduce:transition-none',
              desactivando ? 'bg-peligro hover:bg-peligro-hover' : 'bg-primary hover:bg-primary-dark',
            ].join(' ')}
          >
            {guardando ? 'Guardando…' : desactivando ? 'Desactivar' : 'Activar'}
          </button>
        </div>
      </div>
    </dialog>
  )
}
