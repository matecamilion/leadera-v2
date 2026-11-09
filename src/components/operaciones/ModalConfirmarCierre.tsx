import { useEffect, useId, useRef, useState } from 'react'
import { ModalConfirmarEliminar } from '../comunes/ModalConfirmarEliminar'
import {
  formatearMonto,
  type EstadoTerminal,
  type Operacion,
} from '../../lib/api/operaciones'
import { etiquetaValorDeCierre } from '../../lib/montoOperacion'
import { cantidadInvalida, excedeTope, MENSAJE_VALOR_ALTO, TOPE_PRECIO } from '../../lib/validaciones'

/**
 * Qué se pregunta para cada estado.
 *
 * Quién es terminal lo decide `esBloqueada`, que sale de la misma lista que
 * mira el trigger `operaciones_proteger_cerrada`: con un criterio propio acá,
 * agregar un estado terminal dejaría de pedir confirmación sin que nadie lo note.
 */
const COPY: Record<EstadoTerminal, {
  titulo: string
  descripcion: string
  confirmar: string
  confirmando: string
}> = {
  CERRADA_GANADA: {
    titulo: '¿Cerrar esta operación como ganada?',
    descripcion:
      'Cargá el valor al que se cerró. Después de esto, los datos principales quedan bloqueados para editar.',
    confirmar: 'Sí, cerrar como ganada',
    confirmando: 'Cerrando…',
  },
  CANCELADA: {
    titulo: '¿Cancelar esta operación?',
    descripcion: 'Los datos quedan bloqueados para editar después de esto.',
    confirmar: 'Sí, cancelar la operación',
    confirmando: 'Cancelando…',
  },
}

/** Lo que el diálogo necesita saber de la operación para pedir el valor de cierre. */
export type DatosDeCierre = Pick<Operacion, 'tipo' | 'moneda' | 'monto' | 'monto_cierre'>

interface ModalConfirmarCierreProps {
  /** El estado al que se quiere pasar, o null si no hay nada que confirmar. */
  estado: EstadoTerminal | null
  /** La operación que se cierra. Hace falta para cerrarla como ganada. */
  operacion: DatosDeCierre | null
  procesando: boolean
  error?: string | null
  onCancelar: () => void
  /** El valor de cierre cargado; null al cancelar la operación, que no lleva valor. */
  onConfirmar: (montoCierre: number | null) => void
}

/**
 * Confirmación para cerrar o cancelar una operación.
 *
 * Estos dos estados no son un paso más del tablero: estampan `fecha_cierre` y
 * dejan la operación fuera de edición —lo hace cumplir un trigger—, así que
 * llegar por accidente cuesta una reapertura. Las transiciones entre estados
 * abiertos no pasan por acá.
 *
 * Cerrar como ganada además pide el valor de cierre, que es obligatorio.
 */
export function ModalConfirmarCierre({
  estado,
  operacion,
  procesando,
  error,
  onCancelar,
  onConfirmar,
}: ModalConfirmarCierreProps) {
  // El copy se congela mientras el diálogo está abierto; con `estado` en null
  // no hay nada que dibujar.
  if (!estado) return null

  if (estado === 'CERRADA_GANADA') {
    // Sin la operación no hay moneda ni valor inicial: no se puede pedir el valor.
    if (!operacion) return null
    return (
      <DialogoValorDeCierre
        operacion={operacion}
        procesando={procesando}
        error={error}
        onCancelar={onCancelar}
        onConfirmar={onConfirmar}
      />
    )
  }

  const copy = COPY[estado]

  return (
    <ModalConfirmarEliminar
      abierto
      titulo={copy.titulo}
      descripcion={copy.descripcion}
      eliminando={procesando}
      error={error}
      onCancelar={onCancelar}
      onConfirmar={() => onConfirmar(null)}
      textoConfirmar={copy.confirmar}
      textoConfirmando={copy.confirmando}
      // "Cancelar" tendría dos sentidos opuestos en el diálogo que justamente
      // pregunta si cancelar la operación.
      textoCancelar="No, volver"
    />
  )
}

/** '' → null; '12' → 12. Descarta lo que no sea un número válido. */
function aNumero(valor: string): number | null {
  if (!valor.trim()) return null
  const n = Number(valor)
  return Number.isFinite(n) ? n : null
}

/** Por qué el valor no sirve, o null si está bien. */
function errorDelValor(valor: string): string | null {
  if (!valor.trim()) return 'Cargá el valor de cierre.'
  if (cantidadInvalida(valor)) return 'El valor tiene que ser 1 o más.'
  if (excedeTope(valor, TOPE_PRECIO)) return MENSAJE_VALOR_ALTO
  return null
}

interface DialogoValorDeCierreProps {
  operacion: DatosDeCierre
  procesando: boolean
  error?: string | null
  onCancelar: () => void
  onConfirmar: (montoCierre: number) => void
}

/**
 * Pide el valor de cierre antes de cerrar como ganada.
 *
 * Arranca con el valor de un cierre anterior si la operación estuvo cerrada y
 * se reabrió; si no, con el monto publicado (si cerró igual, es confirmar); y
 * vacío si no hay ninguno. La moneda es la de la operación y no se elige.
 *
 * Se monta solo mientras está abierto y se abre al montarse, así que cada vez
 * arranca con su valor inicial. Es un <form>: Enter en el campo confirma, y el
 * Escape nativo del <dialog> cierra (se intercepta para avisar al padre).
 */
function DialogoValorDeCierre({
  operacion,
  procesando,
  error,
  onCancelar,
  onConfirmar,
}: DialogoValorDeCierreProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const idTitulo = useId()
  const idCampo = useId()
  const idError = useId()
  const [valor, setValor] = useState(() => (operacion.monto_cierre ?? operacion.monto)?.toString() ?? '')
  const [intentado, setIntentado] = useState(false)

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  const errorValor = errorDelValor(valor)
  // El techo se avisa apenas se pasa; lo demás, tras el primer intento de confirmar.
  const mostrarError = errorValor !== null && (intentado || excedeTope(valor, TOPE_PRECIO))
  const etiqueta = etiquetaValorDeCierre(operacion.tipo)

  function enviar(evento: React.FormEvent) {
    evento.preventDefault()
    if (procesando) return
    const monto = aNumero(valor)
    if (errorValor || monto === null) {
      setIntentado(true)
      return
    }
    onConfirmar(monto)
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
          {COPY.CERRADA_GANADA.titulo}
        </h3>
        <p className="mt-2 text-[0.9rem] leading-relaxed break-words text-ink-3">
          {COPY.CERRADA_GANADA.descripcion}
        </p>

        <label htmlFor={idCampo} className="mt-4 mb-1.5 block text-xs font-semibold text-ink-3 uppercase">
          {etiqueta}
        </label>
        <div className="flex gap-2">
          <span
            aria-label="Moneda"
            className="flex w-16 shrink-0 items-center justify-center rounded-lg border border-border bg-background px-3 py-2.5 text-[0.9rem] font-semibold text-ink-2"
          >
            {operacion.moneda}
          </span>
          <input
            id={idCampo}
            type="number"
            inputMode="decimal"
            min={1}
            step="any"
            value={valor}
            disabled={procesando}
            onChange={(e) => setValor(e.target.value)}
            aria-invalid={mostrarError || undefined}
            aria-describedby={mostrarError ? idError : undefined}
            className="w-full min-w-0 rounded-lg border border-border bg-surface px-3 py-2.5 text-[0.9rem] text-ink tabular-nums focus:border-primary focus:outline-none focus:[box-shadow:var(--shadow-focus)] disabled:opacity-60"
          />
        </div>
        {mostrarError && (
          <p id={idError} role="alert" className="mt-1 text-[0.78rem] text-peligro-ink">
            {errorValor}
          </p>
        )}
        {operacion.monto != null && (
          <p className="mt-1.5 text-[0.78rem] text-ink-3">
            Publicado: {formatearMonto(operacion.monto, operacion.moneda)}
          </p>
        )}

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
            disabled={procesando}
            className="min-h-11 flex-1 rounded-lg border border-border bg-transparent px-4 py-2 font-semibold text-ink-2 transition-colors hover:bg-background disabled:opacity-60 motion-reduce:transition-none"
          >
            No, volver
          </button>
          <button
            type="submit"
            disabled={procesando}
            className="min-h-11 flex-1 rounded-lg border-none bg-primary px-4 py-2 text-[0.92rem] font-bold text-primary-contrast transition-colors hover:bg-primary-dark disabled:opacity-60 motion-reduce:transition-none"
          >
            {procesando ? COPY.CERRADA_GANADA.confirmando : COPY.CERRADA_GANADA.confirmar}
          </button>
        </div>
      </form>
    </dialog>
  )
}
