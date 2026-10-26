import { describe, expect, it } from 'vitest'
import {
  asignadoAPorDefecto,
  miosPorDefecto,
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
  it('sin parámetro rige el default del rol', () => {
    expect(resolverMios('ASISTENTE', null)).toBe(true)
    expect(resolverMios('AGENTE', null)).toBe(false)
    expect(resolverMios('DUENO', null)).toBe(false)
  })

  it('?mios=1 y ?mios=0 mandan sobre el rol', () => {
    expect(resolverMios('ASISTENTE', '0')).toBe(false)
    expect(resolverMios('AGENTE', '1')).toBe(true)
    expect(resolverMios('DUENO', '1')).toBe(true)
  })

  it('un valor desconocido cae al default', () => {
    expect(resolverMios('ASISTENTE', 'si')).toBe(true)
    expect(resolverMios('DUENO', '')).toBe(false)
  })
})

describe('parametroMios', () => {
  it('no escribe nada cuando coincide con el default', () => {
    expect(parametroMios('ASISTENTE', true)).toBeNull()
    expect(parametroMios('AGENTE', false)).toBeNull()
  })

  it('escribe el valor cuando se aparta del default', () => {
    expect(parametroMios('ASISTENTE', false)).toBe('0')
    expect(parametroMios('DUENO', true)).toBe('1')
  })
})

describe('mostrarChipMios', () => {
  it('el asistente siempre lo ve', () => {
    expect(mostrarChipMios('ASISTENTE', false)).toBe(true)
  })

  it('dueño y agente solo si hay asistentes activos', () => {
    expect(mostrarChipMios('DUENO', true)).toBe(true)
    expect(mostrarChipMios('AGENTE', true)).toBe(true)
    expect(mostrarChipMios('DUENO', false)).toBe(false)
    expect(mostrarChipMios('AGENTE', false)).toBe(false)
  })

  it('sin rol cargado no se muestra', () => {
    expect(mostrarChipMios(undefined, true)).toBe(false)
  })
})

describe('asignadoAPorDefecto', () => {
  it('filtra por el usuario solo si es asistente', () => {
    expect(asignadoAPorDefecto('ASISTENTE', 'u1')).toBe('u1')
    expect(asignadoAPorDefecto('AGENTE', 'u1')).toBeUndefined()
    expect(asignadoAPorDefecto('DUENO', 'u1')).toBeUndefined()
    expect(asignadoAPorDefecto('ASISTENTE', undefined)).toBeUndefined()
  })
})
