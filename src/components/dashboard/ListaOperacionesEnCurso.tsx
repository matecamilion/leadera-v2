import { Link } from 'react-router-dom'
import { BadgeEstadoOperacion } from '../operaciones/BadgeEstadoOperacion'
import { IconoCajas } from '../leads/Iconos'
import { useOperacionesEnCurso } from '../../hooks/useOperaciones'
import {
  etiquetaTipoOperacion,
  formatearMonto,
  type OperacionListada,
} from '../../lib/api/operaciones'

/** Cuántas filas entran en el resumen. El "Ver todas" aparece si hay más. */
const MOSTRADAS = 3

/**
 * Las operaciones que siguen vivas: publicadas, reservadas y en negociación.
 *
 * Misma anatomía que `ListaLeads`, y como `ListaPropiedadesRecientes` se trae
 * sus propios datos y se esconde si la query falla: es contexto de la jornada,
 * no la jornada.
 */
export function ListaOperacionesEnCurso() {
  const { data, isPending, isError } = useOperacionesEnCurso(MOSTRADAS)

  if (isError) return null
  if (isPending || !data) return <SkeletonSeccion />

  const operaciones = data.data
  const hayMas = data.count > operaciones.length

  return (
    <section className="mb-8">
      <header className="mb-3">
        <div className="flex flex-wrap items-center gap-2">
          <span
            aria-hidden
            className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-warm-soft text-badge-tibio-ink"
          >
            <IconoCajas className="size-[18px]" />
          </span>

          <h2 className="m-0 text-[1.05rem] font-bold text-ink">
            Operaciones en curso
          </h2>

          <span className="rounded-full bg-warm-soft px-2.5 py-0.5 text-[0.72rem] font-bold text-badge-tibio-ink">
            {operaciones.length} {operaciones.length === 1 ? 'abierta' : 'abiertas'}
          </span>

          {hayMas && (
            <Link
              to="/operaciones"
              className="ml-auto text-[0.82rem] font-semibold whitespace-nowrap text-primary hover:underline"
            >
              Ver todas ({data.count}) →
            </Link>
          )}
        </div>

        <p className="mt-1 text-[0.85rem] text-ink-3">
          Todavía no están cerradas ni canceladas
        </p>
      </header>

      {operaciones.length === 0 ? (
        <p className="rounded-[14px] border border-dashed border-border bg-surface-2 px-4 py-6 text-center text-[0.88rem] text-ink-3">
          No tenés operaciones abiertas.
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-[14px] border border-border bg-surface">
          {operaciones.map((operacion) => (
            <FilaOperacion key={operacion.id} operacion={operacion} />
          ))}
        </ul>
      )}
    </section>
  )
}

/** Una operación: de qué se trata a la izquierda, por cuánto y cómo va a la derecha. */
function FilaOperacion({ operacion }: { operacion: OperacionListada }) {
  const tipo = etiquetaTipoOperacion(operacion.tipo)
  // `titulo` es opcional en la tabla. Sin él, el tipo es lo único que la
  // describe, así que sube al renglón principal y no se repite abajo.
  const titulo = operacion.titulo?.trim() || tipo
  const contexto =
    operacion.lead
      ? `${tipo} · ${operacion.lead.nombre} ${operacion.lead.apellido ?? ''}`.trim()
      : (operacion.propiedad?.direccion ?? tipo)

  return (
    <li>
      <Link
        to={`/operaciones/${operacion.id}`}
        // El outline va hacia adentro: la `ul` recorta con `overflow-hidden` y
        // un offset positivo dejaría el foco de la primera fila invisible.
        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-ink">{titulo}</span>
          <span className="mt-0.5 block truncate text-[0.78rem] text-ink-3">
            {contexto}
          </span>
        </span>

        <span className="shrink-0 text-right">
          <span className="block text-[0.85rem] font-semibold whitespace-nowrap text-ink tabular-nums">
            {formatearMonto(operacion.monto, operacion.moneda)}
          </span>
          <span className="mt-1 block">
            <BadgeEstadoOperacion estado={operacion.estado} />
          </span>
        </span>
      </Link>
    </li>
  )
}

/**
 * Mismo idioma visual que el skeleton de Mi día: barra de título y un bloque
 * del alto que va a ocupar la lista, para que no salte al llegar los datos.
 */
function SkeletonSeccion() {
  return (
    <div aria-hidden className="mb-8">
      <div className="mb-3 h-8 w-56 animate-pulse rounded bg-surface-2 motion-reduce:animate-none" />
      <div className="h-[203px] animate-pulse rounded-[14px] bg-surface-2 motion-reduce:animate-none" />
    </div>
  )
}
