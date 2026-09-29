import { useEmbudo } from '../../hooks/useEmbudo'
import type { Embudo as DatosEmbudo } from '../../lib/api/perfil'

export interface Etapa {
  num: string
  nombre: string
  valor: number
  /** Ancho de la barra, 0-100. */
  ancho: number
  porc: number
}

/**
 * Las 5 etapas con su ancho relativo.
 *
 * La base es "contactados": el embudo mide qué pasa DESPUÉS del primer
 * contacto, así que esa etapa es el 100% y el resto se lee contra ella. El
 * `Math.max(base, 1)` evita dividir por cero cuando todavía no contactaste a
 * nadie.
 */
export function calcularEtapas(datos: DatosEmbudo): Etapa[] {
  const base = Math.max(datos.contactados, 1)
  const crudas = [
    { num: '01', nombre: 'Contactados', valor: datos.contactados },
    { num: '02', nombre: 'Calificados', valor: datos.calificados },
    { num: '03', nombre: 'Visita agendada', valor: datos.visita },
    { num: '04', nombre: 'Oferta', valor: datos.oferta },
    { num: '05', nombre: 'Cerrado', valor: datos.cerrado },
  ]

  return crudas.map((e) => ({
    ...e,
    ancho: Math.min(100, (e.valor / base) * 100),
    porc: Math.round((e.valor / base) * 100),
  }))
}

export interface Insight {
  desde: string
  hasta: string
  porc: number
}

/**
 * El escalón donde más gente se cae, en porcentaje sobre la etapa anterior.
 *
 * Se mide la caída relativa y no la absoluta: perder 3 de 4 duele más que
 * perder 5 de 100. Ante un empate gana el escalón más temprano, que es donde
 * arreglarlo rinde más.
 */
export function calcularInsight(etapas: Etapa[]): Insight | null {
  let peorIndice = 1
  let peorCaida = -1

  for (let i = 1; i < etapas.length; i++) {
    const anterior = etapas[i - 1].valor
    const actual = etapas[i].valor
    if (anterior === 0) continue
    const caida = (anterior - actual) / anterior
    if (caida > peorCaida) {
      peorCaida = caida
      peorIndice = i
    }
  }

  if (peorCaida <= 0) return null
  return {
    desde: etapas[peorIndice - 1].nombre,
    hasta: etapas[peorIndice].nombre,
    porc: Math.round(peorCaida * 100),
  }
}

/**
 * El paso que marca `calcularInsight`, con sus cantidades absolutas: cuántos
 * había en la etapa anterior y cuántos se perdieron en el camino.
 *
 * El insight identifica el paso por nombre (son únicos entre las cinco etapas)
 * y da la caída en porcentaje; esto sólo la traduce a personas, sin volver a
 * decidir cuál es el peor.
 */
export function pasoDelInsight(
  etapas: Etapa[],
  insight: Insight | null,
): { indice: number; anterior: number; perdidos: number } | null {
  if (!insight) return null
  const indice = etapas.findIndex((e) => e.nombre === insight.hasta)
  if (indice < 1) return null
  const anterior = etapas[indice - 1].valor
  return { indice, anterior, perdidos: anterior - etapas[indice].valor }
}

export function Embudo() {
  const { data, isPending, isError, error } = useEmbudo()

  if (isPending) return <Skeleton />

  if (isError) {
    return (
      <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <p
          role="alert"
          className="rounded-lg border border-peligro-borde bg-peligro-soft px-4 py-3 text-[0.9rem] text-peligro-ink"
        >
          {error instanceof Error ? error.message : 'No pudimos cargar tu embudo.'}
        </p>
      </section>
    )
  }

  // El aviso del peor escalón (`calcularInsight`) ya no va acá: lo muestra
  // Estadísticas arriba de todo, que es donde se lee antes de bajar al detalle.
  // Acá se reusa sólo para saber qué paso pintar en ámbar.
  const etapas = calcularEtapas(data)
  const peor = pasoDelInsight(etapas, calcularInsight(etapas))
  // Base de las barras: la primera etapa. `Math.max` por si acaso, aunque con
  // 0 contactados esta rama no se dibuja.
  const base = Math.max(etapas[0].valor, 1)

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <header className="mb-4">
        <h2 className="m-0 text-[0.95rem] font-bold text-ink">Embudo de conversión</h2>
        <p className="mt-0.5 text-[0.8rem] text-ink-3">Del primer contacto al cierre</p>
      </header>

      {data.contactados === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-surface-2 px-4 py-6 text-center text-[0.85rem] text-ink-3">
          Todavía no contactaste a ningún lead.
        </p>
      ) : (
        // Mismas filas que "Origen de tus leads": nombre y cantidad arriba,
        // riel con la barra abajo. Entre fila y fila va siempre el mismo hueco,
        // con o sin marca de caída, para que el ritmo vertical no salte.
        <ol className="flex flex-col">
          {etapas.map((e, i) => {
            const anterior = etapas[i - 1]
            const esPeor = peor?.indice === i
            // Piso de 2%, igual que Orígenes: una etapa con 1 sobre 100 no
            // puede quedar sin barra si el número dice que existe.
            const ancho = e.valor === 0 ? 0 : Math.min(Math.max((e.valor / base) * 100, 2), 100)
            return (
              <li key={e.num}>
                {anterior && (
                  <Caida
                    desde={anterior.nombre}
                    hasta={e.nombre}
                    perdidos={anterior.valor - e.valor}
                    peor={esPeor}
                  />
                )}
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <span className="truncate text-[0.85rem] text-ink-2">{e.nombre}</span>
                  <span className="shrink-0 text-[0.8rem] font-semibold text-ink tabular-nums">
                    {e.valor}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                  <span
                    className={`block h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none ${
                      esPeor ? 'bg-tibio' : 'bg-primary'
                    }`}
                    style={{ width: `${ancho}%` }}
                  />
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

/**
 * El hueco entre dos filas. Si hubo caída, una marca chica "↓ −N" en ámbar;
 * la del peor paso, además, en píldora. Si no la hubo, el hueco queda vacío a
 * la vista pero dice igual qué pasó para quien usa lector de pantalla.
 */
function Caida({
  desde,
  hasta,
  perdidos,
  peor,
}: {
  desde: string
  hasta: string
  perdidos: number
  peor: boolean
}) {
  const hayCaida = perdidos > 0
  return (
    <div className="flex h-7 items-center">
      <span className="sr-only">
        De {desde} a {hasta}:{' '}
        {hayCaida
          ? `se ${perdidos === 1 ? 'pierde' : 'pierden'} ${perdidos}${peor ? ', el paso donde más gente se cae' : ''}.`
          : 'no se pierde nadie.'}
      </span>
      {hayCaida && (
        <span
          aria-hidden
          className={[
            'inline-flex items-center gap-1 text-[0.72rem] text-badge-tibio-ink tabular-nums',
            peor ? 'rounded-full bg-warm-soft px-2 py-0.5 font-bold' : 'font-semibold',
          ].join(' ')}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-3"
          >
            <path d="M12 5v14M6 13l6 6 6-6" />
          </svg>
          −{perdidos}
        </span>
      )}
    </div>
  )
}

function Skeleton() {
  return (
    <section
      aria-busy="true"
      aria-label="Cargando tu embudo"
      className="rounded-2xl border border-border bg-surface p-5 shadow-sm"
    >
      <div className="mb-4 h-5 w-48 animate-pulse rounded bg-surface-2 motion-reduce:animate-none" />
      <div className="flex flex-col gap-2.5">
        {Array.from({ length: 5 }, (_, i) => (
          <div
            key={i}
            className="h-6 animate-pulse rounded bg-surface-2 motion-reduce:animate-none"
          />
        ))}
      </div>
    </section>
  )
}
