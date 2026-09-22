import { Link, useParams } from 'react-router-dom'
import { BADGE_ESTADO } from '../components/admin/estilosEstado'
import { CardKpi } from '../components/comunes/CardKpi'
import { EmailLink } from '../components/comunes/AccionesContacto'
import { BotonError, EstadoError } from '../components/comunes/EstadoError'
import { Spinner } from '../components/Spinner'
import { useMetricasCuenta, usePanelAdmin } from '../hooks/useAdmin'
import { diasDesde, ETIQUETA_ESTADO, proximoHito } from '../lib/api/admin'
import { DETALLE_PLAN } from '../lib/api/suscripcion'
import { formatearFecha } from '../lib/formatoFecha'

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

function haceCuanto(dias: number): string {
  if (dias === 0) return 'Hoy'
  if (dias === 1) return 'Ayer'
  return `Hace ${dias} días`
}
