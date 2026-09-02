import { useCallback, useMemo, useRef, useState } from 'react'
import { useEvolucion } from '../../hooks/useEvolucion'
import {
  agruparPorPeriodo,
  calcularEscalaY,
  etiquetasEjeX,
  EVOL_ANCHO,
  EVOL_BASELINE,
  EVOL_PAD_IZQ,
  EVOL_TOP,
  etiquetaRangoGrupo,
  generarPathLinea,
  indiceMasCercano,
  PERIODOS,
  puntosDeSerie,
  type GrupoEvolucion,
  type PeriodoEvolucion,
  type SerieEvolucion,
} from '../../lib/graficoUtils'

/**
 * Color y grosor de cada serie. Se pintan en este orden.
 *
 * El original usaba brand y brand-deep para nuevos y ganados, pero son dos
 * verdes casi iguales y encimados no se distinguen. Acá van tres tonos
 * separados, y de paso el verde de marca queda en "ganados", que es lo que
 * uno espera que esté en verde.
 */
const SERIES: {
  clave: SerieEvolucion
  label: string
  trazo: string
  punto: string
  relleno?: string
  grosor: number
  guiones?: string
}[] = [
  {
    clave: 'nuevos',
    label: 'Nuevos',
    trazo: 'var(--color-frio)',
    punto: 'bg-frio',
    relleno: 'var(--color-cool-soft)',
    grosor: 2.5,
  },
  {
    clave: 'ganados',
    label: 'Ganados',
    trazo: 'var(--color-primary)',
    punto: 'bg-primary',
    grosor: 2,
  },
  {
    clave: 'perdidos',
    label: 'Perdidos',
    trazo: 'var(--color-ink-4)',
    punto: 'bg-ink-4',
    grosor: 2,
    guiones: '3 3',
  },
]

/** `y` del viewBox para un valor del eje. Con la altura fija en 220 es px. */
function alturaTick(valor: number, max: number): number {
  return EVOL_BASELINE - (valor / max) * (EVOL_BASELINE - EVOL_TOP)
}

/** Ancho fijo del tooltip, en px. Sirve para acotarlo contra los bordes. */
const ANCHO_TOOLTIP = 152
/** Separación entre el punto y la caja. */
const SEPARACION_TOOLTIP = 12
/** Padding izquierdo del contenedor (`pl-7`), donde van las etiquetas del eje Y. */
const PAD_IZQ_PX = 28

export function GraficoEvolucion() {
  const [periodo, setPeriodo] = useState<PeriodoEvolucion>('30d')
  const { data, isPending, isError, error } = useEvolucion(periodo)

  /**
   * Grupo sobre el que está el cursor. `null` = tooltip oculto. Se llama
   * `indiceActivo` y no `activo` porque los tabs de período ya usan ese
   * nombre para "este tab está seleccionado".
   */
  const [indiceActivo, setIndiceActivo] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)

  function cambiarPeriodo(nuevo: PeriodoEvolucion) {
    // Cada período tiene otra cantidad de grupos: un índice viejo apuntaría a
    // un punto que ya no existe.
    setIndiceActivo(null)
    setPeriodo(nuevo)
  }

  const dias = useMemo(() => data ?? [], [data])

  const grafico = useMemo(() => {
    if (dias.length === 0) return null

    const grupos = agruparPorPeriodo(dias, periodo)
    const escala = calcularEscalaY(grupos)

    const series = SERIES.map((s) => {
      const puntos = puntosDeSerie(grupos, s.clave, escala.max)
      const ultimo = puntos[puntos.length - 1]
      return {
        ...s,
        puntos,
        d: generarPathLinea(puntos, false),
        area: s.clave === 'nuevos' ? generarPathLinea(puntos, true) : null,
        ultimo,
        valorUltimo: grupos[grupos.length - 1][s.clave],
        total: dias.reduce((suma, dia) => suma + dia[s.clave], 0),
      }
    })

    // Los x son los mismos para las 3 series, así que se calculan una vez.
    const puntosX = series[0].puntos.map((p) => p.x)

    return { grupos, escala, series, puntosX, etiquetas: etiquetasEjeX(dias, periodo) }
  }, [dias, periodo])

  const vacio = grafico != null && grafico.series.every((s) => s.total === 0)

  /**
   * Traduce la posición del mouse al índice del grupo más cercano.
   *
   * El SVG va con `preserveAspectRatio="none"`, así que el ancho en pantalla y
   * el del viewBox no coinciden: hay que llevar el `clientX` a coordenadas del
   * viewBox antes de comparar contra los x de los puntos.
   */
  const seguirCursor = useCallback(
    (evento: { clientX: number }) => {
      const svg = svgRef.current
      if (!svg || !grafico) return
      const caja = svg.getBoundingClientRect()
      if (caja.width === 0) return

      const xViewBox = ((evento.clientX - caja.left) / caja.width) * EVOL_ANCHO
      setIndiceActivo(indiceMasCercano(xViewBox, grafico.puntosX))
    },
    [grafico],
  )

  // Un índice que quedó fuera de rango (datos nuevos, menos grupos) no debe
  // llegar a pintarse.
  const indiceValido =
    indiceActivo != null &&
    grafico != null &&
    indiceActivo >= 0 &&
    indiceActivo < grafico.grupos.length
      ? indiceActivo
      : null

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="m-0 text-[0.95rem] font-bold text-ink">Evolución de leads</h2>
          <p className="mt-0.5 text-[0.8rem] text-ink-3">
            {periodo === 'ano' ? 'Últimos 365 días' : `Últimos ${dias.length || '—'} días`}
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Período"
          className="flex shrink-0 rounded-lg border border-border bg-surface-2 p-0.5"
        >
          {PERIODOS.map((p) => {
            const activo = p.valor === periodo
            return (
              <button
                key={p.valor}
                type="button"
                role="tab"
                aria-selected={activo}
                onClick={() => cambiarPeriodo(p.valor)}
                className={[
                  'rounded-md px-2.5 py-1 text-[0.78rem] font-semibold transition-colors motion-reduce:transition-none',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                  activo ? 'bg-primary text-white' : 'text-ink-2 hover:bg-surface',
                ].join(' ')}
              >
                {p.label}
              </button>
            )
          })}
        </div>
      </header>

      {isError ? (
        <p
          role="alert"
          className="rounded-lg border border-peligro-borde bg-peligro-soft px-4 py-3 text-[0.9rem] text-peligro-ink"
        >
          {error instanceof Error ? error.message : 'No pudimos cargar tu evolución.'}
        </p>
      ) : isPending || !grafico ? (
        <Skeleton />
      ) : (
        <>
          <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5">
            {grafico.series.map((s) => (
              <li key={s.clave} className="flex items-center gap-1.5 text-[0.8rem] text-ink-2">
                <span aria-hidden className={`size-2.5 shrink-0 rounded-full ${s.punto}`} />
                {s.label} <b className="text-ink tabular-nums">{s.total}</b>
              </li>
            ))}
          </ul>

          {vacio ? (
            <p className="rounded-xl border border-dashed border-border bg-surface-2 px-4 py-10 text-center text-[0.85rem] text-ink-3">
              Sin actividad en este período.
            </p>
          ) : (
            <>
            {/* pl-7: columna para las etiquetas del eje Y, que van en HTML.
                Dentro del SVG se deformarían, porque preserveAspectRatio="none"
                lo estira sólo a lo ancho y a poco ancho el texto se aplasta. */}
            <div className="relative pl-7">
              {/* La altura del SVG es exactamente la del viewBox, así que una
                  unidad de `y` es un píxel y el `top` sale directo. */}
              {grafico.escala.ticks.map((valor) => (
                <span
                  key={valor}
                  aria-hidden
                  className="absolute left-0 w-6 -translate-y-1/2 text-right text-[0.65rem] text-ink-4 tabular-nums"
                  style={{ top: `${alturaTick(valor, grafico.escala.max)}px` }}
                >
                  {valor}
                </span>
              ))}

              <svg
                viewBox={`0 0 ${EVOL_ANCHO} 220`}
                preserveAspectRatio="none"
                ref={svgRef}
                role="img"
                aria-label={`Evolución de nuevos, ganados y perdidos en los últimos ${dias.length} días`}
                className="h-[220px] w-full"
              >
                {grafico.escala.ticks.map((valor) => (
                  <line
                    key={valor}
                    x1={0}
                    y1={alturaTick(valor, grafico.escala.max)}
                    x2={EVOL_ANCHO}
                    y2={alturaTick(valor, grafico.escala.max)}
                    className="stroke-border"
                    strokeWidth="1"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}

                {/* Área sólo bajo "nuevos", igual que el original. */}
                {grafico.series.map(
                  (s) =>
                    s.area && (
                      <path
                        key={`${s.clave}-area`}
                        d={s.area}
                        fill={s.relleno}
                        opacity="0.6"
                      />
                    ),
                )}

                {grafico.series.map((s) => (
                  <path
                    key={s.clave}
                    d={s.d}
                    fill="none"
                    stroke={s.trazo}
                    strokeWidth={s.grosor}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={s.guiones}
                    vectorEffect="non-scaling-stroke"
                  />
                ))}

                {/* Círculo que remata cada serie en su último punto. */}
                {grafico.series.map((s) =>
                  s.ultimo ? (
                    <circle
                      key={`${s.clave}-fin`}
                      cx={s.ultimo.x}
                      cy={s.ultimo.y}
                      r="4"
                      fill={s.trazo}
                    />
                  ) : null,
                )}

                {indiceValido != null && (
                  <g pointerEvents="none">
                    {/* Guía vertical del alto del área dibujable. */}
                    <line
                      x1={grafico.puntosX[indiceValido]}
                      y1={EVOL_TOP}
                      x2={grafico.puntosX[indiceValido]}
                      y2={EVOL_BASELINE}
                      className="stroke-ink-4"
                      strokeWidth="1"
                      strokeDasharray="4 3"
                      vectorEffect="non-scaling-stroke"
                    />
                    {/* Un punto por serie, con anillo blanco para que se
                        despegue de la línea que tiene debajo. */}
                    {grafico.series.map((s) => (
                      <circle
                        key={`${s.clave}-activo`}
                        cx={s.puntos[indiceValido].x}
                        cy={s.puntos[indiceValido].y}
                        r="4.5"
                        fill={s.trazo}
                        stroke="var(--color-surface)"
                        strokeWidth="2"
                      />
                    ))}
                  </g>
                )}

                {/* Captador. Va último para quedar por encima de todo, y con
                    `fill="transparent"`: con `fill="none"` no recibiría el
                    mouse. El onClick cubre el tap en pantallas táctiles. */}
                <rect
                  x={0}
                  y={0}
                  width={EVOL_ANCHO}
                  height={220}
                  fill="transparent"
                  onMouseMove={seguirCursor}
                  onMouseLeave={() => setIndiceActivo(null)}
                  onClick={seguirCursor}
                />
              </svg>

              {indiceValido != null && (
                <Tooltip
                  grupo={grafico.grupos[indiceValido]}
                  series={grafico.series.map((s) => ({
                    clave: s.clave,
                    label: s.label,
                    punto: s.punto,
                    valor: grafico.grupos[indiceValido][s.clave],
                  }))}
                  xViewBox={grafico.puntosX[indiceValido]}
                />
              )}

              <div
                className="mt-1 flex justify-between text-[0.72rem] text-ink-4"
                style={{ paddingLeft: `${(EVOL_PAD_IZQ / EVOL_ANCHO) * 100}%` }}
              >
                {grafico.etiquetas.map((etiqueta, i) => (
                  <span key={`${etiqueta}-${i}`}>{etiqueta}</span>
                ))}
                <span className="font-semibold text-ink-3">Hoy</span>
              </div>
            </div>

              {/* Valor del último punto de cada línea. Va en HTML y no como
                  <text> del SVG porque con preserveAspectRatio="none" el texto
                  se estiraría; y como fila aparte y no pegado a cada círculo
                  porque dos series que terminan en el mismo valor se pisarían. */}
              <p className="mt-3 border-t border-border pt-2.5 text-[0.75rem] text-ink-3">
                {/* "Último tramo" y no "hoy": salvo en 7d cada punto acumula
                    varios días, así que el final no es un día suelto. */}
                Último tramo:{' '}
                {grafico.series.map((s, i) => (
                  <span key={s.clave}>
                    {i > 0 && ' · '}
                    {s.label} <b className="text-ink tabular-nums">{s.valorUltimo}</b>
                  </span>
                ))}
              </p>
            </>
          )}
        </>
      )}
    </section>
  )
}

function Skeleton() {
  return (
    <div aria-busy="true" aria-label="Cargando la evolución">
      <div className="mb-3 h-4 w-56 animate-pulse rounded bg-surface-2 motion-reduce:animate-none" />
      <div className="h-[220px] animate-pulse rounded-xl bg-surface-2 motion-reduce:animate-none" />
    </div>
  )
}

interface FilaTooltip {
  clave: SerieEvolucion
  label: string
  /** Clase Tailwind del punto de color, la misma que usa la leyenda. */
  punto: string
  valor: number
}

/**
 * Caja flotante con los valores del punto que está bajo el cursor.
 *
 * Va en HTML y no como `<text>` del SVG por dos razones: con
 * `preserveAspectRatio="none"` el texto del SVG se estira sólo a lo ancho, y
 * una caja con sombra y esquinas redondeadas se arma en dos líneas de CSS.
 *
 * `pointer-events-none` es lo que evita que se pise a sí misma: sin eso, al
 * quedar la caja debajo del cursor el `<rect>` dejaría de recibir el mouse y
 * el tooltip parpadearía.
 */
function Tooltip({
  grupo,
  series,
  xViewBox,
}: {
  grupo: GrupoEvolucion
  series: FilaTooltip[]
  xViewBox: number
}) {
  // El SVG ocupa el 100% del ancho disponible menos el padding de las
  // etiquetas del eje Y, así que la posición se expresa en porcentaje de esa
  // franja y el navegador hace la cuenta con el ancho real.
  const porcentaje = (xViewBox / EVOL_ANCHO) * 100

  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute top-2 z-20 w-[152px]"
      style={{
        // El SVG ocupa `100% - PAD_IZQ_PX`, arrancando a PAD_IZQ_PX del borde.
        // El `clamp` lo mantiene dentro del contenedor sin medir nada en JS:
        // pegado al punto mientras entre, y frenado contra el borde si no.
        left: `clamp(
          0px,
          calc((100% - ${PAD_IZQ_PX}px) * ${porcentaje / 100} + ${PAD_IZQ_PX + SEPARACION_TOOLTIP}px),
          calc(100% - ${ANCHO_TOOLTIP}px)
        )`,
      }}
    >
      <div className="rounded-xl border border-border bg-surface px-3 py-2.5 shadow-modal">
        <p className="m-0 mb-1.5 text-[0.72rem] font-bold text-ink">
          {etiquetaRangoGrupo(grupo)}
        </p>
        <ul className="flex flex-col gap-1">
          {series.map((s) => (
            <li
              key={s.clave}
              className="flex items-center gap-1.5 text-[0.72rem] text-ink-2"
            >
              <span aria-hidden className={`size-2 shrink-0 rounded-full ${s.punto}`} />
              <span className="flex-1">{s.label}</span>
              <b className="text-ink tabular-nums">{s.valor}</b>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
