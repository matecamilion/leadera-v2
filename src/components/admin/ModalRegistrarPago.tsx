import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useRegistrarPagoManual } from '../../hooks/useAdmin'
import {
  MESES_PAGO,
  METODOS_PAGO_MANUAL,
  type CuentaAdmin,
  type MetodoPagoManual,
} from '../../lib/api/admin'
import { DETALLE_PLAN, PLANES, type Plan } from '../../lib/api/suscripcion'
import { hoyComoClave } from '../../lib/calendario'
import { formatearFecha } from '../../lib/formatoFecha'
import { Campo, ErrorCampo } from '../comunes/CampoFormulario'
import { CLASES_CONTROL } from '../comunes/estilosFormulario'

/**
 * Registrar un pago por transferencia y extender el acceso de la cuenta.
 *
 * Mismo molde que `ModalNuevaInteraccion`: <dialog> nativo, controles de
 * `CampoFormulario`, `onCancel` interceptado y la mutación adentro.
 *
 * Quien decide de verdad es el RPC `admin_registrar_pago_manual`, que valida
 * superadmin, bloquea la cuenta y calcula el vencimiento. Las validaciones de
 * acá sólo evitan el viaje de ida y vuelta; si el RPC rechaza, su mensaje se
 * muestra tal cual, que para eso está redactado en español.
 */
export function ModalRegistrarPago({
  abierto,
  cuenta,
  precioMensual,
  onCerrar,
  onRegistrado,
}: {
  abierto: boolean
  cuenta: CuentaAdmin
  /** `planes_precio.precio_ars_actual` del plan elegido. null si no se sabe. */
  precioMensual: (plan: Plan) => number | null
  onCerrar: () => void
  onRegistrado?: (nuevoHasta: string) => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const registrar = useRegistrarPagoManual()

  const [plan, setPlan] = useState<Plan>(cuenta.plan ?? 'SOLO')
  const [meses, setMeses] = useState<number>(1)
  // El monto escrito a mano, o null mientras se siga usando el sugerido. No
  // se guarda el valor sugerido en el estado: derivarlo en render evita que
  // cambiar el plan o el plazo tenga que sincronizarse con un efecto, y deja
  // claro cuál de los dos manda.
  const [montoManual, setMontoManual] = useState<string | null>(null)
  const [fechaPago, setFechaPago] = useState(hoyComoClave())
  const [metodo, setMetodo] = useState<MetodoPagoManual>('TRANSFERENCIA')
  const [nota, setNota] = useState('')
  const [tocado, setTocado] = useState(false)
  // El "ahora" contra el que se calcula la vista previa. Se fija al abrir el
  // modal y no se recalcula en cada render: un `Date.now()` suelto en el
  // render daría un resultado distinto en cada uno.
  const [abiertoEn, setAbiertoEn] = useState(() => Date.now())

  const { reset: resetMutacion } = registrar
  const sugerido = useMemo(() => {
    const precio = precioMensual(plan)
    return precio === null ? null : precio * meses
  }, [precioMensual, plan, meses])

  const monto = montoManual ?? (sugerido === null ? '' : String(sugerido))

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return

    if (abierto && !dialog.open) {
      setPlan(cuenta.plan ?? 'SOLO')
      setMeses(1)
      setMontoManual(null)
      setAbiertoEn(Date.now())
      setFechaPago(hoyComoClave())
      setMetodo('TRANSFERENCIA')
      setNota('')
      setTocado(false)
      resetMutacion()
      dialog.showModal()
    }

    if (!abierto && dialog.open) dialog.close()
  }, [abierto, cuenta.id, cuenta.plan, resetMutacion])

  const montoNumero = Number(monto)
  const errorMonto =
    !tocado || (Number.isFinite(montoNumero) && montoNumero > 0)
      ? null
      : 'El monto tiene que ser mayor a 0.'

  const valido = Number.isFinite(montoNumero) && montoNumero > 0 && !!fechaPago

  /**
   * La misma cuenta que hace el RPC:
   * `greatest(coalesce(acceso_pagado_hasta, now()), now()) + N meses`.
   *
   * Está duplicada a propósito y no se pide a la base: es una vista previa que
   * tiene que actualizarse mientras se elige el plazo. La fuente de verdad
   * sigue siendo el RPC, y lo que devuelve es lo que se muestra después.
   */
  const quedaActivaHasta = useMemo(() => {
    const desde = cuenta.accesoPagadoHasta
      ? Math.max(new Date(cuenta.accesoPagadoHasta).getTime(), abiertoEn)
      : abiertoEn
    const fecha = new Date(desde)
    fecha.setMonth(fecha.getMonth() + meses)
    return fecha.toISOString()
  }, [cuenta.accesoPagadoHasta, meses, abiertoEn])

  function manejarSubmit(e: FormEvent) {
    e.preventDefault()
    setTocado(true)
    if (!valido || registrar.isPending) return

    registrar.mutate(
      {
        inmobiliariaId: cuenta.id,
        plan,
        meses,
        monto: montoNumero,
        fechaPago,
        metodo,
        nota: nota.trim() || undefined,
      },
      {
        onSuccess: (nuevoHasta) => {
          onCerrar()
          onRegistrado?.(nuevoHasta)
        },
      },
    )
  }

  return (
    <dialog
      ref={ref}
      aria-label="Registrar un pago manual"
      onCancel={(e) => {
        e.preventDefault()
        if (!registrar.isPending) onCerrar()
      }}
      className="m-auto w-[480px] max-w-[92vw] rounded-[20px] border-none p-0 shadow-modal backdrop:bg-[rgba(15,23,42,0.6)] backdrop:backdrop-blur-[4px]"
    >
      <form
        onSubmit={manejarSubmit}
        noValidate
        className="box-border max-h-[85vh] overflow-y-auto p-[30px] text-left"
      >
        <h3 className="mb-1 text-center text-lg font-bold text-ink">Registrar pago</h3>
        <p className="mb-5 text-center text-[0.85rem] text-ink-3">{cuenta.nombre}</p>

        <div className="flex flex-col gap-4">
          <Campo label="Plan">
            <select
              value={plan}
              onChange={(e) => setPlan(e.target.value as Plan)}
              className={CLASES_CONTROL}
            >
              {PLANES.map((p) => (
                <option key={p} value={p}>
                  {DETALLE_PLAN[p].nombre}
                </option>
              ))}
            </select>
          </Campo>

          <Campo label="Período">
            <div className="flex gap-2">
              {MESES_PAGO.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMeses(m)}
                  aria-pressed={meses === m}
                  className={`flex-1 rounded-xl border px-3 py-2.5 text-[0.85rem] font-semibold transition-colors motion-reduce:transition-none ${
                    meses === m
                      ? 'border-primary bg-brand-soft text-primary'
                      : 'border-border bg-surface-2 text-ink-2 hover:border-ink-subtle'
                  }`}
                >
                  {m === 1 ? '1 mes' : `${m} meses`}
                </button>
              ))}
            </div>
          </Campo>

          <Campo
            label="Monto cobrado (ARS) *"
            ayuda={
              sugerido === null
                ? 'No hay precio de lista cargado para este plan.'
                : `Sugerido por lista: $${sugerido.toLocaleString('es-AR')}`
            }
          >
            <input
              type="number"
              inputMode="numeric"
              min={1}
              step="1"
              value={monto}
              onChange={(e) => setMontoManual(e.target.value)}
              onBlur={() => setTocado(true)}
              aria-invalid={Boolean(errorMonto) || undefined}
              className={`${CLASES_CONTROL} ${errorMonto ? 'border-peligro-ink' : ''}`}
            />
            {errorMonto && <ErrorCampo>{errorMonto}</ErrorCampo>}
          </Campo>

          <Campo label="Fecha de pago *">
            <input
              type="date"
              value={fechaPago}
              max={hoyComoClave()}
              onChange={(e) => setFechaPago(e.target.value)}
              className={CLASES_CONTROL}
            />
          </Campo>

          <Campo label="Método">
            <select
              value={metodo}
              onChange={(e) => setMetodo(e.target.value as MetodoPagoManual)}
              className={CLASES_CONTROL}
            >
              {METODOS_PAGO_MANUAL.map((m) => (
                <option key={m.valor} value={m.valor}>
                  {m.label}
                </option>
              ))}
            </select>
          </Campo>

          <Campo label="Nota">
            <textarea
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              rows={2}
              maxLength={300}
              placeholder="Número de comprobante, banco, lo que sirva después."
              className={`${CLASES_CONTROL} min-h-16 resize-y leading-normal`}
            />
          </Campo>
        </div>

        <p className="mt-4 rounded-xl border border-border bg-background px-4 py-3 text-[0.85rem] text-ink-2">
          La cuenta quedará activa hasta{' '}
          <b className="text-ink tabular-nums">{formatearFecha(quedaActivaHasta)}</b>.
        </p>

        {registrar.isError && (
          <p role="alert" className="mt-3 mb-0 text-[0.85rem] text-peligro-ink">
            {registrar.error.message}
          </p>
        )}

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onCerrar}
            disabled={registrar.isPending}
            className="flex-1 rounded-lg border border-border bg-surface px-4 py-2.5 text-[0.9rem] font-semibold text-ink-2 transition-colors hover:border-ink-subtle hover:text-ink disabled:opacity-60 motion-reduce:transition-none"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={registrar.isPending}
            className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-[0.9rem] font-semibold text-primary-contrast transition-colors hover:bg-primary-hover disabled:opacity-60 motion-reduce:transition-none"
          >
            {registrar.isPending ? 'Registrando...' : 'Registrar pago'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
