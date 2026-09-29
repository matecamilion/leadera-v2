import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CardKpi } from '../components/comunes/CardKpi'
import { TONOS } from '../components/comunes/tonos'
import { DonutTemperatura } from '../components/perfil/DonutTemperatura'
import {
  calcularEtapas,
  calcularInsight,
  Embudo,
  pasoDelInsight,
  type Insight,
} from '../components/perfil/Embudo'
import { GraficoEvolucion } from '../components/perfil/GraficoEvolucion'
import { GraficoOrigenes } from '../components/perfil/GraficoOrigenes'
import { MetaMensual } from '../components/perfil/MetaMensual'
import { PipelineAbierto } from '../components/perfil/PipelineAbierto'
import { PropiedadesSinMovimiento } from '../components/perfil/PropiedadesSinMovimiento'
import {
  IconoAlerta,
  IconoCalendario,
  IconoConversacion,
  IconoFuego,
  IconoPersonaMas,
  IconoReloj,
  IconoTermometro,
  IconoUsuarios,
} from '../components/leads/Iconos'
import { useEmbudo } from '../hooks/useEmbudo'
import { useMetricasPerfil } from '../hooks/usePerfil'

export default function Estadisticas() {
  const { data, isPending, isError, error } = useMetricasPerfil()
  // Misma clave que usa `<Embudo />` adentro: esto no suma una consulta, sólo
  // lee la misma caché para sacar el aviso arriba de todo.
  const embudo = useEmbudo()

  const mesActual = new Date().toLocaleString('es-AR', { month: 'long' })

  // Se espera también al embudo para que el aviso no aparezca de golpe y
  // empuje la página hacia abajo. Si el embudo falla no se espera nada: no hay
  // aviso y la card del embudo muestra su propio error.
  if (isPending || embudo.isPending) return <Skeleton />

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

  // Sin contactados el embudo no se dibuja, así que tampoco hay aviso.
  const caida = calcularCaida(embudo.data)

  // Los activos incluyen los leads sin temperatura (`estado` null); el donut
  // sólo sabía de las tres temperaturas y por eso no sumaba lo mismo.
  const sinClasificar = Math.max(data.activos - (data.calientes + data.tibios + data.frios), 0)

  return (
    <div className="mx-auto max-w-[1120px]">
      <header className="mb-6">
        <h1 className="m-0 text-[1.6rem] leading-tight font-bold text-ink">Estadísticas</h1>
        <p className="mt-1 text-[0.9rem] text-ink-3">
          <span className="capitalize">{mesActual}</span> · quedan{' '}
          {data.diasRestantesMes} {data.diasRestantesMes === 1 ? 'día' : 'días'} del mes
        </p>
      </header>

      <RequiereAtencion calientes={data.calientes} caida={caida} />

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
          sinClasificar={sinClasificar}
        />
      </div>

      {/* El período va en el contexto de cada card: la grilla mezcla números
          del mes, de la última semana y de toda la cartera, y sin decirlo
          parecen comparables. */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <CardKpi
          label="Leads activos"
          valor={String(data.activos)}
          contexto="Toda tu cartera"
          icono={<IconoTermometro className="size-[18px]" />}
          tono="brand"
        />
        <CardKpi
          label="Leads nuevos"
          valor={String(data.nuevosDelMes)}
          contexto="Este mes"
          icono={<IconoPersonaMas className="size-[18px]" />}
          tono="frio"
        />
        <CardKpi
          label="Perdidos"
          valor={String(data.perdidosMes)}
          contexto="Este mes · aproximado"
          icono={<IconoCalendario className="size-[18px]" />}
          tono="caliente"
        />
        <CardKpi
          label="Interacciones"
          valor={String(data.interacciones7d)}
          contexto="Últimos 7 días"
          icono={<IconoConversacion className="size-[18px]" />}
          tono="frio"
        />
        <CardKpi
          label="Tasa de conversión"
          // null = todavía no hay contactados; un 0% ahí sería mentira.
          valor={data.tasaConversion == null ? '—' : `${data.tasaConversion.toFixed(1)}%`}
          contexto="Toda tu cartera · ganados sobre contactados"
          icono={<IconoUsuarios className="size-[18px]" />}
          tono="brand"
        />
        <CardKpi
          label="Tiempo de respuesta"
          valor={
            data.tiempoRespuestaDias == null
              ? '—'
              : `${data.tiempoRespuestaDias.toFixed(1)} d`
          }
          contexto="Toda tu cartera · del alta al primer contacto"
          icono={<IconoReloj className="size-[18px]" />}
          tono="tibio"
        />
      </div>

      <div className="mb-6">
        <GraficoEvolucion />
      </div>

      {/* `scroll-mt-20`: el header de la app es sticky (h-16); sin el margen
          el "Ver embudo" dejaría el título tapado. */}
      <div id={ID_EMBUDO} className="mb-6 scroll-mt-20">
        <Embudo />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <GraficoOrigenes origenes={data.origenes} />
        <div className="flex flex-col gap-4">
          <PipelineAbierto totales={data.valorPipelineAbierto} />
          <PropiedadesSinMovimiento propiedades={data.propiedadesSinMovimiento} />
        </div>
      </div>
    </div>
  )
}

const ID_EMBUDO = 'embudo'

/** Scroll suave al embudo, o salto directo si el sistema pide menos movimiento. */
function irAlEmbudo(evento: React.MouseEvent<HTMLAnchorElement>) {
  const destino = document.getElementById(ID_EMBUDO)
  if (!destino) return
  // Sin esto el `#embudo` quedaría en la URL, y volver atrás no saldría de
  // la pantalla sino que subiría al principio.
  evento.preventDefault()
  const reducir = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  destino.scrollIntoView({ behavior: reducir ? 'auto' : 'smooth', block: 'start' })
}

interface Caida {
  insight: Insight
  /** Cuántos había en la etapa de la que se cae la gente. */
  anterior: number
  /** Cuántos no pasaron a la siguiente. */
  perdidos: number
}

/** El peor paso del embudo en personas, o `null` si no hay caída que mostrar. */
function calcularCaida(datos: Parameters<typeof calcularEtapas>[0] | undefined): Caida | null {
  if (!datos || datos.contactados === 0) return null
  const etapas = calcularEtapas(datos)
  const insight = calcularInsight(etapas)
  const paso = pasoDelInsight(etapas, insight)
  if (!insight || !paso) return null
  return { insight, anterior: paso.anterior, perdidos: paso.perdidos }
}

/**
 * Lo que pide acción antes que nada: leads calientes y el escalón del embudo
 * donde más gente se cae. Cada tarjeta aparece sólo si tiene algo que decir;
 * sola ocupa el ancho entero y, sin ninguna, el bloque no se dibuja.
 */
function RequiereAtencion({ calientes, caida }: { calientes: number; caida: Caida | null }) {
  const hayCalientes = calientes > 0
  if (!hayCalientes && !caida) return null
  const ambas = hayCalientes && caida != null

  return (
    <section aria-labelledby="requiere-atencion" className="mb-6">
      <h2 id="requiere-atencion" className="m-0 mb-2 text-[0.8rem] font-semibold text-ink-3">
        Requiere tu atención
      </h2>
      <div className={`grid gap-3 ${ambas ? 'md:grid-cols-2' : ''}`}>
        {hayCalientes && (
          <TarjetaAtencion
            label="Para atender primero"
            icono={<IconoFuego className="size-[18px]" />}
            tono="caliente"
            valor={String(calientes)}
            contexto={
              <>
                {calientes === 1 ? 'lead caliente' : 'leads calientes'} ·{' '}
                <Link to="/leads?estado=CALIENTE" className={CLASES_ACCION}>
                  Ver leads →
                </Link>
              </>
            }
          />
        )}
        {caida && (
          <TarjetaAtencion
            label="Donde más se cae el embudo"
            icono={<IconoAlerta className="size-[18px]" />}
            tono="tibio"
            valor={`${caida.perdidos} de ${caida.anterior}`}
            contexto={
              <>
                se {caida.perdidos === 1 ? 'pierde' : 'pierden'} entre {caida.insight.desde} y{' '}
                {caida.insight.hasta} ·{' '}
                <a href={`#${ID_EMBUDO}`} onClick={irAlEmbudo} className={CLASES_ACCION}>
                  Ver embudo →
                </a>
              </>
            }
          />
        )}
      </div>
    </section>
  )
}

const CLASES_ACCION =
  'font-semibold whitespace-nowrap text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'

/**
 * Colores del valor y del chip del ícono. Los chips son los mismos `TONOS` de
 * CardKpi; el valor va en el texto de ese tono en vez de `text-ink`, porque
 * acá el número ya es la alerta.
 */
const TONO_ATENCION = {
  caliente: { chip: TONOS.caliente, valor: 'text-caliente' },
  tibio: { chip: TONOS.tibio, valor: 'text-badge-tibio-ink' },
} as const

/**
 * Misma anatomía que `CardKpi` —mismas clases de contenedor, label, chip,
 * valor y contexto— con dos diferencias que CardKpi no admite: el valor va en
 * el color del tono y el contexto lleva un link adentro. Por eso es una copia
 * y no CardKpi con props nuevas.
 */
function TarjetaAtencion({
  label,
  icono,
  tono,
  valor,
  contexto,
}: {
  label: string
  icono: ReactNode
  tono: keyof typeof TONO_ATENCION
  valor: string
  contexto: ReactNode
}) {
  const colores = TONO_ATENCION[tono]
  return (
    <article className="flex min-w-0 flex-col rounded-2xl border border-border bg-surface p-3.5 shadow-sm">
      <span className="block text-[0.78rem] font-semibold text-ink-3">{label}</span>
      <div className="mt-1.5 flex items-center gap-2.5">
        <span
          aria-hidden
          className={`grid size-7 shrink-0 place-items-center rounded-[10px] ${colores.chip}`}
        >
          {icono}
        </span>
        <span
          className={`min-w-0 truncate text-[1.4rem] leading-none font-bold tabular-nums ${colores.valor}`}
        >
          {valor}
        </span>
      </div>
      <div className="mt-1.5 text-[0.75rem] text-ink-3">{contexto}</div>
    </article>
  )
}

/**
 * Mismo orden y mismas grillas que la página, para que al cargar no salte
 * nada. "Requiere tu atención" se reserva con sus dos tarjetas, que es el caso
 * de todos los días; si al llegar los datos no hay ninguna, la página sube.
 */
function Skeleton() {
  const bloque = 'animate-pulse rounded-2xl bg-surface-2 motion-reduce:animate-none'

  return (
    <div aria-busy="true" aria-label="Cargando tus métricas" className="mx-auto max-w-[1120px]">
      <div className="mb-6">
        <div className="h-7 w-52 animate-pulse rounded bg-surface-2 motion-reduce:animate-none" />
        <div className="mt-2 h-4 w-44 animate-pulse rounded bg-surface-2 motion-reduce:animate-none" />
      </div>

      <div className="mb-6">
        <div className="mb-2 h-4 w-36 animate-pulse rounded bg-surface-2 motion-reduce:animate-none" />
        <div className="grid gap-3 md:grid-cols-2">
          {/* Medidas de CardKpi (106px). La del embudo baja a dos renglones de
              contexto en mobile, con el nombre de las etapas adentro. */}
          <div className={`h-[106px] ${bloque}`} />
          <div className={`h-[124px] md:h-[106px] ${bloque}`} />
        </div>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className={`h-[345px] lg:h-[230px] ${bloque}`} />
        ))}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className={`h-[110px] ${bloque}`} />
        ))}
      </div>

      <div className={`mb-6 h-[380px] ${bloque}`} />
      {/* El embudo son filas a todo el ancho: mide lo mismo en mobile y en desktop. */}
      <div className={`mb-6 h-[375px] ${bloque}`} />

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className={`h-[260px] ${bloque}`} />
        ))}
      </div>
    </div>
  )
}
