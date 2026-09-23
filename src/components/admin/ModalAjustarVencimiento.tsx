import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useAjustarVencimiento } from '../../hooks/useAdmin'
import type { CuentaAdmin } from '../../lib/api/admin'
import { Campo, ErrorCampo } from '../comunes/CampoFormulario'
import { CLASES_CONTROL } from '../comunes/estilosFormulario'

/** `YYYY-MM-DDTHH:mm` local, que es lo que espera <input type="datetime-local">. */
function comoValorLocal(iso: string | null): string {
  const f = iso ? new Date(iso) : new Date()
  if (Number.isNaN(f.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${f.getFullYear()}-${p(f.getMonth() + 1)}-${p(f.getDate())}T${p(f.getHours())}:${p(f.getMinutes())}`
}

/**
 * Corrección a mano del vencimiento de una cuenta manual.
 *
 * Para arreglar una carga equivocada o dar un plazo excepcional. La nota es
 * obligatoria también acá, no sólo en el RPC: pedirla recién en el error del
 * servidor haría escribir el formulario dos veces.
 *
 * Adelantar la fecha reactiva la cuenta si estaba en gracia o vencida.
 * Atrasarla no la vence en el momento: de eso se encarga el cron diario, con
 * las mismas reglas para todos.
 */
export function ModalAjustarVencimiento({
  abierto,
  cuenta,
  onCerrar,
  onAjustado,
}: {
  abierto: boolean
  cuenta: CuentaAdmin
  onCerrar: () => void
  onAjustado?: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const ajustar = useAjustarVencimiento()

  const [nuevoHasta, setNuevoHasta] = useState('')
  const [nota, setNota] = useState('')
  const [tocado, setTocado] = useState(false)

  const { reset: resetMutacion } = ajustar

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return

    if (abierto && !dialog.open) {
      setNuevoHasta(comoValorLocal(cuenta.accesoPagadoHasta))
      setNota('')
      setTocado(false)
      resetMutacion()
      dialog.showModal()
    }

    if (!abierto && dialog.open) dialog.close()
  }, [abierto, cuenta.id, cuenta.accesoPagadoHasta, resetMutacion])

  const errorNota = tocado && !nota.trim() ? 'La nota es obligatoria.' : null
  const errorFecha = tocado && !nuevoHasta ? 'Elegí la fecha nueva.' : null
  const valido = !!nota.trim() && !!nuevoHasta

  function manejarSubmit(e: FormEvent) {
    e.preventDefault()
    setTocado(true)
    if (!valido || ajustar.isPending) return

    ajustar.mutate(
      { inmobiliariaId: cuenta.id, nuevoHasta, nota: nota.trim() },
      {
        onSuccess: () => {
          onCerrar()
          onAjustado?.()
        },
      },
    )
  }

  return (
    <dialog
      ref={ref}
      aria-label="Ajustar el vencimiento"
      onCancel={(e) => {
        e.preventDefault()
        if (!ajustar.isPending) onCerrar()
      }}
      className="m-auto w-[440px] max-w-[92vw] rounded-[20px] border-none p-0 shadow-modal backdrop:bg-[rgba(15,23,42,0.6)] backdrop:backdrop-blur-[4px]"
    >
      <form
        onSubmit={manejarSubmit}
        noValidate
        className="box-border max-h-[85vh] overflow-y-auto p-[30px] text-left"
      >
        <h3 className="mb-1 text-center text-lg font-bold text-ink">Ajustar vencimiento</h3>
        <p className="mb-5 text-center text-[0.85rem] text-ink-3">{cuenta.nombre}</p>

        <div className="flex flex-col gap-4">
          <Campo
            label="Nuevo vencimiento *"
            ayuda="Si es una fecha futura y la cuenta estaba en gracia o vencida, vuelve a quedar activa."
          >
            <input
              type="datetime-local"
              value={nuevoHasta}
              onChange={(e) => setNuevoHasta(e.target.value)}
              onBlur={() => setTocado(true)}
              aria-invalid={Boolean(errorFecha) || undefined}
              className={`${CLASES_CONTROL} ${errorFecha ? 'border-peligro-ink' : ''}`}
            />
            {errorFecha && <ErrorCampo>{errorFecha}</ErrorCampo>}
          </Campo>

          <Campo label="Nota *" ayuda="Queda registrada en el historial de cobros.">
            <textarea
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              onBlur={() => setTocado(true)}
              rows={3}
              maxLength={300}
              placeholder="Por qué se ajusta la fecha."
              aria-invalid={Boolean(errorNota) || undefined}
              className={`${CLASES_CONTROL} min-h-20 resize-y leading-normal ${
                errorNota ? 'border-peligro-ink' : ''
              }`}
            />
            {errorNota && <ErrorCampo>{errorNota}</ErrorCampo>}
          </Campo>
        </div>

        {ajustar.isError && (
          <p role="alert" className="mt-3 mb-0 text-[0.85rem] text-peligro-ink">
            {ajustar.error.message}
          </p>
        )}

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onCerrar}
            disabled={ajustar.isPending}
            className="flex-1 rounded-lg border border-border bg-surface px-4 py-2.5 text-[0.9rem] font-semibold text-ink-2 transition-colors hover:border-ink-subtle hover:text-ink disabled:opacity-60 motion-reduce:transition-none"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={ajustar.isPending}
            className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-[0.9rem] font-semibold text-primary-contrast transition-colors hover:bg-primary-hover disabled:opacity-60 motion-reduce:transition-none"
          >
            {ajustar.isPending ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
