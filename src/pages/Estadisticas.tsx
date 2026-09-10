import { CardKpi } from '../components/comunes/CardKpi'
import { DonutTemperatura } from '../components/perfil/DonutTemperatura'
import { Embudo } from '../components/perfil/Embudo'
import { GraficoEvolucion } from '../components/perfil/GraficoEvolucion'
import { GraficoOrigenes } from '../components/perfil/GraficoOrigenes'
import { MetaMensual } from '../components/perfil/MetaMensual'
import { PipelineAbierto } from '../components/perfil/PipelineAbierto'
import { PropiedadesSinMovimiento } from '../components/perfil/PropiedadesSinMovimiento'
import {
  IconoCalendario,
  IconoCheck,
  IconoConversacion,
  IconoFuego,
  IconoPersonaMas,
  IconoReloj,
  IconoTermometro,
} from '../components/leads/Iconos'
import { useMetricasPerfil } from '../hooks/usePerfil'

/** Todas las palabras que usamos acá pluralizan con una 's'. */
function plural(cantidad: number, palabra: string): string {
  return cantidad === 1 ? palabra : `${palabra}s`
}

export default function Estadisticas() {
  const { data, isPending, isError, error } = useMetricasPerfil()

  const mesActual = new Date().toLocaleString('es-AR', { month: 'long' })

  if (isPending) return <Skeleton />

  if (isError) {
    return (
      <div className="mx-auto max-w-[1120px]">
        <p
          role="alert"
          className="rounded-lg border border-peligro-borde bg-peligro-soft px-4 py-3 text-[0.9rem] text-peligro-ink"
        >
          {error instanceof Error ? error.message : 'No pudimos cargar tus métricas.'}
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1120px]">
      <header className="mb-6">
        <h1 className="m-0 text-[1.6rem] leading-tight font-bold text-ink">Estadísticas</h1>
        <p className="mt-1 text-[0.9rem] text-ink-3">
          <span className="capitalize">{mesActual}</span> · quedan{' '}
          {data.diasRestantesMes} {data.diasRestantesMes === 1 ? 'día' : 'días'} del mes
        </p>
      </header>

      {data.calientes > 0 && (
        <p className="mb-6 inline-flex items-center gap-2 rounded-full bg-hot-soft px-3.5 py-1.5 text-[0.85rem] font-semibold text-caliente">
          <IconoFuego className="size-4 shrink-0" />
          {data.calientes} {data.calientes === 1 ? 'lead caliente requiere' : 'leads calientes requieren'}{' '}
          tu atención
        </p>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <CardKpi
          label="Leads activos"
          valor={String(data.activos)}
          contexto={`${data.calientes} ${plural(data.calientes, 'caliente')} · ${data.tibios} ${plural(data.tibios, 'tibio')} · ${data.frios} ${plural(data.frios, 'frío')}`}
          icono={<IconoTermometro className="size-[18px]" />}
          tono="brand"
        />
        <CardKpi
          label="Ganados del mes"
          valor={String(data.ganadosMes)}
          contexto={`Meta ${data.metaMensualGanados}`}
          icono={<IconoCheck className="size-[18px]" />}
          tono="brand"
        />
        <CardKpi
          label="Nuevos del mes"
          valor={String(data.nuevosDelMes)}
          icono={<IconoPersonaMas className="size-[18px]" />}
          tono="frio"
        />
        <CardKpi
          label="Perdidos del mes"
          valor={String(data.perdidosMes)}
          contexto="Aproximado"
          icono={<IconoCalendario className="size-[18px]" />}
          tono="caliente"
        />
        <CardKpi
          label="Interacciones (7d)"
          valor={String(data.interacciones7d)}
          icono={<IconoConversacion className="size-[18px]" />}
          tono="frio"
        />
        <CardKpi
          label="Tasa de conversión"
          // null = todavía no hay contactados; un 0% ahí sería mentira.
          valor={data.tasaConversion == null ? '—' : `${data.tasaConversion.toFixed(1)}%`}
          contexto="Ganados sobre contactados"
          icono={<IconoCheck className="size-[18px]" />}
          tono="brand"
        />
        <CardKpi
          label="Tiempo de respuesta"
          valor={
            data.tiempoRespuestaDias == null
              ? '—'
              : `${data.tiempoRespuestaDias.toFixed(1)} d`
          }
          contexto="Del alta al primer contacto"
          icono={<IconoReloj className="size-[18px]" />}
          tono="tibio"
        />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <MetaMensual
          ganadosMes={data.ganadosMes}
          meta={data.metaMensualGanados}
          diasRestantes={data.diasRestantesMes}
        />
        <DonutTemperatura
          calientes={data.calientes}
          tibios={data.tibios}
          frios={data.frios}
        />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <GraficoOrigenes origenes={data.origenes} />
        <div className="flex flex-col gap-4">
          <PipelineAbierto totales={data.valorPipelineAbierto} />
          <PropiedadesSinMovimiento propiedades={data.propiedadesSinMovimiento} />
        </div>
      </div>

      <div className="mb-6">
        <GraficoEvolucion />
      </div>

      <div className="mb-6">
        <Embudo />
      </div>
    </div>
  )
}

function Skeleton() {
  return (
    <div aria-busy="true" aria-label="Cargando tus métricas" className="mx-auto max-w-[1120px]">
      <div className="mb-6">
        <div className="h-7 w-52 animate-pulse rounded bg-surface-2 motion-reduce:animate-none" />
        <div className="mt-2 h-4 w-44 animate-pulse rounded bg-surface-2 motion-reduce:animate-none" />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 7 }, (_, i) => (
          <div
            key={i}
            className="h-[110px] animate-pulse rounded-2xl bg-surface-2 motion-reduce:animate-none"
          />
        ))}
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }, (_, i) => (
          <div
            key={i}
            className="h-[240px] animate-pulse rounded-2xl bg-surface-2 motion-reduce:animate-none"
          />
        ))}
      </div>
    </div>
  )
}
