import { describe, expect, it } from 'vitest'
import { bloquesDelDia, DURACION_VISUAL_MIN } from './bloquesDia'
import type { EventoOrdenable } from './ordenEventos'

function ev(
  id: string,
  tipo: EventoOrdenable['tipo'],
  hora: string | null,
): EventoOrdenable & { id: string } {
  return { id, tipo, hora, raw: null }
}

const ids = (lista: { id: string }[]) => lista.map((e) => e.id)

describe('bloquesDelDia', () => {
  it('visitas 45 min; tareas y seguimientos 30 min', () => {
    expect(DURACION_VISUAL_MIN).toEqual({ VISITA: 45, SEGUIMIENTO: 30, TAREA: 30 })
    const { bloques } = bloquesDelDia([
      ev('v', 'VISITA', '09:00'),
      ev('t', 'TAREA', '11:00'),
      ev('s', 'SEGUIMIENTO', '13:15'),
    ])
    expect(bloques.map((b) => [b.evento.id, b.inicio, b.fin])).toEqual([
      ['v', 540, 585],
      ['t', 660, 690],
      ['s', 795, 825],
    ])
  })

  it('los sin hora van a "todo el día" y no entran a la grilla', () => {
    const { bloques, todoElDia } = bloquesDelDia([
      ev('t1', 'TAREA', null),
      ev('v', 'VISITA', '10:00'),
      ev('v2', 'VISITA', null),
    ])
    expect(ids(bloques.map((b) => b.evento))).toEqual(['v'])
    expect(ids(todoElDia)).toEqual(['v2', 't1'])
  })

  it('una hora que no se entiende no se pierde: cae en "todo el día"', () => {
    const { bloques, todoElDia } = bloquesDelDia([ev('raro', 'TAREA', 'mañana')])
    expect(bloques).toEqual([])
    expect(ids(todoElDia)).toEqual(['raro'])
  })

  it('acepta HH:MM:SS', () => {
    const { bloques } = bloquesDelDia([ev('v', 'VISITA', '09:30:00')])
    expect(bloques[0].inicio).toBe(570)
  })

  it('de madrugada y de noche: ninguno queda afuera', () => {
    const { bloques } = bloquesDelDia([ev('a', 'TAREA', '00:00'), ev('b', 'TAREA', '23:59')])
    expect(bloques.map((b) => [b.inicio, b.fin])).toEqual([
      [0, 30],
      [1439, 1440],
    ])
  })

  it('un bloque que cruzaría la medianoche se recorta a las 24:00', () => {
    const { bloques } = bloquesDelDia([ev('v', 'VISITA', '23:30')])
    expect(bloques[0]).toMatchObject({ inicio: 1410, fin: 1440 })
  })

  it('superpuestos: columnas lado a lado', () => {
    const { bloques } = bloquesDelDia([ev('v', 'VISITA', '10:00'), ev('t', 'TAREA', '10:20')])
    expect(bloques.map((b) => [b.evento.id, b.columna, b.columnas])).toEqual([
      ['v', 0, 2],
      ['t', 1, 2],
    ])
  })

  it('al borde justo, no se superponen: una visita de 45 min y una tarea a los 45', () => {
    const { bloques } = bloquesDelDia([ev('v', 'VISITA', '10:00'), ev('t', 'TAREA', '10:45')])
    expect(bloques.map((b) => b.columnas)).toEqual([1, 1])
  })

  it('a la misma hora, la visita queda primero (a la izquierda)', () => {
    const { bloques } = bloquesDelDia([ev('t', 'TAREA', '10:00'), ev('v', 'VISITA', '10:00')])
    expect(bloques.map((b) => [b.evento.id, b.columna])).toEqual([
      ['v', 0],
      ['t', 1],
    ])
  })

  it('sin eventos: todo vacío', () => {
    expect(bloquesDelDia([])).toEqual({ bloques: [], todoElDia: [] })
  })
})
