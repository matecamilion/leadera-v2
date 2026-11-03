import { useState, type ReactNode } from 'react'
import { useMarcarVencida, useSetTipoCuenta, useSuspenderCuenta } from '../../hooks/useAdmin'
import {
  ETIQUETA_TIPO_CUENTA,
  motivoNoSuspender,
  puedeMarcarVencida,
  puedeReactivar,
  puedeSuspender,
  TIPOS_CUENTA,
  type CuentaAdmin,
  type TipoCuenta,
} from '../../lib/api/admin'
import { useUiStore } from '../../stores/ui'
import { BotonReactivarCuenta } from './BotonReactivarCuenta'
import { ModalAccionConNota } from './ModalAccionConNota'
import { ModalConfirmacion } from './ModalConfirmacion'
import { AVISO_NOTA_INTERNA, AVISO_NOTA_VISIBLE } from './textosAdmin'

const CLASES_PELIGRO =
  'rounded-lg border border-peligro-ink bg-surface px-4 py-2.5 text-cuerpo font-semibold text-peligro-ink transition-colors hover:bg-peligro-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-peligro-ink motion-reduce:transition-none'

const CLASES_ADVERTENCIA =
  'rounded-lg border border-badge-tibio-ink bg-surface px-4 py-2.5 text-cuerpo font-semibold text-badge-tibio-ink transition-colors hover:bg-warm-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-badge-tibio-ink motion-reduce:transition-none'

function Accion({
  titulo,
  explicacion,
  children,
}: {
  titulo: string
  explicacion: string
  children: ReactNode
}) {
  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <p className="m-0 text-cuerpo font-semibold text-ink">{titulo}</p>
        <p className="m-0 mt-0.5 text-meta text-ink-3">{explicacion}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </li>
  )
}

/**
 * Lo que corta el acceso de la cuenta, lo que lo devuelve y lo que cambia cómo
 * se cuenta en el panel, separado de las acciones de cobro y con el peligro a la
 * vista en reposo.
 *
 * Tres acciones sobre el acceso, cada una sólo cuando la base la va a aceptar
 * (ver los `puede*` de `admin.ts`):
 *   - Marcar como vencida: falta de pago. Se levanta cobrando. La nota es
 *     opcional y el cliente la puede ver.
 *   - Suspender: decisión del administrador. La nota es obligatoria e interna.
 *     Se levanta sólo reactivando.
 *   - Reactivar: levanta una suspensión.
 *
 * Cambiar el tipo de cuenta pide confirmación y nada más —el RPC no recibe
 * nota—: mover una cuenta a Interna o Testing la saca de los ingresos y de todas
 * las métricas.
 */
export function ZonaDeCuenta({ cuenta }: { cuenta: CuentaAdmin }) {
  const mostrarAviso = useUiStore((s) => s.mostrarAviso)
  const marcarVencida = useMarcarVencida()
  const suspender = useSuspenderCuenta()
  const cambiarTipo = useSetTipoCuenta()

  const [marcando, setMarcando] = useState(false)
  const [suspendiendo, setSuspendiendo] = useState(false)
  const [tipoPendiente, setTipoPendiente] = useState<TipoCuenta | null>(null)

  // Por qué no hay botón de suspender, cuando no es obvio: si ya hay una
  // suspensión abierta lo dice el botón de reactivar.
  const razonNoSuspender = !puedeSuspender(cuenta) && !puedeReactivar(cuenta) ? motivoNoSuspender(cuenta) : null

  return (
    <section
      aria-labelledby="titulo-zona"
      className="rounded-2xl border border-peligro-borde bg-surface p-4 sm:p-5"
    >
      <h2 id="titulo-zona" className="m-0 text-titulo font-bold text-peligro-ink">
        Zona de cuenta
      </h2>
      <p className="mt-0.5 mb-0 text-meta text-ink-3">
        Cambios que afectan el acceso de la cuenta o cómo se cuenta en el panel.
      </p>

      <ul className="m-0 mt-3 list-none divide-y divide-border p-0">
        {puedeMarcarVencida(cuenta) && (
          <Accion
            titulo="Marcar como vencida"
            explicacion="Corta el acceso por falta de pago. No es una suspensión: se levanta como cualquier vencimiento, registrando un pago, ajustando el vencimiento o extendiendo la prueba."
          >
            <button
              type="button"
              onClick={() => {
                marcarVencida.reset()
                setMarcando(true)
              }}
              className={CLASES_ADVERTENCIA}
            >
              Marcar como vencida
            </button>
          </Accion>
        )}

        {puedeSuspender(cuenta) && (
          <Accion
            titulo="Suspender cuenta"
            explicacion="Corta el acceso por una decisión del administrador. Queda registrado quién, cuándo y por qué; la nota es interna. Un pago o un ajuste no la levantan: hay que reactivarla."
          >
            <button
              type="button"
              onClick={() => {
                suspender.reset()
                setSuspendiendo(true)
              }}
              className={CLASES_PELIGRO}
            >
              Suspender cuenta
            </button>
          </Accion>
        )}

        {puedeReactivar(cuenta) && (
          <Accion
            titulo="Reactivar cuenta"
            explicacion="Levanta la suspensión. La cuenta queda activa, en prueba o vencida, según lo que le corresponda hoy."
          >
            <BotonReactivarCuenta cuenta={cuenta} />
          </Accion>
        )}

        <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <label htmlFor="tipo-cuenta" className="text-cuerpo font-semibold text-ink">
              Tipo de cuenta
            </label>
            <p className="m-0 mt-0.5 text-meta text-ink-3">
              Interna y Testing no cuentan en los ingresos ni en las métricas del panel.
            </p>
          </div>
          <select
            id="tipo-cuenta"
            value={cuenta.tipoCuenta}
            disabled={cambiarTipo.isPending}
            onChange={(e) => {
              cambiarTipo.reset()
              setTipoPendiente(e.target.value as TipoCuenta)
            }}
            className="shrink-0 rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-cuerpo text-ink transition-colors focus:border-primary focus:bg-surface focus:shadow-focus focus:outline-none disabled:opacity-60 motion-reduce:transition-none"
          >
            {TIPOS_CUENTA.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.label}
              </option>
            ))}
          </select>
        </li>
      </ul>

      {razonNoSuspender && (
        <p className="mt-2 mb-0 text-meta text-ink-3">No se puede suspender: {razonNoSuspender}</p>
      )}

      <ModalAccionConNota
        abierto={marcando}
        titulo="¿Marcar la cuenta como vencida?"
        subtitulo={cuenta.nombre}
        descripcion="La cuenta pierde el acceso hasta que se registre un pago, se ajuste el vencimiento o se extienda la prueba. No es una suspensión."
        etiquetaNota="Nota (opcional)"
        ayudaNota={AVISO_NOTA_VISIBLE}
        notaObligatoria={false}
        placeholderNota="Por ejemplo: no llegó la transferencia de noviembre."
        textoConfirmar="Sí, marcar como vencida"
        textoConfirmando="Marcando…"
        destructivo
        guardando={marcarVencida.isPending}
        error={marcarVencida.isError ? marcarVencida.error.message : null}
        onCerrar={() => {
          if (marcarVencida.isPending) return
          marcarVencida.reset()
          setMarcando(false)
        }}
        onConfirmar={(nota) =>
          marcarVencida.mutate(
            { inmobiliariaId: cuenta.id, nota },
            {
              onSuccess: () => {
                setMarcando(false)
                mostrarAviso('Cuenta marcada como vencida.')
              },
            },
          )
        }
      />

      <ModalAccionConNota
        abierto={suspendiendo}
        titulo="¿Suspender la cuenta?"
        subtitulo={cuenta.nombre}
        descripcion="La cuenta queda suspendida: el dueño ve que está suspendida y que tiene que escribirnos, y el resto del equipo pierde el acceso. Un pago o un ajuste de vencimiento no la levantan: hay que usar Reactivar cuenta."
        ayudaNota={AVISO_NOTA_INTERNA}
        placeholderNota="Por qué se suspende."
        textoConfirmar="Sí, suspender"
        textoConfirmando="Suspendiendo…"
        destructivo
        guardando={suspender.isPending}
        error={suspender.isError ? suspender.error.message : null}
        onCerrar={() => {
          if (suspender.isPending) return
          suspender.reset()
          setSuspendiendo(false)
        }}
        onConfirmar={(nota) =>
          suspender.mutate(
            { inmobiliariaId: cuenta.id, nota },
            {
              onSuccess: () => {
                setSuspendiendo(false)
                mostrarAviso('Cuenta suspendida.')
              },
            },
          )
        }
      />

      <ModalConfirmacion
        abierto={tipoPendiente !== null}
        titulo={
          tipoPendiente === null
            ? 'Cambiar el tipo de cuenta'
            : `¿Pasarla a cuenta ${ETIQUETA_TIPO_CUENTA[tipoPendiente].toLowerCase()}?`
        }
        subtitulo={cuenta.nombre}
        descripcion={
          tipoPendiente === 'CLIENTE'
            ? 'La cuenta vuelve a contar en los ingresos, los conteos y los gráficos del panel.'
            : 'La cuenta deja de contar en los ingresos, los conteos y los gráficos del panel.'
        }
        textoConfirmar="Sí, cambiar"
        textoConfirmando="Cambiando…"
        guardando={cambiarTipo.isPending}
        error={cambiarTipo.isError ? cambiarTipo.error.message : null}
        onCerrar={() => {
          if (cambiarTipo.isPending) return
          cambiarTipo.reset()
          setTipoPendiente(null)
        }}
        onConfirmar={() => {
          if (tipoPendiente === null) return
          cambiarTipo.mutate(
            { inmobiliariaId: cuenta.id, tipo: tipoPendiente },
            {
              onSuccess: () => {
                mostrarAviso(`Ahora es una cuenta ${ETIQUETA_TIPO_CUENTA[tipoPendiente].toLowerCase()}.`)
                setTipoPendiente(null)
              },
            },
          )
        }}
      />
    </section>
  )
}
