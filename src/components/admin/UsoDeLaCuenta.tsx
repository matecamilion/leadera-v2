import { CardKpi } from '../comunes/CardKpi'
import { BotonError, EstadoError } from '../comunes/EstadoError'
import { Spinner } from '../Spinner'
import {
  ETIQUETA_ACTIVIDAD,
  formatearFechaAR,
  haceCuantoAR,
  nivelDeActividad,
  type MetricasUsoCuenta,
} from '../../lib/api/admin'

/**
 * Cuánto usa LeadEra la cuenta: sólo cantidades, nunca filas. Una cuenta que
 * todavía no cargó nada ocupa una línea en vez de seis tarjetas en cero.
 */
export function UsoDeLaCuenta({
  metricas,
  limiteUsuarios,
  cargando,
  error,
  onReintentar,
  ahora,
}: {
  metricas: MetricasUsoCuenta | undefined
  /** Tope de usuarios activos del plan. null es "sin tope". */
  limiteUsuarios: number | null
  cargando: boolean
  error: string | null
  onReintentar: () => void
  ahora: Date
}) {
  return (
    <section aria-labelledby="titulo-uso" className="flex flex-col gap-3">
      <div>
        <h2 id="titulo-uso" className="m-0 text-titulo font-bold text-ink">
          Uso de la cuenta
        </h2>
        <p className="mt-0.5 mb-0 text-meta text-ink-3">
          Sólo cantidades. Los datos de sus clientes no se muestran en este panel.
        </p>
      </div>

      {cargando && <Spinner label="Cargando el uso" />}

      {error && (
        <EstadoError mensaje={error} accion={<BotonError onClick={onReintentar}>Reintentar</BotonError>} />
      )}

      {metricas && <Contenido metricas={metricas} limiteUsuarios={limiteUsuarios} ahora={ahora} />}
    </section>
  )
}

function Contenido({
  metricas: m,
  limiteUsuarios,
  ahora,
}: {
  metricas: MetricasUsoCuenta
  limiteUsuarios: number | null
  ahora: Date
}) {
  const { nivel, dias } = nivelDeActividad(m.ultimaActividad, ahora)

  const usuarios =
    limiteUsuarios === null
      ? `${m.agentesActivos} activos de ${m.agentesTotal} en el equipo`
      : `${m.agentesActivos} de ${limiteUsuarios} usuarios`

  if (nivel === 'sin_actividad') {
    return (
      <p className="m-0 rounded-xl border border-border bg-surface-2 px-4 py-3 text-cuerpo text-ink-2">
        <span className="font-semibold text-ink">Sin actividad.</span> Todavía no cargó datos. Usuarios:{' '}
        {usuarios}.
      </p>
    )
  }

  return (
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
        label="Usuarios"
        valor={limiteUsuarios === null ? String(m.agentesActivos) : `${m.agentesActivos} de ${limiteUsuarios}`}
        contexto={limiteUsuarios === null ? `${m.agentesTotal} en el equipo` : 'activos y tope del plan'}
      />
      <CardKpi
        label="Actividad"
        valor={ETIQUETA_ACTIVIDAD[nivel]}
        alerta={nivel === 'dormida'}
        contexto={
          m.ultimaActividad && dias !== null
            ? `Última: ${haceCuantoAR(m.ultimaActividad, ahora)} · ${formatearFechaAR(m.ultimaActividad)}`
            : undefined
        }
      />
    </div>
  )
}
