import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Link } from 'react-router-dom'
import {
  etiquetaEstadoOperacion,
  type EstadoOperacion,
  type LadoTablero,
  type OperacionKanban,
  type TipoOperacion,
  type TotalPorMoneda,
} from '../../lib/api/operaciones'
import { formatearTotal } from '../../lib/kanbanUtils'
import { IconoCajas } from '../leads/Iconos'
import { CardKanban } from './CardKanban'

/** Cuántas cards se muestran antes del "Ver todas". */
const VISIBLES = 5

/** Franja superior por estado, tomada del original. */
const FRANJA: Record<string, string> = {
  PUBLICADA: 'border-t-primary',
  RESERVADA: 'border-t-tibio',
  EN_NEGOCIACION: 'border-t-tibio',
  CERRADA_GANADA: 'border-t-primary-dark',
  CANCELADA: 'border-t-caliente',
}

/**
 * Totales de la columna por moneda, sumados sobre las cards que se pasan.
 *
 * Del lado de ofertas sólo se suma si todas son del mismo tipo: una venta y un
 * alquiler mensual no se suman. Devuelve null cuando no hay total que mostrar.
 */
function totalesPorMoneda(
  operaciones: OperacionKanban[],
  lado: LadoTablero,
): TotalPorMoneda[] | null {
  if (lado === 'ofertas' && new Set(operaciones.map((o) => o.tipo)).size > 1) return null

  const porMoneda = new Map<string, number>()
  for (const o of operaciones) {
    if (o.monto != null) porMoneda.set(o.moneda, (porMoneda.get(o.moneda) ?? 0) + o.monto)
  }
  return [...porMoneda]
    .map(([moneda, total]) => ({ moneda, total }))
    .sort((a, b) => b.total - a.total)
}

interface ColumnaKanbanProps {
  estado: EstadoOperacion
  lado: LadoTablero
  /** Tipo con el que se rotula el título de la columna. */
  tipoRepresentativo: TipoOperacion
  /**
   * Las cards del lado activo. En las columnas cerradas vienen recortadas por
   * `listarOperacionesKanban`, así que el contador de esas puede quedar corto.
   */
  operaciones: OperacionKanban[]
}

export function ColumnaKanban({
  estado,
  lado,
  tipoRepresentativo,
  operaciones,
}: ColumnaKanbanProps) {
  const total = operaciones.length
  const montos = totalesPorMoneda(operaciones, lado)
  const { setNodeRef, isOver } = useDroppable({ id: estado })
  const visibles = operaciones.slice(0, VISIBLES)

  return (
    <section
      // Ancho fijo + snap: en mobile las columnas se recorren de a una y el
      // drag táctil no pelea con el scroll de la página.
      className={`flex w-[85vw] shrink-0 snap-center flex-col rounded-lg border border-t-4 border-border bg-surface-2 p-3 md:w-auto md:min-w-0 md:snap-align-none ${FRANJA[estado] ?? 'border-t-border'}`}
    >
      <header className="border-b border-border px-1 pb-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="m-0 text-[0.9rem] font-bold tracking-[0.04em] text-ink-2 uppercase">
            {etiquetaEstadoOperacion(tipoRepresentativo, estado)}
          </h2>
          <span className="rounded-full bg-surface px-2.5 py-0.5 text-xs font-semibold text-ink-2">
            {total}
          </span>
        </div>

        {/* Un total por moneda: sumar USD con ARS daría un número sin sentido. */}
        {montos && (
          <div className="mt-1 flex flex-wrap gap-x-3 text-[0.78rem] font-bold text-ink tabular-nums">
            {montos.length > 0 ? (
              <>
                {lado === 'compradores' && (
                  <span className="font-normal text-ink-3">Presupuesto</span>
                )}
                {montos.map((t) => (
                  <span key={t.moneda}>{formatearTotal(t)}</span>
                ))}
              </>
            ) : (
              <span className="font-normal text-ink-4">Sin montos</span>
            )}
          </div>
        )}
      </header>

      <div
        ref={setNodeRef}
        className={`mt-3 flex min-h-[200px] flex-1 flex-col gap-2.5 rounded-md p-1 transition-colors motion-reduce:transition-none ${
          isOver ? 'bg-brand-soft ring-2 ring-primary ring-inset' : ''
        }`}
      >
        <SortableContext
          items={visibles.map((o) => o.id)}
          strategy={verticalListSortingStrategy}
        >
          {visibles.map((operacion) => (
            <CardKanban key={operacion.id} operacion={operacion} />
          ))}
        </SortableContext>

        {operaciones.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-6 text-center">
            <IconoCajas className="size-7 text-ink-4" />
            <p className="text-[0.82rem] text-ink-3">Sin operaciones acá</p>
            <p className="text-[0.75rem] text-ink-4">Arrastrá una card para moverla</p>
          </div>
        )}

        {/* "Hay más, llevame al listado completo". */}
        {total > VISIBLES && (
          <Link
            to={`/operaciones?estado=${estado}`}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-center text-[0.8rem] font-semibold text-primary transition-colors hover:bg-background motion-reduce:transition-none"
          >
            Ver todas ({total})
          </Link>
        )}
      </div>
    </section>
  )
}
