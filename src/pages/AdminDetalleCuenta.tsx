import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BADGE_ALERTA, BADGE_ESTADO } from '../components/admin/estilosEstado'
import { ModalAccionConNota } from '../components/admin/ModalAccionConNota'
import { ModalAjustarVencimiento } from '../components/admin/ModalAjustarVencimiento'
import { ModalRegistrarPago } from '../components/admin/ModalRegistrarPago'
import { Campo } from '../components/comunes/CampoFormulario'
import { CLASES_CONTROL } from '../components/comunes/estilosFormulario'
import { CardKpi } from '../components/comunes/CardKpi'
import { EmailLink } from '../components/comunes/AccionesContacto'
import { BotonError, EstadoError } from '../components/comunes/EstadoError'
import { Spinner } from '../components/Spinner'
import {
  useAnularPago,
  useExtenderTrial,
  useHistorialCobros,
  useMetricasCuenta,
  usePanelAdmin,
  useSetTipoCuenta,
  useSuspenderCuenta,
} from '../hooks/useAdmin'
import { usePreciosPlanes } from '../hooks/useSuscripcion'
import {
  alertaDeCobro,
  diasDesde,
  diasHastaVencimiento,
  ETIQUETA_ALERTA,
  ETIQUETA_ESTADO,
  ETIQUETA_METODO,
  ETIQUETA_TIPO_CUENTA,
  fechaDeVencimiento,
  formatearArs,
  proximoHito,
  puedeExtenderTrial,
  puedeSuspender,
  TIPOS_CUENTA,
  DIAS_TRIAL_MAX,
  DIAS_TRIAL_MIN,
  type CuentaAdmin,
  type MovimientoCobro,
  type TipoCuenta,
} from '../lib/api/admin'
import { DETALLE_PLAN, type Plan } from '../lib/api/suscripcion'
import { mensajeDeCobro } from '../lib/config'
import { formatearFecha } from '../lib/formatoFecha'
import { useUiStore } from '../stores/ui'

/**
 * Detalle de una inmobiliaria en el panel interno: la cuenta arriba y su uso
 * abajo, en números.
 *
 * Los datos de cuenta salen de la misma consulta que el listado —ya está en
 * cache si se llega con un click, y son 16 filas si se entra por link—, así
 * que el encabezado dice exactamente lo mismo que la fila de la tabla.
 *
 * Las métricas de uso salen de `admin_metricas_inmobiliaria`: conteos, nunca
 * filas. Esta pantalla no tiene forma de mostrar un lead, una propiedad ni el
 * texto de una interacción, porque la base no se los devuelve.
 */
export default function AdminDetalleCuenta() {
  const { id } = useParams<{ id: string }>()
  const panel = usePanelAdmin()
  const metricas = useMetricasCuenta(id)
  const precios = usePreciosPlanes()
  const [modal, setModal] = useState<'pago' | 'vencimiento' | null>(null)

  const volver = (
    <Link
      to="/admin"
      className="inline-flex items-center gap-1 text-[0.85rem] font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <span aria-hidden>←</span> Todas las inmobiliarias
    </Link>
  )

  if (panel.isPending) return <Spinner label="Cargando la cuenta" />

  if (panel.isError) {
    return (
      <div className="flex flex-col gap-4">
        {volver}
        <EstadoError
          mensaje={panel.error.message}
          accion={<BotonError onClick={() => panel.refetch()}>Reintentar</BotonError>}
        />
      </div>
    )
  }

  const cuenta = panel.data.cuentas.find((c) => c.id === id)
  if (!cuenta) {
    return (
      <div className="flex flex-col gap-4">
        {volver}
        <EstadoError titulo="No encontramos esa inmobiliaria" mensaje="Puede que el link esté mal o que la cuenta ya no exista." />
      </div>
    )
  }

  const hito = proximoHito(cuenta)
  const diasAlta = diasDesde(cuenta.creadaEl)
  const m = metricas.data

  // El precio de lista del plan que se esté por cobrar. `usePreciosPlanes` ya
  // está en cache por la pantalla de suscripción y la clave es la misma, así
  // que pedirlo también acá no agrega una consulta.
  const precioMensual = (plan: Plan) =>
    precios.data?.find((p) => p.plan === plan)?.precio_ars ?? null

  return (
    <div className="flex flex-col gap-5">
      {volver}

      <header className="rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="m-0 text-[1.5rem] leading-tight font-bold text-ink">{cuenta.nombre}</h1>
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[0.74rem] font-semibold ${BADGE_ESTADO[cuenta.estado]}`}>
            {ETIQUETA_ESTADO[cuenta.estado]}
          </span>
          {cuenta.cancelacionSolicitada && (
            <span className="text-[0.78rem] font-semibold text-badge-tibio-ink">Pidió cancelar</span>
          )}
        </div>

        <dl className="m-0 mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-[0.84rem] sm:grid-cols-4">
          <div>
            <dt className="text-[0.74rem] font-semibold text-ink-3">Plan</dt>
            <dd className="m-0 text-ink-2">{cuenta.plan ? DETALLE_PLAN[cuenta.plan].nombre : 'Sin plan'}</dd>
          </div>
          <div>
            <dt className="text-[0.74rem] font-semibold text-ink-3">Alta</dt>
            <dd className="m-0 text-ink-2 tabular-nums">
              {formatearFecha(cuenta.creadaEl)} · {diasAlta === 1 ? '1 día' : `${diasAlta} días`}
            </dd>
          </div>
          <div>
            <dt className="text-[0.74rem] font-semibold text-ink-3">{hito?.etiqueta ?? 'Próxima fecha'}</dt>
            <dd className="m-0 text-ink-2 tabular-nums">{hito ? formatearFecha(hito.fecha) : '—'}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[0.74rem] font-semibold text-ink-3">Dueño</dt>
            <dd className="m-0 flex min-w-0 flex-col text-ink-2">
              {cuenta.dueno ? (
                <>
                  <span className="truncate">{cuenta.dueno.nombre}</span>
                  <span className="truncate text-[0.78rem]">
                    <EmailLink email={cuenta.dueno.email} />
                  </span>
                </>
              ) : (
                <span className="text-peligro-ink">Sin dueño</span>
              )}
            </dd>
          </div>
          {cuenta.estado === 'GRACIA' && (
            <div>
              <dt className="text-[0.74rem] font-semibold text-ink-3">Falló el cobro</dt>
              <dd className="m-0 font-semibold text-peligro-ink tabular-nums">{formatearFecha(cuenta.ultimoPagoFallido)}</dd>
            </div>
          )}
          <div>
            <dt className="text-[0.74rem] font-semibold text-ink-3">Último pago aprobado</dt>
            <dd className="m-0 text-ink-2 tabular-nums">
              {cuenta.ultimoPagoAprobado ? formatearFecha(cuenta.ultimoPagoAprobado) : 'Ninguno en el último año'}
            </dd>
          </div>
        </dl>
      </header>

      <SeccionCobro
        cuenta={cuenta}
        precioMensual={precioMensual}
        onRegistrarPago={() => setModal('pago')}
        onAjustarVencimiento={() => setModal('vencimiento')}
      />

      <ModalRegistrarPago
        abierto={modal === 'pago'}
        cuenta={cuenta}
        precioMensual={precioMensual}
        onCerrar={() => setModal(null)}
      />
      {cuenta.metodoCobro === 'MANUAL' && (
        <ModalAjustarVencimiento
          abierto={modal === 'vencimiento'}
          cuenta={cuenta}
          onCerrar={() => setModal(null)}
        />
      )}

      <section aria-labelledby="titulo-uso" className="flex flex-col gap-3">
        <div>
          <h2 id="titulo-uso" className="m-0 text-[0.95rem] font-bold text-ink">Uso de la cuenta</h2>
          <p className="mt-0.5 mb-0 text-[0.78rem] text-ink-3">
            Sólo cantidades. Los datos de sus clientes no se muestran en este panel.
          </p>
        </div>

        {metricas.isPending && <Spinner label="Cargando el uso" />}

        {metricas.isError && (
          <EstadoError
            mensaje={metricas.error.message}
            accion={<BotonError onClick={() => metricas.refetch()}>Reintentar</BotonError>}
          />
        )}

        {m && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <CardKpi
              label="Leads"
              valor={String(m.leadsTotal)}
              contexto={`${m.leadsNuevos30d} ${m.leadsNuevos30d === 1 ? 'cargado' : 'cargados'} en los últimos 30 días`}
            />
            <CardKpi label="Propiedades" valor={String(m.propiedadesTotal)} />
            <CardKpi
              label="Operaciones"
              valor={String(m.operacionesTotal)}
              contexto={`${m.operacionesGanadas} ${m.operacionesGanadas === 1 ? 'cerrada ganada' : 'cerradas ganadas'}`}
            />
            <CardKpi label="Interacciones" valor={String(m.interaccionesTotal)} />
            <CardKpi
              label="Usuarios activos"
              valor={String(m.agentesActivos)}
              contexto={`de ${m.agentesTotal} en el equipo`}
            />
            <CardKpi
              label="Última actividad"
              valor={m.ultimaActividad ? formatearFecha(m.ultimaActividad) : 'Sin actividad'}
              contexto={m.ultimaActividad ? haceCuanto(diasDesde(m.ultimaActividad)) : 'Nunca cargó datos'}
            />
          </div>
        )}
      </section>
    </div>
  )
}

/**
 * El cobro de la cuenta: cómo paga, hasta cuándo está paga y qué se puede
 * hacer al respecto.
 *
 * "Ajustar vencimiento" sólo aparece en cuentas manuales, igual que el RPC,
 * que rechaza a las de Mercado Pago: el vencimiento de ésas lo maneja el
 * webhook y moverlo a mano sería pelearle.
 */
function SeccionCobro({
  cuenta,
  precioMensual,
  onRegistrarPago,
  onAjustarVencimiento,
}: {
  cuenta: CuentaAdmin
  precioMensual: (plan: Plan) => number | null
  onRegistrarPago: () => void
  onAjustarVencimiento: () => void
}) {
  const cobros = useHistorialCobros(cuenta.id)
  const mostrarAviso = useUiStore((s) => s.mostrarAviso)
  const anular = useAnularPago()
  const extender = useExtenderTrial()
  const suspender = useSuspenderCuenta()

  const [accion, setAccion] = useState<'trial' | 'suspender' | null>(null)
  const [pagoAAnular, setPagoAAnular] = useState<MovimientoCobro | null>(null)
  const [diasTrial, setDiasTrial] = useState(7)

  const manual = cuenta.metodoCobro === 'MANUAL'
  const vence = fechaDeVencimiento(cuenta)
  const dias = diasHastaVencimiento(cuenta)
  const alerta = alertaDeCobro(cuenta)
  const precio = cuenta.plan ? precioMensual(cuenta.plan) : null

  /**
   * El mensaje de cobro, listo para pegar en WhatsApp.
   *
   * La fecha es la del vencimiento real de la cuenta; si todavía no pagó nunca
   * —está en trial— se usa el fin del trial, que es la fecha que le importa.
   */
  async function copiarMensaje() {
    const fecha = vence ?? cuenta.finTrial
    const texto = mensajeDeCobro({
      dueno: cuenta.dueno?.nombre ?? null,
      plan: cuenta.plan ? DETALLE_PLAN[cuenta.plan].nombre : 'sin plan',
      vencimiento: formatearFecha(fecha),
      monto: precio === null ? 'consultar' : formatearArs(precio),
    })

    try {
      await navigator.clipboard.writeText(texto)
      mostrarAviso('Mensaje de cobro copiado.')
    } catch {
      // Sin permiso de portapapeles —o sin HTTPS— no hay forma de copiar por
      // código. Se avisa en vez de fallar en silencio.
      mostrarAviso('No se pudo copiar. Revisá los permisos del navegador.', 'error')
    }
  }

  return (
    <section
      aria-labelledby="titulo-cobro"
      className="rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="titulo-cobro" className="m-0 text-[0.95rem] font-bold text-ink">
          Cobro
        </h2>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={copiarMensaje} className={CLASES_BOTON_SECUNDARIO}>
            Copiar mensaje de cobro
          </button>

          {puedeExtenderTrial(cuenta) && (
            <button
              type="button"
              onClick={() => setAccion('trial')}
              className={CLASES_BOTON_SECUNDARIO}
            >
              Extender trial
            </button>
          )}

          {manual && (
            <button
              type="button"
              onClick={onAjustarVencimiento}
              className={CLASES_BOTON_SECUNDARIO}
            >
              Ajustar vencimiento
            </button>
          )}

          {puedeSuspender(cuenta) && (
            <button
              type="button"
              onClick={() => setAccion('suspender')}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-[0.82rem] font-semibold text-ink-3 transition-colors hover:border-peligro-borde hover:bg-peligro-soft hover:text-peligro-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-peligro-ink motion-reduce:transition-none"
            >
              Suspender cuenta
            </button>
          )}

          <button
            type="button"
            onClick={onRegistrarPago}
            className="rounded-lg bg-primary px-3 py-2 text-[0.82rem] font-semibold text-primary-contrast transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
          >
            Registrar pago
          </button>
        </div>
      </div>

      <dl className="m-0 mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-[0.84rem] sm:grid-cols-4">
        <div>
          <dt className="text-[0.74rem] font-semibold text-ink-3">Plan</dt>
          <dd className="m-0 text-ink-2">
            {cuenta.plan ? DETALLE_PLAN[cuenta.plan].nombre : 'Sin plan'}
          </dd>
        </div>
        <div>
          <dt className="text-[0.74rem] font-semibold text-ink-3">Método</dt>
          <dd className="m-0 text-ink-2">{ETIQUETA_METODO[cuenta.metodoCobro]}</dd>
        </div>
        <div>
          <dt className="text-[0.74rem] font-semibold text-ink-3">
            {manual ? 'Acceso pagado hasta' : 'Próximo cobro'}
          </dt>
          <dd className="m-0 flex flex-wrap items-center gap-2 text-ink-2 tabular-nums">
            {vence ? formatearFecha(vence) : '—'}
            {alerta && (
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[0.72rem] font-semibold ${BADGE_ALERTA[alerta]}`}
              >
                {ETIQUETA_ALERTA[alerta]}
              </span>
            )}
            {!alerta && dias !== null && (
              <span className="text-[0.74rem] text-ink-3">
                {dias === 1 ? 'en 1 día' : `en ${dias} días`}
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-[0.74rem] font-semibold text-ink-3">Precio de lista</dt>
          <dd className="m-0 text-ink-2 tabular-nums">
            {precio === null ? '—' : `${formatearArs(precio)} / mes`}
          </dd>
        </div>
      </dl>

      <SelectorTipoCuenta cuenta={cuenta} />

      <h3 className="mt-5 mb-2 text-[0.82rem] font-bold text-ink-2">Historial de cobros</h3>

      {cobros.isPending && <Spinner label="Cargando los cobros" />}
      {cobros.isError && (
        <EstadoError
          mensaje={cobros.error.message}
          accion={<BotonError onClick={() => cobros.refetch()}>Reintentar</BotonError>}
        />
      )}
      {cobros.data?.length === 0 && (
        <p className="m-0 text-[0.82rem] text-ink-3">Todavía no hay movimientos de cobro.</p>
      )}
      <ModalAccionConNota
        abierto={pagoAAnular !== null}
        titulo="Anular el pago"
        subtitulo={cuenta.nombre}
        descripcion={
          pagoAAnular
            ? `Se le van a descontar a la cuenta los meses que cubría este pago de ${
                pagoAAnular.monto === null ? 'monto desconocido' : formatearArs(pagoAAnular.monto)
              }. El pago queda en el historial, tachado.`
            : undefined
        }
        placeholderNota="Por qué se anula: se cargó mal, la transferencia no entró…"
        textoConfirmar="Anular pago"
        textoConfirmando="Anulando…"
        destructivo
        guardando={anular.isPending}
        error={anular.isError ? anular.error.message : null}
        onCerrar={() => {
          if (anular.isPending) return
          setPagoAAnular(null)
        }}
        onConfirmar={(nota) => {
          if (!pagoAAnular) return
          anular.mutate(
            { eventoId: pagoAAnular.id, nota },
            { onSuccess: () => setPagoAAnular(null) },
          )
        }}
      />

      <ModalAccionConNota
        abierto={accion === 'trial'}
        titulo="Extender el trial"
        subtitulo={cuenta.nombre}
        descripcion="La cuenta vuelve a quedar en período de prueba, contando desde hoy o desde la fecha que tenía, la que sea mayor."
        placeholderNota="Por qué se extiende."
        textoConfirmar="Extender"
        textoConfirmando="Extendiendo…"
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
              onChange={(e) => setDiasTrial(Number(e.target.value))}
              className={CLASES_CONTROL}
            />
          </Campo>
        }
        onCerrar={() => {
          if (extender.isPending) return
          extender.reset()
          setAccion(null)
        }}
        onConfirmar={(nota) =>
          extender.mutate(
            { inmobiliariaId: cuenta.id, dias: diasTrial, nota },
            {
              onSuccess: (nuevoFin) => {
                setAccion(null)
                mostrarAviso(`Trial extendido hasta el ${formatearFecha(nuevoFin)}.`)
              },
            },
          )
        }
      />

      <ModalAccionConNota
        abierto={accion === 'suspender'}
        titulo="¿Suspender la cuenta?"
        subtitulo={cuenta.nombre}
        descripcion="La cuenta queda vencida: el dueño va a ver la pantalla de cuenta vencida y el resto del equipo pierde el acceso. Para reactivarla hay que registrar un pago, ajustar el vencimiento o extender el trial."
        placeholderNota="Por qué se suspende."
        textoConfirmar="Sí, suspender"
        textoConfirmando="Suspendiendo…"
        destructivo
        guardando={suspender.isPending}
        error={suspender.isError ? suspender.error.message : null}
        onCerrar={() => {
          if (suspender.isPending) return
          suspender.reset()
          setAccion(null)
        }}
        onConfirmar={(nota) =>
          suspender.mutate(
            { inmobiliariaId: cuenta.id, nota },
            {
              onSuccess: () => {
                setAccion(null)
                mostrarAviso('Cuenta suspendida.')
              },
            },
          )
        }
      />

      {cobros.data && cobros.data.length > 0 && (
        <ul className="m-0 list-none divide-y divide-border overflow-hidden rounded-xl border border-border p-0">
          {cobros.data.map((mov) => (
            <li key={mov.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3.5 py-2.5">
              <span className="text-[0.8rem] text-ink-3 tabular-nums">
                {formatearFecha(mov.fecha)}
              </span>
              <span
                className={`text-[0.82rem] font-semibold ${
                  mov.anulado ? 'text-ink-4 line-through' : 'text-ink'
                }`}
              >
                {mov.etiqueta}
              </span>
              {mov.monto !== null && (
                <span
                  className={`text-[0.82rem] font-semibold tabular-nums ${
                    mov.anulado ? 'text-ink-4 line-through' : 'text-ink'
                  }`}
                >
                  {formatearArs(mov.monto)}
                </span>
              )}

              {mov.anulado && (
                <span className="inline-flex items-center rounded-full bg-surface-2 px-2 py-0.5 text-[0.7rem] font-bold text-ink-3 uppercase">
                  Anulado
                </span>
              )}

              {mov.anulable && (
                <button
                  type="button"
                  onClick={() => {
                    anular.reset()
                    setPagoAAnular(mov)
                  }}
                  className="ml-auto rounded-md px-2 py-1 text-[0.76rem] font-semibold text-ink-3 transition-colors hover:bg-peligro-soft hover:text-peligro-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-peligro-ink motion-reduce:transition-none"
                >
                  Anular
                </button>
              )}

              {mov.detalle && (
                <span
                  className={`w-full text-[0.78rem] ${mov.anulado ? 'text-ink-4' : 'text-ink-3'}`}
                >
                  {mov.detalle}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** El look de los botones de gestión que no son la acción principal. */
const CLASES_BOTON_SECUNDARIO =
  'rounded-lg border border-border bg-surface px-3 py-2 text-[0.82rem] font-semibold text-ink-2 transition-colors hover:border-ink-subtle hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none'

/**
 * Para qué es la cuenta: cliente, interna o de testing.
 *
 * Guarda en cuanto se elige, sin botón de confirmar: es un campo solo, se
 * deshace eligiendo de nuevo y queda registrado en el historial. Un formulario
 * con "Guardar" para un select sería una ceremonia de más.
 */
function SelectorTipoCuenta({ cuenta }: { cuenta: CuentaAdmin }) {
  const cambiar = useSetTipoCuenta()
  const mostrarAviso = useUiStore((s) => s.mostrarAviso)

  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-border pt-4">
      <label htmlFor="tipo-cuenta" className="text-[0.74rem] font-semibold text-ink-3">
        Tipo de cuenta
      </label>
      <select
        id="tipo-cuenta"
        value={cuenta.tipoCuenta}
        disabled={cambiar.isPending}
        onChange={(e) =>
          cambiar.mutate(
            { inmobiliariaId: cuenta.id, tipo: e.target.value as TipoCuenta },
            {
              onSuccess: () =>
                mostrarAviso(
                  `Ahora es una cuenta ${ETIQUETA_TIPO_CUENTA[e.target.value as TipoCuenta].toLowerCase()}.`,
                ),
            },
          )
        }
        className="rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-[0.82rem] text-ink transition-colors focus:border-primary focus:bg-surface focus:shadow-focus focus:outline-none disabled:opacity-60 motion-reduce:transition-none"
      >
        {TIPOS_CUENTA.map((t) => (
          <option key={t.valor} value={t.valor}>
            {t.label}
          </option>
        ))}
      </select>

      {cuenta.tipoCuenta !== 'CLIENTE' && (
        <span className="text-[0.76rem] text-ink-3">
          No cuenta en los ingresos ni en las métricas del panel.
        </span>
      )}

      {cambiar.isError && (
        <span role="alert" className="text-[0.76rem] text-peligro-ink">
          {cambiar.error.message}
        </span>
      )}
    </div>
  )
}

function haceCuanto(dias: number): string {
  if (dias === 0) return 'Hoy'
  if (dias === 1) return 'Ayer'
  return `Hace ${dias} días`
}
