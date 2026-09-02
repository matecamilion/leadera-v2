import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Link } from 'react-router-dom'
import {
  etiquetaEstadoOperacion,
  type EstadoOperacion,
  type OperacionKanban,
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

interface ColumnaKanbanProps {
  estado: EstadoOperacion
  /**
   * Las filas que hay para mostrar. En las columnas cerradas vienen recortadas
   * por `listarOperacionesKanban`, así que pueden ser menos que `total`.
   */
  operaciones: OperacionKanban[]
  /** Total real de la columna, del RPC de conteo. Es el número del header. */
  total: number
  /**
   * Monto real de la columna por moneda, del RPC de sumas.
   *
   * Viene calculado sobre todas las operaciones del estado y no sobre
   * `operaciones`, que en las columnas cerradas está recortado: sumar acá daría
   * el monto de las 30 más recientes al lado de un contador que dice el total.
   */
  montos: TotalPorMoneda[]
}

export function ColumnaKanban({
  estado,
  operaciones,
  total,
  montos,
}: ColumnaKanbanProps) {
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
            {etiquetaEstadoOperacion(estado)}
          </h2>
          {/* El total real, del RPC: en las columnas cerradas es mayor que la
              cantidad de filas que se trajeron. */}
          <span className="rounded-full bg-surface px-2.5 py-0.5 text-xs font-semibold text-ink-2">
            {total}
          </span>
        </div>

        {/* Un total por moneda: sumar USD con ARS daría un número sin sentido. */}
        <div className="mt-1 flex flex-wrap gap-x-3 text-[0.78rem] font-bold text-ink tabular-nums">
          {montos.length > 0 ? (
            montos.map((t) => <span key={t.moneda}>{formatearTotal(t)}</span>)
          ) : (
            <span className="font-normal text-ink-4">Sin montos</span>
          )}
        </div>
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

        {/* Un solo link para los dos recortes —el de las 5 visibles y el de
            las filas que ni se trajeron— porque para el usuario son lo mismo:
            "hay más, llevame al listado completo". Con el total del RPC el
            número es exacto en ambos casos. */}
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
