import { describe, expect, it } from 'vitest'
import { agenteDeAtribucion, atribucionDeAlta } from './atribucionLead'

describe('agenteDeAtribucion', () => {
  it('un perfil sin asiste_a es su propio agente', () => {
    expect(agenteDeAtribucion({ id: 'agente', asiste_a: null })).toBe('agente')
  })

  it('un perfil con asiste_a atribuye al agente al que asiste', () => {
    expect(agenteDeAtribucion({ id: 'asistente', asiste_a: 'agente' })).toBe('agente')
  })
})

describe('atribucionDeAlta', () => {
  it('un asistente carga para su agente y queda como quien lo lleva', () => {
    expect(atribucionDeAlta({ id: 'asistente', asiste_a: 'agente', rol: 'ASISTENTE' })).toEqual({
      agente_id: 'agente',
      asignado_a: 'asistente',
    })
  })

  it('un asistente ignora el asignadoA que le llegue', () => {
    expect(
      atribucionDeAlta({ id: 'asistente', asiste_a: 'agente', rol: 'ASISTENTE' }, 'otro'),
    ).toEqual({ agente_id: 'agente', asignado_a: 'asistente' })
  })

  it('un agente sin asignadoA es la cartera y quien lo lleva', () => {
    expect(atribucionDeAlta({ id: 'agente', asiste_a: null, rol: 'AGENTE' })).toEqual({
      agente_id: 'agente',
      asignado_a: 'agente',
    })
  })

  it('un agente con asignadoA se lo da a su asistente y la cartera sigue siendo suya', () => {
    expect(atribucionDeAlta({ id: 'agente', asiste_a: null, rol: 'AGENTE' }, 'asistente')).toEqual({
      agente_id: 'agente',
      asignado_a: 'asistente',
    })
  })

  it('un dueño sin asignadoA es la cartera y quien lo lleva', () => {
    expect(atribucionDeAlta({ id: 'dueno', asiste_a: null, rol: 'DUENO' })).toEqual({
      agente_id: 'dueno',
      asignado_a: 'dueno',
    })
  })

  it('un dueño con asignadoA se lo da a su asistente', () => {
    expect(atribucionDeAlta({ id: 'dueno', asiste_a: null, rol: 'DUENO' }, 'asistente')).toEqual({
      agente_id: 'dueno',
      asignado_a: 'asistente',
    })
  })

  it('un asignadoA vacío cuenta como sin valor', () => {
    expect(atribucionDeAlta({ id: 'dueno', asiste_a: null, rol: 'DUENO' }, '')).toEqual({
      agente_id: 'dueno',
      asignado_a: 'dueno',
    })
  })
})
