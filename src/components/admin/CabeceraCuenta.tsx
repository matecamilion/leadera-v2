import { EmailLink } from '../comunes/AccionesContacto'
import { IconoChat } from '../leads/Iconos'
import {
  alertaDeCobro,
  diasHastaVencimiento,
  diasVencida,
  esSuspendida,
  estadoVisible,
  ETIQUETA_ALERTA,
  ETIQUETA_METODO,
  ETIQUETA_TIPO_CUENTA,
  formatearArs,
  formatearFechaAR,
  haceCuantoAR,
  progresoDeTrial,
  proximoHito,
  textoDiasHasta,
  textoVencidaHace,
  type CuentaAdmin,
} from '../../lib/api/admin'
import { DETALLE_PLAN } from '../../lib/api/suscripcion'
import { formatearInternacional, linkWhatsAppInternacional } from '../../lib/telefono'
import { BadgeEstado } from './BadgeEstado'
import { BADGE_ALERTA } from './estilosEstado'
import { useCopiar } from './useCopiar'

const CLASES_PILL = 'inline-flex items-center rounded-full bg-surface-2 px-2.5 py-0.5 text-meta font-semibold text-ink-2'

const CLASES_BOTON_CHICO =
  'inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 text-meta font-semibold text-ink-2 transition-colors hover:border-ink-subtle hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none'

/**
 * Quién es el cliente: nombre y estado, desde cuándo está, a quién escribirle,
 * qué plan tiene y hasta cuándo está cubierto.
 *
 * Es lo único que dice plan y fechas en la pantalla: antes se repetían en la
 * cabecera y en la sección Cobro.
 */
export function CabeceraCuenta({
  cuenta,
  precioLista,
  ahora,
}: {
  cuenta: CuentaAdmin
  /** Precio mensual de lista del plan. null si no tiene plan o precio. */
  precioLista: number | null
  ahora: Date
}) {
  const copiar = useCopiar()

  const progreso = progresoDeTrial(cuenta, ahora)
  const hito = proximoHito(cuenta)
  const alerta = alertaDeCobro(cuenta, ahora)
  const vencidaHace = alerta === 'vencida' ? diasVencida(cuenta, ahora) : null
  const dias = diasHastaVencimiento(cuenta, ahora)

  const telefono = cuenta.dueno?.telefono ?? null
  const whatsapp = telefono ? linkWhatsAppInternacional(telefono) : ''

  return (
    <header className="rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="m-0 min-w-0 text-display font-bold break-words text-ink">{cuenta.nombre}</h1>
        <BadgeEstado estado={estadoVisible(cuenta)} />
        <span className={CLASES_PILL}>{ETIQUETA_TIPO_CUENTA[cuenta.tipoCuenta]}</span>
        <span className={CLASES_PILL}>{ETIQUETA_METODO[cuenta.metodoCobro]}</span>
        {cuenta.cancelacionSolicitada && (
          <span className="text-meta font-semibold text-badge-tibio-ink">Pidió cancelar</span>
        )}
      </div>

      <p className="mt-1.5 mb-0 text-cuerpo text-ink-3">
        Cliente desde <span className="tabular-nums">{formatearFechaAR(cuenta.creadaEl)}</span> ·{' '}
        {haceCuantoAR(cuenta.creadaEl, ahora)}
      </p>

      <dl className="m-0 mt-4 grid grid-cols-1 gap-x-6 gap-y-4 text-cuerpo sm:grid-cols-2 lg:grid-cols-3">
        <div className="min-w-0">
          <dt className="text-meta font-semibold text-ink-3">Dueño</dt>
          <dd className="m-0 mt-0.5 flex min-w-0 flex-col gap-1.5 text-ink-2">
            {cuenta.dueno ? (
              <>
                <span className="font-semibold text-ink">{cuenta.dueno.nombre}</span>
                <span className="flex min-w-0 items-center gap-2">
                  <span className="min-w-0 truncate">
                    <EmailLink email={cuenta.dueno.email} />
                  </span>
                  <button
                    type="button"
                    onClick={() => copiar(cuenta.dueno!.email, 'Email copiado.')}
                    aria-label={`Copiar el email ${cuenta.dueno.email}`}
                    className={CLASES_BOTON_CHICO}
                  >
                    Copiar
                  </button>
                </span>
                {telefono && whatsapp ? (
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="tabular-nums">{formatearInternacional(telefono)}</span>
                    <a
                      href={whatsapp}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Escribirle por WhatsApp a ${cuenta.dueno.nombre}`}
                      className={CLASES_BOTON_CHICO}
                    >
                      <IconoChat className="size-4" />
                      WhatsApp
                    </a>
                  </span>
                ) : (
                  <span className="text-ink-3">Sin teléfono</span>
                )}
              </>
            ) : (
              <span className="text-peligro-ink">Sin dueño</span>
            )}
          </dd>
        </div>

        <div className="min-w-0">
          <dt className="text-meta font-semibold text-ink-3">Plan</dt>
          <dd className="m-0 mt-0.5 text-ink-2">
            <span className="font-semibold text-ink">
              {cuenta.plan ? DETALLE_PLAN[cuenta.plan].nombre : 'Sin plan'}
            </span>
            {precioLista !== null && (
              <span className="block text-ink-3 tabular-nums">
                {formatearArs(precioLista)} por mes (precio de lista)
              </span>
            )}
          </dd>
        </div>

        {/* Una prueba en curso muestra su barra abajo: esto sería lo mismo dos veces. */}
        {progreso === null && hito && (
          <div className="min-w-0">
            <dt className="text-meta font-semibold text-ink-3">{hito.etiqueta}</dt>
            <dd className="m-0 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-ink-2">
              <span className="font-semibold text-ink tabular-nums">{formatearFechaAR(hito.fecha)}</span>
              {alerta ? (
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-meta font-semibold ${BADGE_ALERTA[alerta]}`}
                >
                  {esSuspendida(cuenta)
                    ? 'Suspendida'
                    : vencidaHace === null
                      ? ETIQUETA_ALERTA[alerta]
                      : `Vencida ${textoVencidaHace(vencidaHace)}`}
                </span>
              ) : (
                dias !== null && (
                  <span className="text-ink-3">
                    {dias >= 1 ? `en ${textoDiasHasta(dias)}` : textoDiasHasta(dias)}
                  </span>
                )
              )}
            </dd>
            {cuenta.estado === 'GRACIA' && cuenta.ultimoPagoFallido && (
              <dd className="m-0 mt-1 text-meta font-semibold text-peligro-ink">
                Falló el cobro el {formatearFechaAR(cuenta.ultimoPagoFallido)} ·{' '}
                {haceCuantoAR(cuenta.ultimoPagoFallido, ahora)}
              </dd>
            )}
          </div>
        )}
      </dl>

      {progreso && (
        <div className="mt-4 rounded-xl border border-border bg-surface-2 px-4 py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-cuerpo">
            <span className="font-semibold text-ink">
              Día {progreso.dia} de {progreso.total} de la prueba
            </span>
            <span className="text-ink-3">
              Termina el <span className="tabular-nums">{formatearFechaAR(cuenta.finTrial)}</span>
              {progreso.diasRestantes === 0
                ? ' · último día'
                : ` · ${progreso.diasRestantes === 1 ? 'queda 1 día' : `quedan ${progreso.diasRestantes} días`}`}
            </span>
          </div>
          <div
            role="progressbar"
            aria-label="Avance de la prueba"
            aria-valuemin={1}
            aria-valuemax={progreso.total}
            aria-valuenow={progreso.dia}
            aria-valuetext={`Día ${progreso.dia} de ${progreso.total}`}
            className="mt-2 h-2 overflow-hidden rounded-full bg-border"
          >
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${(progreso.dia / progreso.total) * 100}%` }}
            />
          </div>
        </div>
      )}
    </header>
  )
}
