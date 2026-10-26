import { describe, expect, it } from 'vitest'
import { atribucionDeAlta } from './atribucionLead'

describe('atribucionDeAlta', () => {
  it('un asistente carga para su agente y queda como quien lo lleva', () => {
    expect(atribucionDeAlta({ id: 'asistente', asiste_a: 'agente' })).toEqual({
      agente_id: 'agente',
      asignado_a: 'asistente',
    })
  })

  it('un agente es la cartera y quien lo lleva', () => {
    expect(atribucionDeAlta({ id: 'agente', asiste_a: null })).toEqual({
      agente_id: 'agente',
      asignado_a: 'agente',
    })
  })

  it('un dueño también', () => {
    expect(atribucionDeAlta({ id: 'dueno', asiste_a: null })).toEqual({
      agente_id: 'dueno',
      asignado_a: 'dueno',
    })
  })
})
