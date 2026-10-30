import { useEffect, useId, useRef, useState } from 'react'

interface ModalFechaEscrituraProps {
  /** `YYYY-MM-DD`. Con lo que arranca el campo. */
  fechaInicial: string
  /** Hoy en Buenos Aires: la fecha máxima. */
  hoy: string
  /** La postventa ya se agendó para esta escritura: la leyenda lo dice en vez de prometerla. */
  postventaYaGenerada: boolean
  procesando: boolean
  onConfirmar: (fecha: string) => void
  onCancelar: () => void
}

/**
 * Pide la fecha en que se firmó la escritura antes de marcarla.
 *
 * De esa fecha salen las tareas de postventa, y corregirla después no las mueve:
 * por eso se pregunta antes y no se marca con la de hoy.
 *
 * Se monta solo mientras está abierto y se abre al montarse, así que cada vez
 * arranca con su fecha inicial. Es un <form>: Enter en el campo confirma, y el
 * Escape nativo del <dialog> cierra (se intercepta para avisar al padre).
 */
export function ModalFechaEscritura({
  fechaInicial,
  hoy,
  postventaYaGenerada,
  procesando,
  onConfirmar,
  onCancelar,
}: ModalFechaEscrituraProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const idTitulo = useId()
  const idError = useId()
  const [fecha, setFecha] = useState(fechaInicial)
  const [intentado, setIntentado] = useState(false)

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  const error = !fecha
    ? 'Elegí la fecha de la escritura.'
    : fecha > hoy
      ? 'La fecha no puede ser futura.'
      : null
  const mostrarError = error !== null && (intentado || fecha > hoy)

  function enviar(evento: React.FormEvent) {
    evento.preventDefault()
    if (procesando) return
    if (error) {
      setIntentado(true)
      return
    }
    onConfirmar(fecha)
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={idTitulo}
      onCancel={(e) => {
        e.preventDefault()
        if (!procesando) onCancelar()
      }}
      // `m-auto`: el preflight de Tailwind pone margin:0 y le saca al <dialog>
      // el centrado que trae por defecto.
      className="m-auto w-[380px] max-w-[95vw] rounded-[20px] border-none bg-surface p-0 text-ink shadow-modal backdrop:bg-[rgba(15,23,42,0.6)] backdrop:backdrop-blur-[4px]"
    >
      <form onSubmit={enviar} noValidate className="box-border p-6">
        <h3 id={idTitulo} className="m-0 text-lg font-bold text-ink">
          Fecha de la escritura
        </h3>
        <p className="mt-2 text-[0.9rem] leading-relaxed break-words text-ink-3">
          {postventaYaGenerada
            ? 'Las tareas de postventa ya se agendaron y no se vuelven a crear.'
            : 'Las tareas de postventa se agendan a partir de esta fecha'}
        </p>

        <label className="mt-4 block">
          <span className="mb-1.5 block text-xs font-semibold text-ink-3 uppercase">Fecha</span>
          <input
            type="date"
            value={fecha}
            max={hoy}
            disabled={procesando}
            onChange={(e) => setFecha(e.target.value)}
            aria-invalid={mostrarError || undefined}
            aria-describedby={mostrarError ? idError : undefined}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-[0.9rem] text-ink focus:border-primary focus:outline-none focus:[box-shadow:var(--shadow-focus)] disabled:opacity-60"
          />
        </label>
        {mostrarError && (
          <p id={idError} role="alert" className="mt-1 text-[0.78rem] text-peligro-ink">
            {error}
          </p>
        )}

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onCancelar}
            disabled={procesando}
            className="min-h-11 flex-1 rounded-lg border border-border bg-transparent px-4 py-2 font-semibold text-ink-2 transition-colors hover:bg-background disabled:opacity-60 motion-reduce:transition-none"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={procesando}
            className="min-h-11 flex-1 rounded-lg border-none bg-primary px-4 py-2 text-[0.92rem] font-bold text-primary-contrast transition-colors hover:bg-primary-dark disabled:opacity-60 motion-reduce:transition-none"
          >
            {procesando ? 'Confirmando…' : 'Confirmar'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
