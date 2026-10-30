import { describe, expect, it } from 'vitest'
import { nombreDePorEnfriarse, textoDiasSinContacto } from './textoPorEnfriarse'

describe('nombreDePorEnfriarse', () => {
  it('une nombre y apellido', () => {
    expect(nombreDePorEnfriarse({ nombre: 'Ana', apellido: 'Paz' })).toBe('Ana Paz')
  })

  it('con apellido null muestra solo el nombre, sin "null"', () => {
    expect(nombreDePorEnfriarse({ nombre: 'Ana', apellido: null })).toBe('Ana')
  })
})

describe('textoDiasSinContacto', () => {
  it('singular y plural', () => {
    expect(textoDiasSinContacto(1)).toBe('Hace 1 día')
    expect(textoDiasSinContacto(29)).toBe('Hace 29 días')
  })
})
