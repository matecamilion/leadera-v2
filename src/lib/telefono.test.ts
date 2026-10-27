import { describe, expect, it } from 'vitest'
import { normalizarTelefonoAR } from './telefono'
// La copia que usan las Edge Functions (Deno): tiene que dar lo mismo que el front.
import { normalizarTelefonoAR as normalizarEnFunciones } from '../../supabase/functions/_shared/telefono'

// Todos inventados.
const CASOS: [string, string][] = [
  // Ya funcionaban.
  ['223 555-0101', '5492235550101'],
  ['2235550102', '5492235550102'],
  ['+54 9 223 555-0103', '5492235550103'],
  ['114 555-0105', '5491145550105'],
  ['0223 15 555-0106', '5492235550106'],
  // Celular con el 9 pero sin el 54.
  ['9 11 5550-0104', '5491155500104'],
  ['9 223 555-0101', '5492235550101'],
  ['0 9 223 555-0101', '5492235550101'],
  ['009 223 555-0101', '5492235550101'],
]

describe('normalizarTelefonoAR', () => {
  it.each(CASOS)('%s -> %s', (entrada, esperado) => {
    expect(normalizarTelefonoAR(entrada)).toBe(esperado)
  })

  it('10 dígitos que empiezan con 9 no se tocan (no es un teléfono argentino válido)', () => {
    expect(normalizarTelefonoAR('9 223 555-010')).toBe('5499223555010')
  })

  it('el mismo celular, con y sin el 9 delante, da lo mismo', () => {
    expect(normalizarTelefonoAR('9 223 555-0101')).toBe(normalizarTelefonoAR('223 555-0101'))
    expect(normalizarTelefonoAR('9 11 5550-0104')).toBe(normalizarTelefonoAR('+54 9 11 5550-0104'))
  })

  it('lo que ya daba un resultado raro sigue igual', () => {
    expect(normalizarTelefonoAR('223 555-012')).toBe('549223555012')
    expect(normalizarTelefonoAR('+1 310 555 0108')).toBe('54913105550108')
    expect(normalizarTelefonoAR('')).toBe('')
  })
})

describe('las dos copias de normalizarTelefonoAR', () => {
  const ENTRADAS = [
    ...CASOS.map(([entrada]) => entrada),
    '9 223 555-010',
    '223 555-012',
    '13105550107',
    '+1 310 555 0108',
    '+54 223 555-0101',
    '15 555-0101',
    '555-0101',
    '5550101',
    '545-1180',
    '00 54 9 223 555-0101',
    '0223 555-0101',
    '9 15 555-0101',
    'sin números',
    '',
  ]

  it.each(ENTRADAS)('%j da lo mismo en el front y en las funciones', (entrada) => {
    expect(normalizarEnFunciones(entrada)).toBe(normalizarTelefonoAR(entrada))
  })
})
