import { useResumenSemanaGestion } from '../../hooks/useModeloGestion'
import { desdeClaveDia } from '../../lib/calendario'
import { IconoCheck } from '../leads/Iconos'
import { SeccionCard } from './SeccionCard'

/** Las metas de la semana. Fijas por ahora; más adelante, configurables. */
export const METAS_SEMANALES = { verdes: 15, nuevosContactos: 1 } as const

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

/** `YYYY-MM-DD` → "mié 24/09". Parseo local: con `new Date(clave)` sería UTC y
 *  en Argentina caería en el día anterior. */
function etiquetaDia(clave: string): string {
  const fecha = desdeClaveDia(clave)
  const dd = String(fecha.getDate()).padStart(2, '0')
  const mm = String(fecha.getMonth() + 1).padStart(2, '0')
  return `${DIAS[fecha.getDay()]} ${dd}/${mm}`
}

/**
 * La semana del modelo de gestión en Mi día: actividades verdes y nuevos
 * contactos contra sus metas.
 *
 * Sólo se monta con el flag prendido, así que la query arranca habilitada.
 */
export function TarjetaSemanaGestion() {
  const { data, isPending, isError } = useResumenSemanaGestion(true)

  if (isPending) return <Skeleton />

  if (isError || !data) {
    return (
      <SeccionCard
        icono={<IconoCheck className="size-4" />}
        tono="brand"
        titulo="Tu semana"
        subtitulo="Actividades verdes y nuevos contactos"
      >
        <p
          role="alert"
          className="mt-2 rounded-lg border border-peligro-borde bg-peligro-soft px-3 py-2 text-[0.8rem] text-peligro-ink"
        >
          No pudimos cargar el resumen de tu semana.
        </p>
      </SeccionCard>
    )
  }

  return (
    <SeccionCard
      icono={<IconoCheck className="size-4" />}
      tono="brand"
      titulo="Tu semana"
      subtitulo={`${etiquetaDia(data.semana_inicio)} → ${etiquetaDia(data.semana_fin)}`}
    >
      <div className="mt-2 space-y-3">
        <FilaProgreso
          etiqueta="Actividades verdes"
          valor={data.verdes}
          meta={METAS_SEMANALES.verdes}
        />
        <FilaProgreso
          etiqueta="Nuevos contactos"
          valor={data.nuevos_contactos}
          meta={METAS_SEMANALES.nuevosContactos}
        />
      </div>
    </SeccionCard>
  )
}

/**
 * Una meta con su barra. Mismo idioma visual que `IndicadorCupo`: `h-2`,
 * fondo `surface-2` y la transición de ancho.
 *
 * La barra se topea en 100% pero el número muestra el valor real: pasarse de
 * la meta es un dato, no un error de dibujo.
 */
function FilaProgreso({ etiqueta, valor, meta }: { etiqueta: string; valor: number; meta: number }) {
  const cumplida = valor >= meta
  const ancho = Math.min((valor / Math.max(meta, 1)) * 100, 100)

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-[0.85rem] text-ink-2">{etiqueta}</span>
        <span className="text-[0.85rem] tabular-nums">
          <b className="text-ink">{valor}</b>
          <span className="text-ink-3">/{meta}</span>
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={valor}
        aria-valuemin={0}
        aria-valuemax={meta}
        aria-label={etiqueta}
        className="h-2 overflow-hidden rounded-full bg-surface-2"
      >
        <span
          className={`block h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none ${cumplida ? 'bg-primary-dark' : 'bg-primary'}`}
          style={{ width: `${ancho}%` }}
        />
      </div>
    </div>
  )
}

/** Mismo skeleton que las secciones de Mi día: barra de título y bloque. */
function Skeleton() {
  return (
    <div aria-hidden className="mb-4">
      <div className="mb-3 h-8 w-56 animate-pulse rounded bg-surface-2 motion-reduce:animate-none" />
      <div className="h-[104px] animate-pulse rounded-2xl bg-surface-2 motion-reduce:animate-none" />
    </div>
  )
}
