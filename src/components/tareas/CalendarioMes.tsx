import { useMemo } from 'react'
import { claveDia, diasDeLaGrilla } from '../../lib/calendario'
import type { EventoCalendario } from '../../hooks/useTareas'

/** Cuántos chips entran en una celda antes del "+N más". */
const VISIBLES_POR_DIA = 3

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

/**
 * Punto de color por tipo. Verde = trabajo propio, azul = lead, ámbar = visita
 * a una propiedad, siguiendo la paleta que ya usa el resto de la app.
 */
const PUNTO: Record<EventoCalendario['tipo'], string> = {
  TAREA: 'bg-primary',
  SEGUIMIENTO: 'bg-frio',
  VISITA: 'bg-tibio',
}

const CHIP: Record<EventoCalendario['tipo'], string> = {
  TAREA: 'bg-brand-soft text-primary-dark',
  SEGUIMIENTO: 'bg-cool-soft text-frio',
  // El ámbar de `--color-tibio` sobre su propio soft queda flojo de contraste;
  // la tinta oscura del badge tibio es la que el proyecto ya usa para eso.
  VISITA: 'bg-warm-soft text-badge-tibio-ink',
}

interface CalendarioMesProps {
  ano: number
  /** 0-11, como `Date.getMonth()`. */
  mes: number
  eventos: EventoCalendario[]
  diaSeleccionado: string | null
  onSelectDia: (fecha: string) => void
  /**
   * Atajo: doble click en un día para arrancar una tarea ahí.
   *
   * Va sin definir para quien no puede crear. Es un acelerador y no la única
   * vía —el botón "Nueva tarea" sigue siendo la ruta accesible por teclado—,
   * así que no hace falta un equivalente con foco.
   */
  onNuevaTareaEnDia?: (fecha: string) => void
}

export function CalendarioMes({
  ano,
  mes,
  eventos,
  diaSeleccionado,
  onSelectDia,
  onNuevaTareaEnDia,
}: CalendarioMesProps) {
  const dias = useMemo(() => diasDeLaGrilla(ano, mes), [ano, mes])

  const porDia = useMemo(() => {
    const mapa = new Map<string, EventoCalendario[]>()
    for (const e of eventos) {
      const lista = mapa.get(e.fecha)
      if (lista) lista.push(e)
      else mapa.set(e.fecha, [e])
    }
    // Dentro del día: primero lo que tiene hora, en orden.
    for (const lista of mapa.values()) {
      lista.sort((a, b) => (a.hora ?? '99:99').localeCompare(b.hora ?? '99:99'))
    }
    return mapa
  }, [eventos])

  const hoy = claveDia(new Date())

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="grid grid-cols-7 border-b border-border bg-surface-2">
        {DIAS.map((d) => (
          <div
            key={d}
            className="px-1 py-2 text-center text-[0.68rem] font-bold text-ink-3 uppercase"
          >
            {/* En pantallas chicas alcanza la inicial. */}
            <span className="hidden sm:inline">{d}</span>
            <span className="sm:hidden">{d.charAt(0)}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {dias.map((dia) => {
          const clave = claveDia(dia)
          const delMes = dia.getMonth() === mes
          const esHoy = clave === hoy
          const seleccionado = clave === diaSeleccionado
          const delDia = porDia.get(clave) ?? []
          const visibles = delDia.slice(0, VISIBLES_POR_DIA)
          const resto = delDia.length - visibles.length

          return (
            <button
              key={clave}
              type="button"
              onClick={() => onSelectDia(clave)}
              // El navegador dispara el click simple antes del doble: el día
              // queda seleccionado y recién después abre el modal. No hay que
              // cancelarlo, porque selecciona justo el día que el modal va a
              // usar; frenar el click con un timer para "esperar" el doble le
              // metería retardo al gesto simple, que es el más frecuente.
              onDoubleClick={
                onNuevaTareaEnDia ? () => onNuevaTareaEnDia(clave) : undefined
              }
              title={onNuevaTareaEnDia ? 'Doble click para agendar una tarea' : undefined}
              aria-label={`${dia.getDate()} — ${delDia.length} ${delDia.length === 1 ? 'evento' : 'eventos'}`}
              aria-current={esHoy ? 'date' : undefined}
              className={[
                'flex min-h-[86px] flex-col gap-1 border-r border-b border-border p-1.5 text-left',
                'transition-colors last:border-r-0 motion-reduce:transition-none',
                'focus-visible:relative focus-visible:z-10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary',
                delMes ? 'bg-surface' : 'bg-surface-2/60',
                seleccionado ? 'ring-2 ring-primary ring-inset' : 'hover:bg-background',
              ].join(' ')}
            >
              <span
                className={[
                  'grid size-6 shrink-0 place-items-center rounded-full text-[0.75rem] tabular-nums',
                  esHoy ? 'bg-primary font-bold text-white' : '',
                  delMes ? (esHoy ? '' : 'text-ink-2') : 'text-ink-4',
                ].join(' ')}
              >
                {dia.getDate()}
              </span>

              {/* Escritorio: chip con el título. Mobile: sólo el punto de color,
                  que en 40px de ancho el texto no entra. */}
              <span className="hidden min-w-0 flex-col gap-0.5 sm:flex">
                {visibles.map((e) => (
                  <span
                    key={e.id}
                    className={[
                      'truncate rounded px-1 py-0.5 text-[0.66rem] leading-tight',
                      CHIP[e.tipo],
                      e.completada ? 'line-through opacity-60' : '',
                    ].join(' ')}
                  >
                    {e.hora ? `${e.hora} ` : ''}
                    {e.titulo}
                  </span>
                ))}
                {resto > 0 && (
                  <span className="px-1 text-[0.64rem] text-ink-3">+{resto} más</span>
                )}
              </span>

              <span className="flex flex-wrap gap-0.5 sm:hidden" aria-hidden>
                {visibles.map((e) => (
                  <span
                    key={e.id}
                    className={`size-1.5 rounded-full ${PUNTO[e.tipo]} ${e.completada ? 'opacity-40' : ''}`}
                  />
                ))}
                {resto > 0 && <span className="text-[0.6rem] text-ink-4">+{resto}</span>}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
