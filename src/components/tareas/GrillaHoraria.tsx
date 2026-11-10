import { useEffect, useMemo, useRef } from 'react'
import { useAhora } from '../../hooks/useAhora'
import { claveDia, desdeClaveDia } from '../../lib/calendario'
import { ALTO_TOTAL, PX_POR_HORA, posicionLineaAhora, pxDeMinutos } from '../../lib/escalaGrilla'
import { scrollInicialPx } from '../../lib/scrollInicialGrilla'
import { bloquesDelDia, type BloqueDia } from '../../lib/bloquesDia'
import type { EventoCalendario } from '../../hooks/useTareas'
import { CHIP } from './coloresEvento'

/** Un bloque de 30 minutos mide 28px: este piso es para el que se recorta contra las 24:00. */
const ALTO_MINIMO_BLOQUE = 22
/** Ancho de la columna de las horas. */
const ANCHO_EJE_REM = 3.25
/** Ancho mínimo de cada columna de día: por debajo, la grilla scrollea en horizontal. */
const ANCHO_MIN_COLUMNA_REM = 6.5
const HORAS = Array.from({ length: 24 }, (_, h) => h)

interface GrillaHorariaProps {
  /** Los días que se muestran, uno por columna (`YYYY-MM-DD`): uno en la vista Día, siete en la Semana. */
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
  const alto = Math.max(pxDeMinutos(b.fin - b.inicio), ALTO_MINIMO_BLOQUE)
  // Con el piso, uno pegado a las 24:00 se correría hacia abajo y se saldría: se sube.
  const arriba = Math.min(pxDeMinutos(b.inicio), ALTO_TOTAL - alto)
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
 * fin; ver `lib/bloquesDia`). Los que se superponen van lado a lado, día por día.
 * El eje scrollea por dentro. Arranca una hora antes de la hora actual si hoy se ve
 * y ya pasaron las 7:00; si no, a las 6:30 o en el primer evento (de todos los días
 * que se ven) si empieza antes (ver `lib/scrollInicialGrilla`). Click en un bloque
 * selecciona su día.
 *
 * Si hoy es una de las columnas, una línea marca la hora actual: va por encima de los
 * bloques (se lee mejor que escondida detrás), no recibe clicks y se mueve cada minuto.
 *
 * Recibe una lista de días: uno en la vista Día, siete en la Semana. Con varias
 * columnas suma un encabezado por día (click selecciona ese día) y, en pantallas
 * angostas, scrollea también en horizontal: cada columna tiene un ancho mínimo y el
 * eje de las horas queda fijo a la izquierda. Los encabezados y la franja "todo el
 * día" quedan fijos arriba al scrollear en vertical.
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
  const ahora = useAhora()
  const hoy = claveDia(ahora)
  const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes()
  const hoyVisible = dias.includes(hoy)
  const plantilla = `${ANCHO_EJE_REM}rem repeat(${dias.length}, minmax(0, 1fr))`

  // El primer evento de todos los días que se ven, para el scroll inicial.
  const primerEventoMin = columnasDeDias.reduce<number | null>(
    (menor, c) => c.bloques.reduce((m, b) => (m === null ? b.inicio : Math.min(m, b.inicio)), menor),
    null,
  )
  const clavesDeDias = dias.join(',')
  const scrollRef = useRef<HTMLDivElement>(null)

  // El scroll se calcula al montar y al cambiar de días, no en cada tick del reloj
  // (por eso `ahora` entra por una ref) y no pisa un scroll que el usuario ya hizo.
  const ahoraMinRef = useRef<number | null>(null)
  useEffect(() => {
    ahoraMinRef.current = hoyVisible ? minutosAhora : null
  })
  const aplicado = useRef<{ claves: string; px: number } | null>(null)
  const scrolleoElUsuario = useRef(false)

  useEffect(() => {
    const region = scrollRef.current
    if (!region) return
    const otrosDias = aplicado.current?.claves !== clavesDeDias
    if (otrosDias) scrolleoElUsuario.current = false
    // Llegaron eventos más tempranos en los mismos días: se corrige solo si no tocó nada.
    if (!otrosDias && scrolleoElUsuario.current) return
    const px = scrollInicialPx({ primerEventoMin, ahoraMin: ahoraMinRef.current })
    region.scrollTop = px
    // Lo que quedó de verdad (el navegador lo recorta al máximo posible): con eso se compara.
    aplicado.current = { claves: clavesDeDias, px: region.scrollTop }
  }, [clavesDeDias, primerEventoMin])

  function alScrollear() {
    const region = scrollRef.current
    // Distinto de lo que se aplicó por código: lo movió el usuario.
    if (region && aplicado.current && Math.abs(region.scrollTop - aplicado.current.px) > 2) {
      scrolleoElUsuario.current = true
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <div
        ref={scrollRef}
        role="region"
        aria-label="Agenda por hora"
        // Es una región con scroll: con foco por teclado se puede recorrer con las flechas.
        tabIndex={0}
        onScroll={alScrollear}
        // Hasta 640px, pero sin pasarse de la pantalla: con ventanas bajas la región entera
        // entra a la vista (header de la app + barra + encabezados restan ~12rem).
        className="max-h-[max(20rem,min(640px,calc(100dvh_-_12rem)))] overflow-auto"
      >
        <div style={{ minWidth: `${ANCHO_EJE_REM + dias.length * ANCHO_MIN_COLUMNA_REM}rem` }}>
          {(variasColumnas || hayTodoElDia) && (
            // Fijo arriba al scrollear en vertical: el día y lo de todo el día se ven siempre.
            <div className="sticky top-0 z-20 bg-surface">
              {variasColumnas && (
                <div
                  className="grid border-b border-border bg-surface-2"
                  style={{ gridTemplateColumns: plantilla }}
                >
                  <div className="sticky left-0 z-10 bg-surface-2" />
                  {dias.map((dia) => {
                    const fecha = desdeClaveDia(dia)
                    const esHoy = dia === hoy
                    const seleccionado = dia === diaSeleccionado
                    return (
                      <button
                        key={dia}
                        type="button"
                        onClick={() => onSelectDia(dia)}
                        aria-pressed={seleccionado}
                        aria-current={esHoy ? 'date' : undefined}
                        aria-label={fecha.toLocaleDateString('es-AR', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                        })}
                        className={[
                          'border-l border-border px-1 py-2 text-center text-[0.68rem] font-bold uppercase',
                          'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary',
                          seleccionado ? 'bg-brand-softer text-ink' : 'text-ink-3 hover:bg-background',
                        ].join(' ')}
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
                      </button>
                    )
                  })}
                </div>
              )}

              {hayTodoElDia && (
                <div
                  className="grid border-b border-border"
                  style={{ gridTemplateColumns: plantilla }}
                >
                  <div className="sticky left-0 z-10 bg-surface px-1 py-2 text-right text-[0.64rem] leading-tight text-ink-4">
                    Todo el día
                  </div>
                  {columnasDeDias.map((c) => (
                    <div
                      key={c.dia}
                      className={[
                        'flex min-w-0 flex-col gap-0.5 border-l border-border p-1',
                        c.dia === diaSeleccionado && variasColumnas ? 'bg-brand-softer' : '',
                      ].join(' ')}
                    >
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
            </div>
          )}

          <div className="grid" style={{ gridTemplateColumns: plantilla, height: ALTO_TOTAL }}>
            <div className="sticky left-0 z-10 bg-surface" aria-hidden>
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

                {c.dia === hoy && (
                  // Debajo del eje fijo (z-10) al scrollear en horizontal, encima de los bloques.
                  <div
                    aria-hidden
                    data-testid="linea-hora-actual"
                    className="pointer-events-none absolute inset-x-0 z-[5] h-0.5 bg-primary"
                    style={{ top: posicionLineaAhora(minutosAhora) }}
                  >
                    <span className="absolute top-1/2 -left-1 size-2 -translate-y-1/2 rounded-full bg-primary" />
                  </div>
                )}

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
    </div>
  )
}
