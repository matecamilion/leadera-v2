import { Link } from 'react-router-dom'
import { IconoCasa, IconoCheck, IconoCerrar, IconoTacho } from '../leads/Iconos'
import type { EstadoVisita } from '../../types/database'
import type { VisitaConContexto } from '../../lib/api/visitas'

const ETIQUETA_ESTADO: Record<EstadoVisita, string> = {
  AGENDADA: 'Agendada',
  REALIZADA: 'Realizada',
  CANCELADA: 'Cancelada',
}

const COLOR_ESTADO: Record<EstadoVisita, string> = {
  AGENDADA: 'bg-warm-soft text-badge-tibio-ink',
  REALIZADA: 'bg-badge-ganado-bg text-success',
  CANCELADA: 'bg-surface-2 text-ink-3',
}

interface ItemVisitaProps {
  visita: VisitaConContexto
  /** Id del usuario logueado: decide qué acciones se ofrecen. */
  miId: string
  cambiando: boolean
  eliminando: boolean
  onMarcarRealizada: (visita: VisitaConContexto) => void
  onCancelar: (visita: VisitaConContexto) => void
  onEliminar: (visita: VisitaConContexto) => void
}

/**
 * Una visita del día.
 *
 * Cambiar el estado lo pueden el creador y el asignado; eliminar, sólo quien la
 * creó. RLS rechaza lo demás igual, pero un botón que siempre falla es peor que
 * no tenerlo. Una visita ya cerrada —realizada o cancelada— no ofrece acciones:
 * es historial.
 */
export function ItemVisita({
  visita,
  miId,
  cambiando,
  eliminando,
  onMarcarRealizada,
  onCancelar,
  onEliminar,
}: ItemVisitaProps) {
  const abierta = visita.estado === 'AGENDADA'
  const puedeGestionar = visita.creado_por === miId || visita.asignado_a === miId
  const puedeEliminar = visita.creado_por === miId
  const direccion = visita.propiedad?.direccion ?? 'Propiedad sin dirección'

  return (
    <li className="rounded-xl border border-border bg-surface p-3">
      <div className="flex items-start gap-2.5">
        <span
          aria-hidden
          className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-warm-soft text-badge-tibio-ink"
        >
          <IconoCasa className="size-4" />
        </span>

        <div className="min-w-0 flex-1">
          <Link
            to={`/propiedades/${visita.propiedad_id}`}
            className="block truncate text-[0.88rem] font-semibold text-ink hover:text-primary hover:underline"
          >
            {direccion}
          </Link>

          <p className="mt-0.5 truncate text-[0.8rem] text-ink-3">
            {visita.lead ? (
              <>
                Con{' '}
                <Link
                  to={`/leads/${visita.lead.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {visita.lead.nombre} {visita.lead.apellido ?? ''}
                </Link>
              </>
            ) : (
              'Sin lead asignado'
            )}
          </p>

          {visita.notas && (
            <p className="mt-0.5 text-[0.8rem] leading-relaxed text-ink-3">{visita.notas}</p>
          )}

          <div className="mt-1 flex flex-wrap items-center gap-2 text-[0.72rem] text-ink-3">
            {visita.hora && (
              <span className="tabular-nums">{visita.hora.slice(0, 5)}</span>
            )}
            <span
              className={`rounded-full px-2 py-0.5 font-semibold ${COLOR_ESTADO[visita.estado]}`}
            >
              {ETIQUETA_ESTADO[visita.estado]}
            </span>
            {!puedeGestionar && (
              <span className="rounded-full bg-surface-2 px-2 py-0.5">De otro agente</span>
            )}
          </div>
        </div>

        {puedeEliminar && (
          <button
            type="button"
            onClick={() => onEliminar(visita)}
            disabled={eliminando}
            aria-label={`Eliminar la visita a ${direccion}`}
            className="shrink-0 rounded-md p-1.5 text-ink-3 transition-colors hover:bg-peligro-soft hover:text-peligro-ink disabled:opacity-50 motion-reduce:transition-none"
          >
            <IconoTacho className="size-4" />
          </button>
        )}
      </div>

      {abierta && puedeGestionar && (
        <div className="mt-2.5 flex flex-wrap gap-2 pl-[2.625rem]">
          <button
            type="button"
            onClick={() => onMarcarRealizada(visita)}
            disabled={cambiando}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[0.78rem] font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-55 motion-reduce:transition-none"
          >
            <IconoCheck className="size-3.5" />
            Marcar realizada
          </button>
          <button
            type="button"
            onClick={() => onCancelar(visita)}
            disabled={cambiando}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[0.78rem] font-semibold text-ink-2 transition-colors hover:bg-background disabled:opacity-55 motion-reduce:transition-none"
          >
            <IconoCerrar className="size-3.5" />
            Cancelar
          </button>
        </div>
      )}
    </li>
  )
}
