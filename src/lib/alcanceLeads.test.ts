import { describe, expect, it } from 'vitest'
import {
  asignadoAPorDefecto,
  miosPorDefecto,
  mostrarAsignado,
  mostrarChipMios,
  parametroMios,
  resolverMios,
} from './alcanceLeads'

describe('miosPorDefecto', () => {
  it('solo el asistente arranca en Míos', () => {
    expect(miosPorDefecto('ASISTENTE')).toBe(true)
    expect(miosPorDefecto('AGENTE')).toBe(false)
    expect(miosPorDefecto('DUENO')).toBe(false)
    expect(miosPorDefecto(undefined)).toBe(false)
  })
})

describe('resolverMios', () => {
  it('el asistente: sin parámetro rige Míos', () => {
    expect(resolverMios('ASISTENTE', null)).toBe(true)
  })

  it('el asistente: ?mios=0 y ?mios=1 mandan', () => {
    expect(resolverMios('ASISTENTE', '0')).toBe(false)
    expect(resolverMios('ASISTENTE', '1')).toBe(true)
  })

  it('el asistente: un valor desconocido cae al default', () => {
    expect(resolverMios('ASISTENTE', 'si')).toBe(true)
    expect(resolverMios('ASISTENTE', '')).toBe(true)
  })

  it('dueño y agente nunca filtran, ni con ?mios=1 en la URL', () => {
    expect(resolverMios('DUENO', null)).toBe(false)
    expect(resolverMios('AGENTE', null)).toBe(false)
    expect(resolverMios('DUENO', '1')).toBe(false)
    expect(resolverMios('AGENTE', '1')).toBe(false)
  })

  it('sin rol cargado no filtra', () => {
    expect(resolverMios(undefined, '1')).toBe(false)
  })
})

describe('parametroMios', () => {
  it('el asistente: no escribe nada cuando coincide con el default', () => {
    expect(parametroMios('ASISTENTE', true)).toBeNull()
  })

  it('el asistente: escribe 0 cuando pasa a Todos', () => {
    expect(parametroMios('ASISTENTE', false)).toBe('0')
  })

  it('dueño y agente nunca escriben el parámetro', () => {
    expect(parametroMios('DUENO', true)).toBeNull()
    expect(parametroMios('AGENTE', true)).toBeNull()
    expect(parametroMios('AGENTE', false)).toBeNull()
  })
})

describe('mostrarChipMios', () => {
  it('solo el asistente lo ve', () => {
    expect(mostrarChipMios('ASISTENTE')).toBe(true)
    expect(mostrarChipMios('DUENO')).toBe(false)
    expect(mostrarChipMios('AGENTE')).toBe(false)
    expect(mostrarChipMios(undefined)).toBe(false)
  })
})

describe('mostrarAsignado', () => {
  it('el asistente siempre lo ve', () => {
    expect(mostrarAsignado('ASISTENTE', false)).toBe(true)
  })

  it('dueño y agente lo ven si la cuenta tiene asistentes activos, aunque no tengan el chip', () => {
    expect(mostrarAsignado('DUENO', true)).toBe(true)
    expect(mostrarAsignado('AGENTE', true)).toBe(true)
    expect(mostrarChipMios('DUENO')).toBe(false)
  })

  it('en una cuenta sin asistentes no se muestra', () => {
    expect(mostrarAsignado('DUENO', false)).toBe(false)
    expect(mostrarAsignado('AGENTE', false)).toBe(false)
  })

  it('sin rol cargado no se muestra', () => {
    expect(mostrarAsignado(undefined, true)).toBe(false)
  })
})

describe('asignadoAPorDefecto', () => {
  it('filtra por el usuario solo si es asistente', () => {
    expect(asignadoAPorDefecto('ASISTENTE', 'u1')).toBe('u1')
    expect(asignadoAPorDefecto('AGENTE', 'u1')).toBeUndefined()
    expect(asignadoAPorDefecto('DUENO', 'u1')).toBeUndefined()
    expect(asignadoAPorDefecto('ASISTENTE', undefined)).toBeUndefined()
  })

  it('es coherente con resolverMios sin parámetro', () => {
    for (const rol of ['ASISTENTE', 'AGENTE', 'DUENO'] as const) {
      expect(asignadoAPorDefecto(rol, 'u1') !== undefined).toBe(resolverMios(rol, null))
    }
  })
})
