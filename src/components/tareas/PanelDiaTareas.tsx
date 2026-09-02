import { Link } from 'react-router-dom'
import { ItemTarea } from './ItemTarea'
import { ItemVisita } from './ItemVisita'
import { IconoUsuarios } from '../leads/Iconos'
import { desdeClaveDia } from '../../lib/calendario'
import type { EventoCalendario } from '../../hooks/useTareas'
import type { VisitaConContexto } from '../../lib/api/visitas'
import type { Tarea } from '../../types/database'

/** "jueves 27 de agosto", con la primera en mayúscula. */
function titulaDia(clave: string): string {
  const texto = desdeClaveDia(clave).toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

interface PanelDiaTareasProps {
  dia: string
  eventos: EventoCalendario[]
  miId: string
  idCambiando: string | null
  idEliminando: string | null
  onAlternarCompletada: (tarea: Tarea) => void
  onEliminar: (tarea: Tarea) => void
  /** Visitas: el id que está mutando y el que se está borrando. */
  idVisitaCambiando: string | null
  idVisitaEliminando: string | null
  onMarcarRealizada: (visita: VisitaConContexto) => void
  onCancelarVisita: (visita: VisitaConContexto) => void
  onEliminarVisita: (visita: VisitaConContexto) => void
}

/**
 * Detalle del día elegido.
 *
 * Tareas y seguimientos van en bloques separados: son cosas distintas —una se
 * completa acá, la otra se resuelve en la ficha del lead— y mezclarlas en una
 * sola lista invitaría a tratarlas igual.
 */
export function PanelDiaTareas({
  dia,
  eventos,
  miId,
  idCambiando,
  idEliminando,
  onAlternarCompletada,
  onEliminar,
  idVisitaCambiando,
  idVisitaEliminando,
  onMarcarRealizada,
  onCancelarVisita,
  onEliminarVisita,
}: PanelDiaTareasProps) {
  const tareas = eventos.filter((e) => e.tipo === 'TAREA')
  const seguimientos = eventos.filter((e) => e.tipo === 'SEGUIMIENTO')
  const visitas = eventos.filter((e) => e.tipo === 'VISITA')

  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="m-0 text-[0.95rem] font-bold text-ink">{titulaDia(dia)}</h2>

      {eventos.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-border bg-surface-2 px-4 py-8 text-center text-[0.85rem] text-ink-3">
          No hay nada agendado para este día.
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-5">
          {tareas.length > 0 && (
            <div>
              <h3 className="m-0 mb-2 flex items-center gap-1.5 text-xs font-bold text-ink-3 uppercase">
                <span aria-hidden className="size-2 rounded-full bg-primary" />
                Tareas ({tareas.length})
              </h3>
              <ul className="flex flex-col gap-2">
                {tareas.map((e) => {
                  const tarea = e.raw as Tarea
                  return (
                    <ItemTarea
                      key={e.id}
                      tarea={tarea}
                      miId={miId}
                      cambiando={idCambiando === tarea.id}
                      eliminando={idEliminando === tarea.id}
                      onAlternarCompletada={onAlternarCompletada}
                      onEliminar={onEliminar}
                    />
                  )
                })}
              </ul>
            </div>
          )}

          {seguimientos.length > 0 && (
            <div>
              <h3 className="m-0 mb-2 flex items-center gap-1.5 text-xs font-bold text-ink-3 uppercase">
                <span aria-hidden className="size-2 rounded-full bg-frio" />
                Seguimientos de leads ({seguimientos.length})
              </h3>
              <ul className="flex flex-col gap-2">
                {seguimientos.map((e) => (
                  <li key={e.id}>
                    <Link
                      to={`/leads/${e.leadId}`}
                      className="flex items-center gap-2.5 rounded-xl border border-border bg-surface p-3 transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
                    >
                      <span
                        aria-hidden
                        className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-cool-soft text-frio"
                      >
                        <IconoUsuarios className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.88rem] font-semibold text-ink">
                          {e.titulo}
                        </span>
                        {e.hora && (
                          <span className="text-[0.72rem] text-ink-3 tabular-nums">
                            {e.hora}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-[0.8rem] font-semibold whitespace-nowrap text-primary">
                        Ver lead →
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[0.72rem] text-ink-4">
                Los seguimientos se cambian desde la ficha del lead.
              </p>
            </div>
          )}

          {visitas.length > 0 && (
            <div>
              <h3 className="m-0 mb-2 flex items-center gap-1.5 text-xs font-bold text-ink-3 uppercase">
                <span aria-hidden className="size-2 rounded-full bg-tibio" />
                Visitas ({visitas.length})
              </h3>
              <ul className="flex flex-col gap-2">
                {visitas.map((e) => {
                  const visita = e.raw as VisitaConContexto
                  return (
                    <ItemVisita
                      key={e.id}
                      visita={visita}
                      miId={miId}
                      cambiando={idVisitaCambiando === visita.id}
                      eliminando={idVisitaEliminando === visita.id}
                      onMarcarRealizada={onMarcarRealizada}
                      onCancelar={onCancelarVisita}
                      onEliminar={onEliminarVisita}
                    />
                  )
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
