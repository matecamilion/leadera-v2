import { useEffect, useId, useRef, useState } from 'react'

/** Motivos rápidos. "Otro" abre el texto libre. */
const MOTIVOS = ['Solo curiosidad', 'Fuera de presupuesto', 'Datos inválidos', 'Otro'] as const
type Motivo = (typeof MOTIVOS)[number]

interface Props {
  abierto: boolean
  nombre: string
  descartando: boolean
  error: string | null
  onCancelar: () => void
  onConfirmar: (motivo: string | null) => void
}

/**
 * Confirmación de descarte, con motivo opcional.
 *
 * Tiene que ser explícita: no hay forma de deshacer un descarte. El motivo no
 * es obligatorio para no frenar a quien descarta veinte curiosos seguidos.
 */
export function ModalDescartar({ abierto, nombre, descartando, error, onCancelar, onConfirmar }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const [motivo, setMotivo] = useState<Motivo | null>(null)
  const [otro, setOtro] = useState('')
  const idTitulo = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (abierto && !dialog.open) dialog.showModal()
    if (!abierto && dialog.open) dialog.close()
  }, [abierto])

  function confirmar() {
    const texto = motivo === 'Otro' ? otro.trim().slice(0, 300) || 'Otro' : motivo
    onConfirmar(texto)
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={idTitulo}
      onCancel={(e) => {
        e.preventDefault()
        if (!descartando) onCancelar()
      }}
      className="m-auto w-[380px] max-w-[95vw] rounded-[20px] border-none p-0 shadow-modal backdrop:bg-[rgba(15,23,42,0.6)] backdrop:backdrop-blur-[4px]"
    >
      <div className="box-border p-6">
        <h3 id={idTitulo} className="m-0 text-lg font-bold text-ink">
          ¿Descartar la consulta de {nombre}?
        </h3>
        <p className="mt-1.5 text-[0.88rem] leading-relaxed text-ink-3">
          No pasa a tus leads y no se puede deshacer.
        </p>

        <fieldset className="mt-4 border-none p-0">
          <legend className="mb-2 text-[0.8rem] font-semibold text-ink-2">
            Motivo <span className="font-normal text-ink-4">(opcional)</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {MOTIVOS.map((m) => {
              const activo = motivo === m
              return (
                <button
                  key={m}
                  type="button"
                  aria-pressed={activo}
                  onClick={() => setMotivo(activo ? null : m)}
                  className={[
                    'rounded-full border px-3 py-1.5 text-[0.8rem] font-medium transition-colors motion-reduce:transition-none',
                    activo
                      ? 'border-primary bg-brand-soft text-primary-dark'
                      : 'border-border bg-surface text-ink-2 hover:border-ink-subtle',
                  ].join(' ')}
                >
                  {m}
                </button>
              )
            })}
          </div>
          {motivo === 'Otro' && (
            <textarea
              value={otro}
              onChange={(e) => setOtro(e.target.value)}
              maxLength={300}
              rows={2}
              aria-label="Contanos el motivo"
              placeholder="Contanos el motivo"
              className="mt-3 block w-full resize-none rounded-md border border-border px-3 py-2 text-[0.88rem] text-ink focus:border-primary focus:outline-2 focus:outline-offset-0 focus:outline-primary"
            />
          )}
        </fieldset>

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
            disabled={descartando}
            className="flex-1 rounded-lg border border-border bg-transparent px-4 py-2 font-semibold text-ink-2 transition-colors hover:bg-background disabled:opacity-60 motion-reduce:transition-none"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmar}
            disabled={descartando}
            className="flex-1 rounded-lg border-none bg-ink px-4 py-2.5 text-[0.92rem] font-bold text-white transition-colors hover:bg-ink-2 disabled:opacity-60 motion-reduce:transition-none"
          >
            {descartando ? 'Descartando…' : 'Descartar'}
          </button>
        </div>
      </div>
    </dialog>
  )
}
