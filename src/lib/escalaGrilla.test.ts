import { describe, expect, it } from 'vitest'
import {
  ALTO_TOTAL,
  GROSOR_LINEA_AHORA,
  posicionLineaAhora,
  PX_POR_HORA,
  pxDeMinutos,
} from './escalaGrilla'

describe('escala de la grilla', () => {
  it('56px por hora y 24 horas', () => {
    expect(PX_POR_HORA).toBe(56)
    expect(ALTO_TOTAL).toBe(1344)
    expect(pxDeMinutos(0)).toBe(0)
    expect(pxDeMinutos(60)).toBe(56)
    expect(pxDeMinutos(30)).toBe(28)
  })
})

describe('posicionLineaAhora', () => {
  it('a las 0:00 no se sale por arriba', () => {
    expect(posicionLineaAhora(0)).toBe(0)
  })

  it('a las 7:00 queda centrada sobre esa hora (392px)', () => {
    expect(posicionLineaAhora(7 * 60)).toBe(392 - GROSOR_LINEA_AHORA / 2)
  })

  it('a las 23:59 no se sale por abajo', () => {
    expect(posicionLineaAhora(23 * 60 + 59) + GROSOR_LINEA_AHORA).toBeLessThanOrEqual(ALTO_TOTAL)
  })

  it('nunca se sale del eje, minuto por minuto', () => {
    for (let m = 0; m < 24 * 60; m++) {
      const top = posicionLineaAhora(m)
      expect(top).toBeGreaterThanOrEqual(0)
      expect(top + GROSOR_LINEA_AHORA).toBeLessThanOrEqual(ALTO_TOTAL)
    }
  })

  it('crece con la hora', () => {
    expect(posicionLineaAhora(13 * 60)).toBeGreaterThan(posicionLineaAhora(12 * 60))
  })
})
