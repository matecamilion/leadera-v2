import { useMemo } from 'react'
import {
  closestCorners,
  DndContext,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
} from '@dnd-kit/core'
import { Link } from 'react-router-dom'
import { AlternadorVista } from '../components/operaciones/AlternadorVista'
import { ColumnaKanban } from '../components/operaciones/ColumnaKanban'
import { useKanbanOperaciones, useMoverOperacion } from '../hooks/useKanbanOperaciones'
import { ESTADOS_OPERACION, type EstadoOperacion } from '../lib/api/operaciones'

/** Las 5 columnas del tablero, en orden fijo. */
const COLUMNAS: EstadoOperacion[] = ESTADOS_OPERACION.map((e) => e.valor)

/**
 * La detección por defecto (`rectIntersection`) elige la columna por cuánto se
 * superpone el rectángulo de la card, no por dónde está el cursor. Soltando
 * sobre el borde entre dos columnas el resultado se vuelve impredecible: la
 * misma soltada cae a veces en una y a veces en la otra.
 *
 * Acá manda el cursor. Si quedó sobre una columna, esa es; si quedó en el
 * espacio entre columnas, `closestCorners` resuelve por la más cercana en vez
 * de descartar la soltada.
 */
const detectarColision: CollisionDetection = (args) => {
  const bajoElCursor = pointerWithin(args)
  return bajoElCursor.length > 0 ? bajoElCursor : closestCorners(args)
}

export default function KanbanOperaciones() {
  const { data, isPending, isError, error } = useKanbanOperaciones()
  const mover = useMoverOperacion()

  // 8px de umbral: sin esto, un click en "Ver detalle" se interpreta como
  // el arranque de un drag y el link nunca navega.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )

  const operaciones = useMemo(() => data?.operaciones ?? [], [data])
  const totales = data?.totales
  const montos = data?.montos

  const porColumna = useMemo(() => {
    const mapa = new Map<EstadoOperacion, typeof operaciones>()
    for (const estado of COLUMNAS) mapa.set(estado, [])
    for (const op of operaciones) {
      // `COLUMNAS` sale de ESTADOS_OPERACION, que cubre el enum entero: toda
      // operación tiene su columna. El `?.` es por las dudas —una fila con un
      // estado que el front todavía no conoce se saltea en vez de romper el
      // tablero—, no por un caso previsto.
      mapa.get(op.estado)?.push(op)
    }
    return mapa
  }, [operaciones])

  function alSoltar(evento: DragEndEvent) {
    const { active, over } = evento
    if (!over) return

    const operacion = operaciones.find((o) => o.id === active.id)
    if (!operacion) return

    // `over` puede ser la columna o una card de adentro: si es una card,
    // el destino es la columna a la que esa card pertenece.
    const destino = COLUMNAS.includes(over.id as EstadoOperacion)
      ? (over.id as EstadoOperacion)
      : operaciones.find((o) => o.id === over.id)?.estado

    if (!destino || destino === operacion.estado) return

    // Sin restricción de transiciones: cualquier estado a cualquier estado.
    mover.mutate({ id: operacion.id, estado: destino })
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-xs leading-tight font-bold tracking-[0.05em] text-primary uppercase">
            Operaciones
          </p>
          <h1 className="m-0 text-[1.6rem] font-bold text-ink">Tablero</h1>
          <p className="mt-1 text-[0.92rem] text-ink-3">
            Arrastrá una operación para cambiarle el estado.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <AlternadorVista actual="tablero" />
          <Link
            to="/operaciones/nueva"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-[0.9rem] font-semibold whitespace-nowrap text-white transition-colors hover:bg-primary-dark motion-reduce:transition-none"
          >
            + Nueva Operación
          </Link>
        </div>
      </header>

      {mover.isError && (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-peligro-borde bg-peligro-soft px-4 py-3 text-[0.9rem] text-peligro-ink"
        >
          {mover.error instanceof Error
            ? `${mover.error.message} La operación volvió a su columna.`
            : 'No se pudo mover la operación. Volvió a su columna.'}
        </p>
      )}

      {isPending ? (
        <Skeleton />
      ) : isError ? (
        <p
          role="alert"
          className="rounded-lg border border-peligro-borde bg-peligro-soft px-4 py-3 text-[0.9rem] text-peligro-ink"
        >
          {error instanceof Error ? error.message : 'No pudimos cargar el tablero.'}
        </p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={detectarColision}
          onDragEnd={alSoltar}
        >
          <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 md:mx-0 md:grid md:grid-cols-5 md:overflow-visible md:px-0">
            {COLUMNAS.map((estado) => (
              <ColumnaKanban
                key={estado}
                estado={estado}
                operaciones={porColumna.get(estado) ?? []}
                total={totales?.[estado] ?? 0}
                montos={montos?.[estado] ?? []}
              />
            ))}
          </div>
        </DndContext>
      )}
    </div>
  )
}

function Skeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Cargando el tablero"
      className="-mx-4 flex gap-4 overflow-hidden px-4 md:mx-0 md:grid md:grid-cols-5 md:px-0"
    >
      {Array.from({ length: 5 }, (_, columna) => (
        <div
          key={columna}
          className="flex w-[85vw] shrink-0 flex-col gap-2.5 rounded-lg border border-border bg-surface-2 p-3 md:w-auto"
        >
          <div className="h-8 animate-pulse rounded bg-surface motion-reduce:animate-none" />
          {Array.from({ length: 3 }, (_, card) => (
            <div
              key={card}
              className="h-28 animate-pulse rounded-xl bg-surface motion-reduce:animate-none"
            />
          ))}
        </div>
      ))}
    </div>
  )
}
