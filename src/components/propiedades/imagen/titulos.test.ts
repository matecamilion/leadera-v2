import { describe, expect, it } from 'vitest'
import {
  MAX_SUBTITULO,
  MAX_TITULO,
  subtituloInicial,
  tituloEfectivo,
  tituloInicial,
} from './titulos'

describe('tituloInicial', () => {
  it('arranca con la zona', () => {
    expect(tituloInicial('  Chauvín ', 'Av. Colón 1234')).toBe('Chauvín')
  })

  it('sin zona arranca con la dirección', () => {
    expect(tituloInicial(null, ' Av. Colón 1234 ')).toBe('Av. Colón 1234')
    expect(tituloInicial('   ', 'Av. Colón 1234')).toBe('Av. Colón 1234')
  })

  it('si no entra en el máximo queda vacío', () => {
    expect(tituloInicial('x'.repeat(MAX_TITULO), '')).toHaveLength(MAX_TITULO)
    expect(tituloInicial('x'.repeat(MAX_TITULO + 1), '')).toBe('')
  })
})

describe('subtituloInicial', () => {
  it('arranca con el tipo', () => {
    expect(subtituloInicial('Departamento', 'Chauvín')).toBe('Departamento')
  })

  it('no repite el título, sin importar tildes, mayúsculas ni espacios', () => {
    expect(subtituloInicial('Casa', ' casa ')).toBe('')
    expect(subtituloInicial('Cochera', 'COCHERA')).toBe('')
  })

  it('si no entra en el máximo queda vacío', () => {
    expect(subtituloInicial('x'.repeat(MAX_SUBTITULO + 1), 'Chauvín')).toBe('')
  })
})

describe('tituloEfectivo', () => {
  it('usa el título escrito', () => {
    expect(tituloEfectivo(' Mi título ', 'Chauvín', 'Av. Colón 1234')).toBe('Mi título')
  })

  it('con el título vacío muestra la zona', () => {
    expect(tituloEfectivo('  ', ' Chauvín ', 'Av. Colón 1234')).toBe('Chauvín')
  })

  it('sin zona muestra la dirección', () => {
    expect(tituloEfectivo('', null, ' Av. Colón 1234 ')).toBe('Av. Colón 1234')
    expect(tituloEfectivo('', '  ', 'Av. Colón 1234')).toBe('Av. Colón 1234')
  })
})
