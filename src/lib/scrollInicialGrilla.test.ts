import { describe, expect, it } from 'vitest'
import { minutosInicialesDeScroll, scrollInicialPx } from './scrollInicialGrilla'

const h = (hora: number, min = 0) => hora * 60 + min

describe('minutosInicialesDeScroll', () => {
  describe('hoy no se ve', () => {
    it('sin eventos: 6:30', () => {
      expect(minutosInicialesDeScroll({ primerEventoMin: null, ahoraMin: null })).toBe(h(6, 30))
    })
    it('con un evento más temprano que las 7:00: 30 min antes de él', () => {
      expect(minutosInicialesDeScroll({ primerEventoMin: h(5), ahoraMin: null })).toBe(h(4, 30))
    })
    it('con eventos solo más tarde: sigue en 6:30', () => {
      expect(minutosInicialesDeScroll({ primerEventoMin: h(15), ahoraMin: null })).toBe(h(6, 30))
    })
    it('un evento a las 0:10 no da un scroll negativo', () => {
      expect(minutosInicialesDeScroll({ primerEventoMin: 10, ahoraMin: null })).toBe(0)
    })
  })

  describe('hoy se ve', () => {
    it('antes de las 7:00: la lógica de siempre', () => {
      expect(minutosInicialesDeScroll({ primerEventoMin: null, ahoraMin: h(6, 15) })).toBe(h(6, 30))
      expect(minutosInicialesDeScroll({ primerEventoMin: h(5), ahoraMin: h(6, 15) })).toBe(h(4, 30))
    })
    it('justo a las 7:00 todavía no cuenta como posterior', () => {
      expect(minutosInicialesDeScroll({ primerEventoMin: null, ahoraMin: h(7) })).toBe(h(6, 30))
    })
    it('después de las 7:00: una hora antes de la hora actual', () => {
      expect(minutosInicialesDeScroll({ primerEventoMin: null, ahoraMin: h(7, 1) })).toBe(h(6, 1))
      expect(minutosInicialesDeScroll({ primerEventoMin: null, ahoraMin: h(15, 20) })).toBe(h(14, 20))
    })
    it('después de las 7:00 con un evento más temprano: manda la hora actual', () => {
      expect(minutosInicialesDeScroll({ primerEventoMin: h(5), ahoraMin: h(15) })).toBe(h(14))
    })
  })
})

describe('scrollInicialPx', () => {
  it('pasa los minutos a px con la escala de la grilla', () => {
    expect(scrollInicialPx({ primerEventoMin: null, ahoraMin: null })).toBe(364)
    expect(scrollInicialPx({ primerEventoMin: null, ahoraMin: h(15) })).toBe(14 * 56)
  })
})
