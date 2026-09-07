import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Campo, ErrorCampo } from '../comunes/CampoFormulario'
import { esMomentoFuturo } from '../../lib/calendario'
import { DETALLE_MINIMO } from '../../lib/validaciones'
import { CLASES_CONTROL } from '../comunes/estilosFormulario'
import {
  etiquetaTipoInteraccion,
  TIPOS_INTERACCION,
  type CamposEditablesInteraccion,
  type Interaccion,
  type TipoInteraccion,
} from '../../lib/api/interacciones'

/** ISO → `YYYY-MM-DDTHH:mm` local, que es lo que espera datetime-local. */
function aLocal(iso: string): string {
  const f = new Date(iso)
  if (Number.isNaN(f.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${f.getFullYear()}-${p(f.getMonth() + 1)}-${p(f.getDate())}T${p(f.getHours())}:${p(f.getMinutes())}`
}

/** El valor del input viene sin zona; Date lo interpreta como hora local. */
function aIso(valor: string): string | null {
  const f = new Date(valor)
  return Number.isNaN(f.getTime()) ? null : f.toISOString()
}

interface ModalEditarInteraccionProps {
  abierto: boolean
  interaccion: Interaccion
  guardando: boolean
  error?: string | null
  onCerrar: () => void
  onGuardar: (campos: CamposEditablesInteraccion) => void
}

/**
 * Edición de una interacción: los tres campos que deja tocar la base.
 *
 * Mismo patrón visual que `ModalEditarOperacion` —<dialog> nativo, controles de
 * `CampoFormulario`/`estilosFormulario`— pero más angosto: son tres campos.
 *
 * Sólo se mandan los campos que cambiaron. Es más que prolijidad: el input
 * datetime-local tiene precisión de minuto, así que reenviar una `fecha` que el
 * usuario ni tocó le comería los segundos y podría reordenar el timeline.
 *
 * El detalle exige los mismos 10 caracteres que el alta. Antes acá sólo se
 * pedía no vacío, para no trabar la corrección de un tipo mal elegido en una
 * fila vieja o autogenerada cuyo detalle ya venía corto; el costo era que la
 * edición quedaba como la puerta de atrás para dejar en un carácter algo que el
 * alta nunca hubiera aceptado. Si aparecen filas cortas que haya que corregir,
 * lo que corresponde es completarles el detalle, no bajar el piso.
 *
 * La fecha no puede quedar adelante del reloj: una interacción es algo que ya
 * pasó, y fecharla en el futuro corre el "último contacto" del lead a un
 * momento que no ocurrió.
 */
export function ModalEditarInteraccion({
  abierto,
  interaccion,
  guardando,
  error,
  onCerrar,
  onGuardar,
}: ModalEditarInteraccionProps) {
  const ref = useRef<HTMLDialogElement>(null)

  const [tipo, setTipo] = useState<TipoInteraccion>(interaccion.tipo)
  const [detalle, setDetalle] = useState(interaccion.detalle ?? '')
  const [fecha, setFecha] = useState(() => aLocal(interaccion.fecha))
  const [tocado, setTocado] = useState(false)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (abierto && !dialog.open) {
      // Al abrir partimos siempre de los datos actuales: si el usuario canceló
      // una edición anterior, no queremos ver su borrador.
      setTipo(interaccion.tipo)
      setDetalle(interaccion.detalle ?? '')
      setFecha(aLocal(interaccion.fecha))
      setTocado(false)
      dialog.showModal()
    }
    if (!abierto && dialog.open) dialog.close()
  }, [abierto, interaccion])

  // Mismo piso que el alta, y desde la misma constante: bajarlo por acá dejaba
  // el historial con detalles de un carácter que el alta nunca hubiera aceptado.
  const errorDetalle = !tocado
    ? null
    : !detalle.trim()
      ? 'El detalle es obligatorio'
      : detalle.trim().length < DETALLE_MINIMO
        ? `Mínimo ${DETALLE_MINIMO} caracteres`
        : null

  // Una interacción es algo que ya pasó. Fecharla adelante empuja el "último
  // contacto" del lead a un futuro que no ocurrió, y ese es el número con el
  // que se prioriza el listado.
  const fechaFutura = esMomentoFuturo(fecha)
  const errorFecha = !tocado
    ? null
    : !aIso(fecha)
      ? 'Poné una fecha válida'
      : fechaFutura
        ? 'La fecha de la interacción no puede ser futura.'
        : null

  const valido =
    detalle.trim().length >= DETALLE_MINIMO && Boolean(aIso(fecha)) && !fechaFutura

  function manejarSubmit(e: FormEvent) {
    e.preventDefault()
    setTocado(true)
    if (!valido) return

    const campos: CamposEditablesInteraccion = {}
    if (tipo !== interaccion.tipo) campos.tipo = tipo
    if (detalle.trim() !== (interaccion.detalle ?? '')) campos.detalle = detalle
    if (fecha !== aLocal(interaccion.fecha)) {
      campos.fecha = aIso(fecha) as string
    }

    onGuardar(campos)
  }

  return (
    <dialog
      ref={ref}
      aria-label="Editar la interacción"
      // El Escape del <dialog> cierra sin avisar al padre: lo interceptamos
      // para que el estado de React no quede desincronizado.
      onCancel={(e) => {
        e.preventDefault()
        if (!guardando) onCerrar()
      }}
      // `m-auto`: el preflight de Tailwind pone margin:0 y le saca al <dialog>
      // el centrado que trae por defecto.
      className="m-auto w-[480px] max-w-[92vw] rounded-[20px] border-none p-0 shadow-modal backdrop:bg-[rgba(15,23,42,0.6)] backdrop:backdrop-blur-[4px]"
    >
      <form
        onSubmit={manejarSubmit}
        noValidate
        className="box-border max-h-[85vh] overflow-y-auto p-[30px] text-left"
      >
        <h3 className="mb-5 text-center text-lg font-bold text-ink">
          Editar interacción
        </h3>

        <div className="flex flex-col gap-4">
          <Campo label="Tipo *">
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoInteraccion)}
              className={CLASES_CONTROL}
            >
              {TIPOS_INTERACCION.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.label}
                </option>
              ))}
              {/* SEGUIMIENTO y CONSULTA son valores válidos del enum que ningún
                  formulario genera hoy. Si la fila ya tiene uno, se agrega como
                  opción: sin esto el select mostraría el primero de la lista y
                  el usuario le cambiaría el tipo sin querer. */}
              {!TIPOS_INTERACCION.some((t) => t.valor === interaccion.tipo) && (
                <option value={interaccion.tipo}>
                  {etiquetaTipoInteraccion(interaccion.tipo)}
                </option>
              )}
            </select>
          </Campo>

          <Campo label="Detalle *">
            <textarea
              value={detalle}
              onChange={(e) => setDetalle(e.target.value)}
              onBlur={() => setTocado(true)}
              rows={4}
              maxLength={1000}
              placeholder="Qué pasó con el lead..."
              className={`${CLASES_CONTROL} min-h-24 resize-y leading-normal ${
                errorDetalle ? 'border-peligro-ink' : ''
              }`}
            />
            {errorDetalle && <ErrorCampo>{errorDetalle}</ErrorCampo>}
          </Campo>

          <Campo label="Fecha *" ayuda="Cuándo pasó, no cuándo se cargó.">
            <input
              type="datetime-local"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              onBlur={() => setTocado(true)}
              // El tope lo aplica igual la validación de arriba; esto es para
              // que el propio control no ofrezca un futuro que va a rechazarse.
              max={aLocal(new Date().toISOString())}
              aria-invalid={Boolean(errorFecha) || undefined}
              className={`${CLASES_CONTROL} ${errorFecha ? 'border-peligro-ink' : ''}`}
            />
            {errorFecha && <ErrorCampo>{errorFecha}</ErrorCampo>}
          </Campo>
        </div>

        {error && (
          <p role="alert" className="mt-4 text-[0.85rem] text-peligro-ink">
            {error}
          </p>
        )}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCerrar}
            disabled={guardando}
            className="flex-1 rounded-lg border border-border bg-surface px-4 py-2.5 font-semibold text-ink-3 transition-colors hover:bg-background disabled:opacity-60 motion-reduce:transition-none"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!valido || guardando}
            className="flex-1 rounded-lg border-none bg-primary px-4 py-2.5 font-bold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:bg-ink-4 motion-reduce:transition-none"
          >
            {guardando ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
