import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Campo, ErrorCampo } from '../comunes/CampoFormulario'
import { CLASES_CONTROL } from '../comunes/estilosFormulario'

/**
 * Molde de las acciones de gestión del panel: una nota obligatoria, tal vez un
 * campo más, y confirmar.
 *
 * Lo comparten anular un pago, extender un trial y suspender una cuenta.
 * Escribir tres modales casi iguales llevaba a que la validación de la nota
 * —la misma que exigen los tres RPC— terminara escrita de tres formas
 * distintas.
 *
 * La nota se pide acá y no sólo en la base porque el error del servidor llega
 * cuando el formulario ya se mandó: pedirla antes evita escribirlo dos veces.
 *
 * Mismo shell que el resto: <dialog> nativo, `onCancel` interceptado y el
 * error de la mutación mostrado tal cual lo redactó el RPC.
 */
export function ModalAccionConNota({
  abierto,
  titulo,
  subtitulo,
  descripcion,
  etiquetaNota = 'Nota *',
  ayudaNota = 'Queda registrada en el historial de cobros.',
  placeholderNota,
  textoConfirmar,
  textoConfirmando,
  destructivo = false,
  campos,
  guardando,
  error,
  puedeConfirmar = true,
  onCerrar,
  onConfirmar,
}: {
  abierto: boolean
  titulo: string
  subtitulo?: string
  /** Qué va a pasar, en una línea. Se muestra arriba del formulario. */
  descripcion?: ReactNode
  etiquetaNota?: string
  ayudaNota?: string
  placeholderNota?: string
  textoConfirmar: string
  textoConfirmando: string
  /** Pinta el botón de confirmar en rojo. Para lo que corta un acceso. */
  destructivo?: boolean
  /** Campos propios de la acción, arriba de la nota. */
  campos?: ReactNode
  guardando: boolean
  error: string | null
  /** Para que el llamador sume su propia validación a la de la nota. */
  puedeConfirmar?: boolean
  onCerrar: () => void
  onConfirmar: (nota: string) => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [nota, setNota] = useState('')
  const [tocado, setTocado] = useState(false)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return

    if (abierto && !dialog.open) {
      setNota('')
      setTocado(false)
      dialog.showModal()
    }

    if (!abierto && dialog.open) dialog.close()
  }, [abierto])

  const errorNota = tocado && !nota.trim() ? 'La nota es obligatoria.' : null

  function manejarSubmit(e: FormEvent) {
    e.preventDefault()
    setTocado(true)
    if (!nota.trim() || !puedeConfirmar || guardando) return
    onConfirmar(nota.trim())
  }

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
      <form
        onSubmit={manejarSubmit}
        noValidate
        className="box-border max-h-[85vh] overflow-y-auto p-[30px] text-left"
      >
        <h3 className="mb-1 text-center text-lg font-bold text-ink">{titulo}</h3>
        {subtitulo && (
          <p className="mb-4 text-center text-[0.85rem] text-ink-3">{subtitulo}</p>
        )}

        {descripcion && (
          <p className="mb-4 rounded-xl border border-border bg-background px-4 py-3 text-[0.85rem] text-ink-2">
            {descripcion}
          </p>
        )}

        <div className="flex flex-col gap-4">
          {campos}

          <Campo label={etiquetaNota} ayuda={ayudaNota}>
            <textarea
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              onBlur={() => setTocado(true)}
              rows={3}
              maxLength={300}
              placeholder={placeholderNota}
              aria-invalid={Boolean(errorNota) || undefined}
              className={`${CLASES_CONTROL} min-h-20 resize-y leading-normal ${
                errorNota ? 'border-peligro-ink' : ''
              }`}
            />
            {errorNota && <ErrorCampo>{errorNota}</ErrorCampo>}
          </Campo>
        </div>

        {error && (
          <p role="alert" className="mt-3 mb-0 text-[0.85rem] text-peligro-ink">
            {error}
          </p>
        )}

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onCerrar}
            disabled={guardando}
            className="flex-1 rounded-lg border border-border bg-surface px-4 py-2.5 text-[0.9rem] font-semibold text-ink-2 transition-colors hover:border-ink-subtle hover:text-ink disabled:opacity-60 motion-reduce:transition-none"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={guardando || !puedeConfirmar}
            className={`flex-1 rounded-lg px-4 py-2.5 text-[0.9rem] font-semibold text-primary-contrast transition-colors disabled:opacity-60 motion-reduce:transition-none ${
              destructivo ? 'bg-peligro hover:bg-peligro-hover' : 'bg-primary hover:bg-primary-hover'
            }`}
          >
            {guardando ? textoConfirmando : textoConfirmar}
          </button>
        </div>
      </form>
    </dialog>
  )
}
