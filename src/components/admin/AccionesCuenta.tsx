import { useState } from 'react'
import { Campo } from '../comunes/CampoFormulario'
import { CLASES_CONTROL } from '../comunes/estilosFormulario'
import { useExtenderTrial } from '../../hooks/useAdmin'
import {
  DIAS_TRIAL_MAX,
  DIAS_TRIAL_MIN,
  fechaDeVencimiento,
  formatearArs,
  formatearFechaAR,
  puedeExtenderTrial,
  type CuentaAdmin,
} from '../../lib/api/admin'
import { DETALLE_PLAN, type Plan, type PrecioPlan } from '../../lib/api/suscripcion'
import { mensajeDeCobro } from '../../lib/config'
import { useUiStore } from '../../stores/ui'
import { ModalAccionConNota } from './ModalAccionConNota'
import { ModalAjustarVencimiento } from './ModalAjustarVencimiento'
import { ModalRegistrarPago } from './ModalRegistrarPago'
import { useCopiar } from './useCopiar'

const CLASES_PRIMARIA =
  'rounded-lg bg-primary px-4 py-2.5 text-cuerpo font-semibold text-primary-contrast transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none'

const CLASES_SECUNDARIA =
  'rounded-lg border border-border bg-surface px-4 py-2.5 text-cuerpo font-semibold text-ink-2 transition-colors hover:border-ink-subtle hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none'

type Modal = 'pago' | 'vencimiento' | 'trial' | null

/**
 * Lo que se hace para cobrar: registrar el pago es la acción principal; copiar
 * el mensaje, extender la prueba y ajustar el vencimiento, las de apoyo. Lo que
 * corta el acceso o cambia cómo se cuenta la cuenta vive en `ZonaDeCuenta`.
 */
export function AccionesCuenta({
  cuenta,
  precios,
}: {
  cuenta: CuentaAdmin
  precios: PrecioPlan[] | undefined
}) {
  const copiar = useCopiar()
  const mostrarAviso = useUiStore((s) => s.mostrarAviso)
  const extender = useExtenderTrial()

  const [modal, setModal] = useState<Modal>(null)
  const [diasTrial, setDiasTrial] = useState(7)

  const manual = cuenta.metodoCobro === 'MANUAL'

  // El precio de lista del plan que se esté por cobrar. Los precios ya están en
  // cache por la pantalla de suscripción.
  const precioMensual = (plan: Plan) => precios?.find((p) => p.plan === plan)?.precio_ars ?? null

  /**
   * El mensaje de cobro, listo para pegar en WhatsApp.
   *
   * La fecha es la del vencimiento real de la cuenta; si todavía no pagó nunca
   * —está en trial— se usa el fin del trial, que es la fecha que le importa.
   */
  function copiarMensaje() {
    const precio = cuenta.plan ? precioMensual(cuenta.plan) : null
    const texto = mensajeDeCobro({
      dueno: cuenta.dueno?.nombre ?? null,
      plan: cuenta.plan ? DETALLE_PLAN[cuenta.plan].nombre : 'sin plan',
      vencimiento: formatearFechaAR(fechaDeVencimiento(cuenta) ?? cuenta.finTrial),
      monto: precio === null ? 'consultar' : formatearArs(precio),
    })
    return copiar(texto, 'Mensaje de cobro copiado.')
  }

  return (
    <section aria-label="Acciones de cobro" className="grid gap-2 sm:flex sm:flex-wrap sm:items-center">
      <button type="button" onClick={() => setModal('pago')} className={CLASES_PRIMARIA}>
        Registrar pago
      </button>
      <button type="button" onClick={copiarMensaje} className={CLASES_SECUNDARIA}>
        Copiar mensaje de cobro
      </button>
      {puedeExtenderTrial(cuenta) && (
        <button type="button" onClick={() => setModal('trial')} className={CLASES_SECUNDARIA}>
          Extender trial
        </button>
      )}
      {manual && (
        <button type="button" onClick={() => setModal('vencimiento')} className={CLASES_SECUNDARIA}>
          Ajustar vencimiento
        </button>
      )}

      <ModalRegistrarPago
        abierto={modal === 'pago'}
        cuenta={cuenta}
        precioMensual={precioMensual}
        onCerrar={() => setModal(null)}
      />

      {manual && (
        <ModalAjustarVencimiento
          abierto={modal === 'vencimiento'}
          cuenta={cuenta}
          onCerrar={() => setModal(null)}
        />
      )}

      <ModalAccionConNota
        abierto={modal === 'trial'}
        titulo="Extender el trial"
        subtitulo={cuenta.nombre}
        descripcion="La cuenta vuelve a quedar en período de prueba, contando desde hoy o desde la fecha que tenía, la que sea mayor."
        placeholderNota="Por qué se extiende."
        textoConfirmar="Extender"
        textoConfirmando="Extendiendo…"
        cuentaSuspendida={cuenta.bloqueoMotivo !== null}
        guardando={extender.isPending}
        error={extender.isError ? extender.error.message : null}
        puedeConfirmar={diasTrial >= DIAS_TRIAL_MIN && diasTrial <= DIAS_TRIAL_MAX}
        campos={
          <Campo label="Días *" ayuda={`Entre ${DIAS_TRIAL_MIN} y ${DIAS_TRIAL_MAX}.`}>
            <input
              type="number"
              min={DIAS_TRIAL_MIN}
              max={DIAS_TRIAL_MAX}
              step="1"
              value={diasTrial}
              aria-label="Días a extender"
              onChange={(e) => setDiasTrial(Number(e.target.value))}
              className={CLASES_CONTROL}
            />
          </Campo>
        }
        onCerrar={() => {
          if (extender.isPending) return
          extender.reset()
          setModal(null)
        }}
        onConfirmar={(nota) =>
          extender.mutate(
            { inmobiliariaId: cuenta.id, dias: diasTrial, nota },
            {
              onSuccess: (nuevoFin) => {
                setModal(null)
                mostrarAviso(`Trial extendido hasta el ${formatearFechaAR(nuevoFin)}.`)
              },
            },
          )
        }
      />
    </section>
  )
}
