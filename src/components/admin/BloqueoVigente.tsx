import { BotonError, EstadoError } from '../comunes/EstadoError'
import { Spinner } from '../Spinner'
import { useBloqueosCuenta } from '../../hooks/useAdmin'
import {
  bloqueoVigente,
  ETIQUETA_ESTADO,
  formatearFechaAR,
  haceCuantoAR,
  hayIncoherenciaDeBloqueo,
  puedeReactivar,
  type CuentaAdmin,
} from '../../lib/api/admin'
import { BotonReactivarCuenta } from './BotonReactivarCuenta'

/**
 * La suspensión vigente de la cuenta: quién la suspendió, cuándo y por qué, y
 * el botón para reactivarla. Sólo aparece si la cuenta tiene una abierta.
 *
 * La nota es interna: viene de `admin_bloqueos_cuenta`, que sólo responde al
 * superadmin, y esta pantalla es la única donde se muestra.
 *
 * Si la cuenta figura suspendida pero su estado ya no es VENCIDA, algo la movió
 * por fuera del panel —lo más probable, un cobro de Mercado Pago—: se avisa
 * arriba de todo porque la suspensión ya no está surtiendo efecto.
 */
export function BloqueoVigente({ cuenta, ahora }: { cuenta: CuentaAdmin; ahora: Date }) {
  // Sin una suspensión abierta no hay nada que pedir.
  const bloqueos = useBloqueosCuenta(cuenta.id, puedeReactivar(cuenta))

  if (!puedeReactivar(cuenta)) return null

  const vigente = bloqueos.data ? bloqueoVigente(bloqueos.data) : null

  return (
    <section
      aria-labelledby="titulo-bloqueo"
      className="rounded-2xl border border-peligro-borde bg-peligro-soft/40 p-4 sm:p-5"
    >
      <h2 id="titulo-bloqueo" className="m-0 text-titulo font-bold text-peligro-ink">
        Cuenta suspendida
      </h2>

      {hayIncoherenciaDeBloqueo(cuenta) && (
        <p
          role="alert"
          className="mt-3 mb-0 rounded-xl border border-tibio/40 bg-warm-soft px-4 py-3 text-cuerpo text-badge-tibio-ink"
        >
          <strong className="font-bold">La suspensión no está surtiendo efecto.</strong> La cuenta
          figura suspendida pero está en {ETIQUETA_ESTADO[cuenta.estado].toLowerCase()}: pudo
          revertirla un cobro de Mercado Pago. Si ya no corresponde, reactivala para cerrar el
          registro; si corresponde, reactivala y volvé a suspenderla.
        </p>
      )}

      {bloqueos.isPending && (
        <div className="mt-3">
          <Spinner label="Cargando la suspensión" />
        </div>
      )}

      {bloqueos.isError && (
        <div className="mt-3">
          <EstadoError
            mensaje={bloqueos.error.message}
            accion={<BotonError onClick={() => bloqueos.refetch()}>Reintentar</BotonError>}
          />
        </div>
      )}

      {bloqueos.data && vigente === null && (
        <p className="mt-3 mb-0 text-cuerpo text-ink-2">
          No hay un registro de quién la suspendió ni por qué.
        </p>
      )}

      {vigente && (
        <dl className="m-0 mt-3 grid grid-cols-1 gap-x-6 gap-y-3 text-cuerpo sm:grid-cols-3">
          <div className="min-w-0">
            <dt className="text-meta font-semibold text-ink-3">Quién</dt>
            <dd className="m-0 mt-0.5 font-semibold break-words text-ink">
              {vigente.bloqueadoPorNombre ?? 'Autor no registrado'}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-meta font-semibold text-ink-3">Cuándo</dt>
            <dd className="m-0 mt-0.5 text-ink-2">
              <span className="font-semibold text-ink tabular-nums">
                {formatearFechaAR(vigente.bloqueadoEl)}
              </span>{' '}
              · {haceCuantoAR(vigente.bloqueadoEl, ahora)}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-meta font-semibold text-ink-3">Estaba</dt>
            <dd className="m-0 mt-0.5 text-ink-2">
              {ETIQUETA_ESTADO[vigente.estadoAnterior]}
            </dd>
          </div>
          <div className="min-w-0 sm:col-span-3">
            <dt className="text-meta font-semibold text-ink-3">Por qué (interno)</dt>
            <dd className="m-0 mt-0.5 break-words whitespace-pre-wrap text-ink">{vigente.nota}</dd>
          </div>
        </dl>
      )}

      <div className="mt-4">
        <BotonReactivarCuenta cuenta={cuenta} />
      </div>
    </section>
  )
}
