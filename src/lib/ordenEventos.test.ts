import { describe, expect, it } from 'vitest'
import {
  minutosDelDia,
  ordenarEventosCalendario,
  ordenarPorFechaYHora,
  type EventoOrdenable,
} from './ordenEventos'

function ev(
  id: string,
  tipo: EventoOrdenable['tipo'],
  hora: string | null,
  created_at?: string,
): EventoOrdenable & { id: string } {
  return { id, tipo, hora, raw: created_at ? { created_at } : {} }
}

const ids = (xs: { id: string }[]) => xs.map((x) => x.id)

describe('minutosDelDia', () => {
  it('HH:MM y HH:MM:SS dan lo mismo', () => {
    expect(minutosDelDia('09:30')).toBe(570)
    expect(minutosDelDia('09:30:00')).toBe(570)
    expect(minutosDelDia('09:30:45')).toBe(570)
    expect(minutosDelDia('9:05')).toBe(545)
  })
  it('medianoche y fin del día', () => {
    expect(minutosDelDia('00:00')).toBe(0)
    expect(minutosDelDia('23:59:59')).toBe(1439)
  })
  it('sin hora o ilegible es null', () => {
    expect(minutosDelDia(null)).toBeNull()
    expect(minutosDelDia(undefined)).toBeNull()
    expect(minutosDelDia('')).toBeNull()
    expect(minutosDelDia('mañana')).toBeNull()
    expect(minutosDelDia('25:00')).toBeNull()
    expect(minutosDelDia('10:75')).toBeNull()
  })
})

describe('ordenarEventosCalendario', () => {
  it('sin hora primero', () => {
    const r = ordenarEventosCalendario(
      [ev('a', 'TAREA', '10:00'), ev('b', 'TAREA', null), ev('c', 'VISITA', '08:00')],
      'primero',
    )
    expect(ids(r)).toEqual(['b', 'c', 'a'])
  })

  it('sin hora al final', () => {
    const r = ordenarEventosCalendario(
      [ev('a', 'TAREA', null), ev('b', 'VISITA', '15:00'), ev('c', 'TAREA', '09:00')],
      'ultimo',
    )
    expect(ids(r)).toEqual(['c', 'b', 'a'])
  })

  it('formatos de hora mezclados se comparan por minutos, no como texto', () => {
    const r = ordenarEventosCalendario(
      [
        ev('tarde', 'TAREA', '14:00:00'),
        ev('temprano', 'TAREA', '9:30'),
        ev('medio', 'VISITA', '09:45:00'),
        ev('casi', 'TAREA', '09:30:59'),
      ],
      'primero',
    )
    expect(ids(r)).toEqual(['temprano', 'casi', 'medio', 'tarde'])
  })

  it('misma hora entre tipos: visita, seguimiento, tarea', () => {
    const r = ordenarEventosCalendario(
      [ev('t', 'TAREA', '10:00'), ev('s', 'SEGUIMIENTO', '10:00'), ev('v', 'VISITA', '10:00')],
      'primero',
    )
    expect(ids(r)).toEqual(['v', 's', 't'])
  })

  it('empate total: created_at más viejo primero; sin created_at, al final', () => {
    const r = ordenarEventosCalendario(
      [
        ev('sin', 'TAREA', '10:00'),
        ev('nueva', 'TAREA', '10:00', '2026-11-02T12:00:00Z'),
        ev('vieja', 'TAREA', '10:00', '2026-11-01T12:00:00Z'),
      ],
      'primero',
    )
    expect(ids(r)).toEqual(['vieja', 'nueva', 'sin'])
  })

  it('empate de todo: conserva el orden original (estable)', () => {
    const entrada = [ev('1', 'TAREA', null), ev('2', 'TAREA', null), ev('3', 'TAREA', null)]
    expect(ids(ordenarEventosCalendario(entrada, 'primero'))).toEqual(['1', '2', '3'])
    expect(ids(ordenarEventosCalendario(entrada, 'ultimo'))).toEqual(['1', '2', '3'])
  })

  it('los sin hora también se desempatan por tipo', () => {
    const r = ordenarEventosCalendario([ev('t', 'TAREA', null), ev('v', 'VISITA', null)], 'primero')
    expect(ids(r)).toEqual(['v', 't'])
  })

  it('no muta la entrada', () => {
    const entrada = [ev('a', 'TAREA', '10:00'), ev('b', 'TAREA', '08:00')]
    ordenarEventosCalendario(entrada, 'primero')
    expect(ids(entrada)).toEqual(['a', 'b'])
  })

  it('completados y cancelados no se mueven: se ordenan como cualquiera', () => {
    const hecha = { ...ev('hecha', 'TAREA', '08:00'), completada: true }
    const r = ordenarEventosCalendario([ev('abierta', 'TAREA', '09:00'), hecha], 'primero')
    expect(ids(r)).toEqual(['hecha', 'abierta'])
  })
})

describe('ordenarPorFechaYHora', () => {
  const t = (id: string, fecha: string, hora: string | null) => ({ id, fecha, hora })
  type Fila = ReturnType<typeof t>
  const campos = { hora: (x: Fila) => x.hora }

  it('por fecha, y dentro de la fecha sin hora primero y luego por hora', () => {
    const r = ordenarPorFechaYHora<Fila>(
      [
        t('d2-10', '2026-11-03', '10:00:00'),
        t('d1-14', '2026-11-02', '14:00'),
        t('d1-null', '2026-11-02', null),
        t('d1-09', '2026-11-02', '09:00:00'),
      ],
      campos,
    )
    expect(ids(r)).toEqual(['d1-null', 'd1-09', 'd1-14', 'd2-10'])
  })
})
