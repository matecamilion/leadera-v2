import { describe, expect, it } from 'vitest'
import {
  esTelefonoConfiable,
  formatearInternacional,
  linkWhatsAppInternacional,
  normalizarCelularRegistro,
  normalizarTelefonoAR,
} from './telefono'
// La copia que usan las Edge Functions (Deno): tiene que dar lo mismo que el front.
import {
  esTelefonoConfiable as esConfiableEnFunciones,
  normalizarCelularRegistro as celularEnFunciones,
  normalizarTelefonoAR as normalizarEnFunciones,
} from '../../supabase/functions/_shared/telefono'

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

  it.each(ENTRADAS)('%j: esTelefonoConfiable también coincide', (entrada) => {
    expect(esConfiableEnFunciones(entrada)).toBe(esTelefonoConfiable(entrada))
  })
})

describe('esTelefonoConfiable', () => {
  it.each([
    '223 555-0101',
    '114 555-0105',
    '+54 9 223 555-0103',
    '9 11 4555-0104',
    '0223 15 555-0106',
  ])(
    '%s es confiable',
    (entrada) => {
      expect(esTelefonoConfiable(entrada)).toBe(true)
    },
  )

  it.each([
    '223 555-012',
    '13105550107',
    '+1 310 555 0108',
    // Normaliza a 5499223555010: 13 dígitos, pero el área no puede empezar con 9.
    '9 223 555-010',
    'sin números',
    '',
  ])(
    '%j no es confiable',
    (entrada) => {
      expect(esTelefonoConfiable(entrada)).toBe(false)
    },
  )
})

describe('normalizarCelularRegistro', () => {
  it.each([
    ['2235551234', '+5492235551234'],
    ['223 555-1234', '+5492235551234'],
    ['11 5555 1234', '+5491155551234'],
    ['0223 15 555 1234', '+5492235551234'],
    ['+54 9 223 555 1234', '+5492235551234'],
    ['+54 223 555 1234', '+5492235551234'],
    ['54 9 223 555 1234', '+5492235551234'],
    ['0054 9 223 555 1234', '+5492235551234'],
    ['9 223 555 1234', '+5492235551234'],
    ['+598 99 123 456', '+59899123456'],
    ['+1 310 555 0108', '+13105550108'],
  ])('%s -> %s', (entrada, esperado) => {
    expect(normalizarCelularRegistro(entrada)).toEqual({ ok: true, e164: esperado })
  })

  it('un abonado sin código de área se rechaza y no se completa con 223', () => {
    for (const entrada of ['5551234', '555-1234', '15 555 1234', '15 5555 1234']) {
      const r = normalizarCelularRegistro(entrada)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.motivo).toMatch(/código de área/)
    }
  })

  it('vacío o sin dígitos se rechaza', () => {
    expect(normalizarCelularRegistro('').ok).toBe(false)
    expect(normalizarCelularRegistro('   ').ok).toBe(false)
    expect(normalizarCelularRegistro('sin número').ok).toBe(false)
  })

  it('largos imposibles se rechazan', () => {
    for (const entrada of [
      '223 555 12345678',
      '+54 223 555',
      '+54 9 223 555 12345',
      '+1234567',
      '+1234567890123456',
      '+0 223 555 1234',
      '9 223 555 123',
    ]) {
      expect(normalizarCelularRegistro(entrada).ok).toBe(false)
    }
  })

  it('un área que empieza con 9 no es argentina', () => {
    expect(normalizarCelularRegistro('+54 9 923 555 1234').ok).toBe(false)
  })

  it('todo lo que acepta cumple el patrón del CHECK de la base', () => {
    for (const entrada of ['2235551234', '+598 99 123 456', '11 5555 1234', '+1 310 555 0108']) {
      const r = normalizarCelularRegistro(entrada)
      expect(r.ok && /^\+[1-9][0-9]{7,14}$/.test(r.e164)).toBe(true)
    }
  })

  it('es idempotente: lo guardado se vuelve a leer igual', () => {
    for (const entrada of ['2235551234', '+598 99 123 456', '11 5555 1234']) {
      const r = normalizarCelularRegistro(entrada)
      if (!r.ok) throw new Error('debería ser válido')
      expect(normalizarCelularRegistro(r.e164)).toEqual(r)
      expect(normalizarCelularRegistro(formatearInternacional(r.e164))).toEqual(r)
    }
  })

  it('no cambia normalizarTelefonoAR: sigue completando con 223 para los leads', () => {
    expect(normalizarTelefonoAR('5551234')).toBe('5492235551234')
  })
})

describe('las dos copias de normalizarCelularRegistro', () => {
  const ENTRADAS = [
    '2235551234',
    '223 555-1234',
    '11 5555 1234',
    '5551234',
    '0223 15 555 1234',
    '+54 9 223 555 1234',
    '+598 99 123 456',
    '+1 310 555 0108',
    '54 9 223 555 1234',
    '0054 9 223 555 1234',
    '9 223 555 1234',
    '15 555 1234',
    '+54 9 923 555 1234',
    '+0 223 555 1234',
    '+1234567890123456',
    'sin número',
    '',
    '   ',
  ]

  it.each(ENTRADAS)('%j da lo mismo en el front y en las funciones', (entrada) => {
    expect(celularEnFunciones(entrada)).toEqual(normalizarCelularRegistro(entrada))
  })
})

describe('formatearInternacional', () => {
  it('agrupa un celular argentino', () => {
    expect(formatearInternacional('+5492235551234')).toBe('+54 9 223 555 1234')
    expect(formatearInternacional('+5491155551234')).toBe('+54 9 11 5555 1234')
  })

  it('deja igual lo que no es un celular argentino', () => {
    expect(formatearInternacional('+59899123456')).toBe('+59899123456')
  })
})

describe('linkWhatsAppInternacional', () => {
  it('arma el link sin tocar el número', () => {
    expect(linkWhatsAppInternacional('+5492235551234')).toBe('https://wa.me/5492235551234')
    expect(linkWhatsAppInternacional('+59899123456')).toBe('https://wa.me/59899123456')
  })

  it('con algo que no es internacional no arma link', () => {
    expect(linkWhatsAppInternacional('')).toBe('')
    expect(linkWhatsAppInternacional('223 555 1234')).toBe('')
  })
})
