import { useEmbudo } from '../../hooks/useEmbudo'
import type { Embudo as DatosEmbudo } from '../../lib/api/perfil'

interface Etapa {
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
function calcularEtapas(datos: DatosEmbudo): Etapa[] {
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

interface Insight {
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
function calcularInsight(etapas: Etapa[]): Insight | null {
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

  const etapas = calcularEtapas(data)
  const insight = calcularInsight(etapas)

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
        <>
          <ul className="flex flex-col gap-2.5">
            {etapas.map((e) => (
              <li key={e.num} className="flex items-center gap-2 sm:gap-3">
                <span className="w-5 shrink-0 text-[0.7rem] font-bold text-ink-4 tabular-nums">
                  {e.num}
                </span>
                <span className="w-[6.5rem] shrink-0 truncate text-[0.82rem] text-ink-2 sm:w-32">
                  {e.nombre}
                </span>
                <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <span
                    className="block h-full rounded-full bg-primary transition-[width] duration-500 motion-reduce:transition-none"
                    style={{ width: `${e.ancho}%` }}
                  />
                </div>
                <span className="w-6 shrink-0 text-right text-[0.85rem] font-bold text-ink tabular-nums">
                  {e.valor}
                </span>
                <span className="w-10 shrink-0 text-right text-[0.78rem] text-ink-3 tabular-nums">
                  {e.porc}%
                </span>
              </li>
            ))}
          </ul>

          {insight && (
            <p className="mt-4 rounded-xl bg-warm-soft px-3.5 py-2.5 text-[0.82rem] text-badge-tibio-ink">
              Se te cae más gente entre <b>{insight.desde}</b> y <b>{insight.hasta}</b>:{' '}
              <b>-{insight.porc}%</b>. Es el escalón donde más rinde poner esfuerzo.
            </p>
          )}
        </>
      )}
    </section>
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
