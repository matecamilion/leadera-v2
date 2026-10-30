import { describe, expect, it } from 'vitest'
import { subtituloSinZona } from './subtitulo'

describe('subtituloSinZona', () => {
  it('saca el "en {zona}" del final', () => {
    expect(subtituloSinZona('Departamento en Chauvín', 'Chauvín')).toBe('Departamento')
  })

  it('compara sin tildes ni mayúsculas, pero conserva lo escrito', () => {
    expect(subtituloSinZona('Casa EN chauvin', 'Chauvín')).toBe('Casa')
    expect(subtituloSinZona('Casa en Güemes', 'GUEMES')).toBe('Casa')
  })

  it('con espacios de más sigue andando', () => {
    expect(subtituloSinZona('  PH   en   Playa Grande ', 'Playa  Grande')).toBe('PH')
  })

  it('si el título es sólo la zona, no queda subtítulo', () => {
    expect(subtituloSinZona('Chauvín', 'chauvin')).toBe('')
    expect(subtituloSinZona('en Chauvín', 'Chauvín')).toBe('')
  })

  it('no toca títulos donde la zona no está al final', () => {
    expect(subtituloSinZona('Depto en Chauvín, Mar del Plata', 'Chauvín')).toBe(
      'Depto en Chauvín, Mar del Plata',
    )
    expect(subtituloSinZona('Casa cerca de Chauvín', 'Chauvín')).toBe('Casa cerca de Chauvín')
    expect(subtituloSinZona('Departamento al frente', 'Chauvín')).toBe('Departamento al frente')
  })

  it('no confunde una zona más larga con la buscada', () => {
    expect(subtituloSinZona('Casa en Chauvín Norte', 'Chauvín')).toBe('Casa en Chauvín Norte')
  })

  it('sin zona devuelve el título', () => {
    expect(subtituloSinZona(' Casa en venta ', '')).toBe('Casa en venta')
  })
})
