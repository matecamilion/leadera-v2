import { useEffect, useMemo, useRef } from 'react'
import { desdeClaveDia, hoyComoClave } from '../../lib/calendario'
import { MINUTOS_DEL_DIA } from '../../lib/columnasSuperpuestas'
import { bloquesDelDia, type BloqueDia } from '../../lib/bloquesDia'
import type { EventoCalendario } from '../../hooks/useTareas'
import { CHIP } from './coloresEvento'

/** Alto de una hora en pantalla. El eje completo son 24 de estas. */
const PX_POR_HORA = 56
const ALTO_TOTAL = (MINUTOS_DEL_DIA / 60) * PX_POR_HORA
/** Un bloque de 30 minutos mide 28px: este piso es para el que se recorta contra las 24:00. */
const ALTO_MINIMO_BLOQUE = 22
/** A qué hora arranca el scroll si no hay nada antes. */
const HORA_INICIAL_SCROLL = 7
/** Media hora de aire arriba del primer evento (o de las 7:00): se ve la etiqueta de la hora y el bloque no queda pegado al borde. */
const AIRE_ARRIBA_MIN = 30
const HORAS = Array.from({ length: 24 }, (_, h) => h)

interface GrillaHorariaProps {
  /** Los días que se muestran, uno por columna (`YYYY-MM-DD`). Ahora uno; la semana serán siete. */
  dias: readonly string[]
  /** Todos los eventos cargados: cada columna toma los de su día. */
  eventos: EventoCalendario[]
  diaSeleccionado: string | null
  onSelectDia: (fecha: string) => void
}

/** Visitas ya cerradas: se ven, pero atenuadas respecto de las que hay que hacer. */
function estaAtenuado(e: EventoCalendario): boolean {
  return e.tipo === 'VISITA' && e.estadoVisita !== undefined && e.estadoVisita !== 'AGENDADA'
}

function claseDeEvento(e: EventoCalendario): string {
  return [
    CHIP[e.tipo],
    e.completada ? 'line-through opacity-60' : '',
    estaAtenuado(e) ? 'opacity-55' : '',
  ].join(' ')
}

function geometria(b: BloqueDia<EventoCalendario>) {
  const alto = Math.max(((b.fin - b.inicio) / 60) * PX_POR_HORA, ALTO_MINIMO_BLOQUE)
  // Con el piso, uno pegado a las 24:00 se correría hacia abajo y se saldría: se sube.
  const arriba = Math.min((b.inicio / 60) * PX_POR_HORA, ALTO_TOTAL - alto)
  const ancho = 100 / b.columnas
  return {
    top: arriba,
    height: alto,
    left: `calc(${b.columna * ancho}% + 2px)`,
    width: `calc(${ancho}% - 4px)`,
  }
}

/**
 * Grilla horaria: eje de 24 horas, líneas por hora y los eventos posicionados por
 * su hora, con una franja "todo el día" arriba para los que no la tienen.
 *
 * La duración de los bloques es cosmética (las visitas y tareas no tienen hora de
 * fin; ver `lib/bloquesDia`). Los que se superponen van lado a lado. El eje
 * scrollea por dentro: arranca a las 7:00, o en el primer evento si empieza antes,
 * así ninguno queda fuera de la vista. Click en un bloque selecciona su día.
 *
 * Recibe una lista de días para que la semana la reutilice con siete columnas.
 */
export function GrillaHoraria({
  dias,
  eventos,
  diaSeleccionado,
  onSelectDia,
}: GrillaHorariaProps) {
  const columnasDeDias = useMemo(
    () => dias.map((dia) => ({ dia, ...bloquesDelDia(eventos.filter((e) => e.fecha === dia)) })),
    [dias, eventos],
  )

  const hayTodoElDia = columnasDeDias.some((c) => c.todoElDia.length > 0)
  const variasColumnas = dias.length > 1
  const hoy = hoyComoClave()
  const plantilla = `3.25rem repeat(${dias.length}, minmax(0, 1fr))`

  // Dónde arranca el scroll: las 7:00, o antes si hay un evento más temprano.
  const primerInicio = columnasDeDias.reduce(
    (menor, c) => c.bloques.reduce((m, b) => Math.min(m, b.inicio), menor),
    HORA_INICIAL_SCROLL * 60,
  )
  const clavesDeDias = dias.join(',')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Al cambiar de día o de primer evento; mover el scroll a mano no lo dispara.
    if (scrollRef.current) {
      scrollRef.current.scrollTop = (Math.max(0, primerInicio - AIRE_ARRIBA_MIN) / 60) * PX_POR_HORA
    }
  }, [clavesDeDias, primerInicio])

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      {variasColumnas && (
        <div className="grid border-b border-border bg-surface-2" style={{ gridTemplateColumns: plantilla }}>
          <div />
          {dias.map((dia) => {
            const fecha = desdeClaveDia(dia)
            const esHoy = dia === hoy
            return (
              <div
                key={dia}
                aria-current={esHoy ? 'date' : undefined}
                className="px-1 py-2 text-center text-[0.68rem] font-bold text-ink-3 uppercase"
              >
                {fecha.toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', '')}{' '}
                <span
                  className={[
                    'inline-grid size-5 place-items-center rounded-full tabular-nums',
                    esHoy ? 'bg-primary text-primary-contrast' : '',
                  ].join(' ')}
                >
                  {fecha.getDate()}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {hayTodoElDia && (
        <div
          className="grid border-b border-border"
          style={{ gridTemplateColumns: plantilla }}
        >
          <div className="px-1 py-2 text-right text-[0.64rem] leading-tight text-ink-4">
            Todo el día
          </div>
          {columnasDeDias.map((c) => (
            <div key={c.dia} className="flex min-w-0 flex-col gap-0.5 border-l border-border p-1">
              {c.todoElDia.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => onSelectDia(e.fecha)}
                  className={[
                    'truncate rounded px-1.5 py-0.5 text-left text-[0.72rem] leading-tight',
                    claseDeEvento(e),
                  ].join(' ')}
                >
                  {e.titulo}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      <div
        ref={scrollRef}
        role="region"
        aria-label="Agenda por hora"
        // Es una región con scroll: con foco por teclado se puede recorrer con las flechas.
        tabIndex={0}
        // Hasta 640px, pero sin pasarse de la pantalla: con ventanas bajas la región entera
        // entra a la vista (header de la app + barra + franja "todo el día" restan ~12rem).
        className="max-h-[max(20rem,min(640px,calc(100dvh_-_12rem)))] overflow-y-auto overscroll-contain"
      >
        <div className="grid" style={{ gridTemplateColumns: plantilla, height: ALTO_TOTAL }}>
          <div className="relative" aria-hidden>
            {HORAS.slice(1).map((h) => (
              <span
                key={h}
                className="absolute right-1.5 -translate-y-1/2 text-[0.68rem] text-ink-4 tabular-nums"
                style={{ top: h * PX_POR_HORA }}
              >
                {String(h).padStart(2, '0')}:00
              </span>
            ))}
          </div>

          {columnasDeDias.map((c) => (
            <div
              key={c.dia}
              className={[
                'relative border-l border-border',
                c.dia === diaSeleccionado && variasColumnas ? 'bg-brand-softer' : '',
              ].join(' ')}
            >
              {HORAS.slice(1).map((h) => (
                <div
                  key={h}
                  aria-hidden
                  className="absolute inset-x-0 border-t border-border"
                  style={{ top: h * PX_POR_HORA }}
                />
              ))}

              {c.bloques.map((b) => (
                <button
                  key={b.evento.id}
                  type="button"
                  onClick={() => onSelectDia(b.evento.fecha)}
                  aria-label={`${b.evento.hora ?? ''} ${b.evento.titulo}`.trim()}
                  style={geometria(b)}
                  className={[
                    'absolute overflow-hidden rounded border border-surface px-1.5 py-0.5 text-left text-[0.72rem] leading-tight',
                    claseDeEvento(b.evento),
                  ].join(' ')}
                >
                  <span className="font-semibold tabular-nums">{b.evento.hora}</span>{' '}
                  <span className="[overflow-wrap:anywhere]">{b.evento.titulo}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
