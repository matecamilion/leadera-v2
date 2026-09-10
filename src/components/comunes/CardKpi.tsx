import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { TONOS, type TonoKpi } from './tonos'

const CLASES = 'flex flex-col rounded-2xl border border-border bg-surface p-3.5 shadow-sm'

interface CardKpiProps {
  label: string
  /** Ya formateado: la card no sabe de unidades ni de '—'. */
  valor: string
  /** Línea chica debajo del número. */
  contexto?: string
  icono?: ReactNode
  tono?: TonoKpi
  /**
   * Si viene, la card entera es el link a esa ruta.
   *
   * Cambia el elemento raíz en vez de envolver la card en un `<a>`: envuelta,
   * dejaría de ser hija directa de la grilla y no se estiraría con las demás.
   */
  a?: string
}

/** Card de un número. El sparkline llega en la Fase 6b. */
export function CardKpi({ label, valor, contexto, icono, tono = 'brand', a }: CardKpiProps) {
  const contenido = (
    <>
      {/* El label toma el renglón entero: antes compartía la línea con el
          ícono, que le comía 32px justo cuando "Tasa de conversión" es el más
          largo de la grilla. */}
      <span className="block text-[0.78rem] font-semibold text-ink-3">{label}</span>

      {/* El ícono va pegado al número y no arriba a la derecha, donde era un
          adorno suelto en su propia esquina. En la misma línea los dos se leen
          como una unidad —qué se cuenta y cuánto—, y la card se ahorra el alto
          del chip, que era una fila entera para nada. */}
      <div className="mt-1.5 flex items-center gap-2.5">
        {icono && (
          <span
            aria-hidden
            className={`grid size-7 shrink-0 place-items-center rounded-[10px] ${TONOS[tono]}`}
          >
            {icono}
          </span>
        )}
        {/* `min-w-0` para que el `truncate` funcione: un ítem de flex no baja
            de su ancho de contenido sin eso, y un valor largo empujaría el
            número fuera de la card en vez de recortarse. */}
        <span className="min-w-0 truncate text-[1.4rem] leading-none font-bold text-ink tabular-nums">
          {valor}
        </span>
      </div>

      {contexto && <div className="mt-1.5 text-[0.75rem] text-ink-3">{contexto}</div>}
    </>
  )

  if (!a) return <article className={CLASES}>{contenido}</article>

  // El borde se oscurece en hover en vez de levantar la card: el resto de la
  // pantalla es plano y una card que flota rompería el conjunto.
  return (
    <Link
      to={a}
      className={`${CLASES} transition-colors hover:border-ink-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none`}
    >
      {contenido}
    </Link>
  )
}
