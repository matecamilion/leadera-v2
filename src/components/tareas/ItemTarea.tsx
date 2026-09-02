import { IconoTacho } from '../leads/Iconos'
import type { Tarea } from '../../types/database'

interface ItemTareaProps {
  tarea: Tarea
  /** Id del usuario logueado: decide qué acciones se ofrecen. */
  miId: string
  cambiando: boolean
  eliminando: boolean
  onAlternarCompletada: (tarea: Tarea) => void
  onEliminar: (tarea: Tarea) => void
}

/**
 * Una tarea del día.
 *
 * Completar sólo lo ve el asignado y eliminar sólo quien la creó. RLS rechaza
 * lo demás igual, pero un botón que siempre falla es peor que no tenerlo.
 */
export function ItemTarea({
  tarea,
  miId,
  cambiando,
  eliminando,
  onAlternarCompletada,
  onEliminar,
}: ItemTareaProps) {
  const completada = tarea.estado === 'COMPLETADA'
  const puedeCompletar = tarea.asignado_a === miId
  const puedeEliminar = tarea.creado_por === miId

  return (
    <li className="flex items-start gap-2.5 rounded-xl border border-border bg-surface p-3">
      {puedeCompletar ? (
        <input
          type="checkbox"
          checked={completada}
          disabled={cambiando}
          onChange={() => onAlternarCompletada(tarea)}
          aria-label={completada ? `Reabrir ${tarea.titulo}` : `Completar ${tarea.titulo}`}
          className="mt-0.5 size-4 shrink-0 accent-[var(--color-primary)] disabled:opacity-50"
        />
      ) : (
        // Sin checkbox, un punto que igual dice si está hecha o no.
        <span
          aria-hidden
          className={`mt-1.5 size-2 shrink-0 rounded-full ${completada ? 'bg-primary' : 'bg-border'}`}
        />
      )}

      <div className="min-w-0 flex-1">
        <p
          className={`m-0 text-[0.88rem] font-semibold ${completada ? 'text-ink-3 line-through' : 'text-ink'}`}
        >
          {tarea.titulo}
        </p>

        {tarea.descripcion && (
          <p className="mt-0.5 text-[0.8rem] leading-relaxed text-ink-3">
            {tarea.descripcion}
          </p>
        )}

        <div className="mt-1 flex flex-wrap items-center gap-2 text-[0.72rem] text-ink-3">
          {tarea.hora && (
            <span className="tabular-nums">{tarea.hora.slice(0, 5)}</span>
          )}
          {tarea.serie_id && (
            <span className="rounded-full bg-surface-2 px-2 py-0.5 font-semibold">
              Se repite
            </span>
          )}
          {!puedeCompletar && (
            <span className="rounded-full bg-surface-2 px-2 py-0.5">Asignada</span>
          )}
        </div>
      </div>

      {puedeEliminar && (
        <button
          type="button"
          onClick={() => onEliminar(tarea)}
          disabled={eliminando}
          aria-label={`Eliminar ${tarea.titulo}`}
          className="shrink-0 rounded-md p-1.5 text-ink-3 transition-colors hover:bg-peligro-soft hover:text-peligro-ink disabled:opacity-50 motion-reduce:transition-none"
        >
          <IconoTacho className="size-4" />
        </button>
      )}
    </li>
  )
}
