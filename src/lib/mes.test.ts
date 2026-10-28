import { describe, expect, it } from 'vitest'
import { esMesFuturo, leerMes, mesAnterior, mesDeFecha, mesSiguiente } from './mes'

describe('mesDeFecha', () => {
  it('toma el año y el mes de una fecha', () => {
    expect(mesDeFecha('2026-10-28')).toBe('2026-10')
  })
})

describe('mesAnterior', () => {
  it('retrocede un mes', () => {
    expect(mesAnterior('2026-10')).toBe('2026-09')
  })

  it('enero retrocede a diciembre del año anterior', () => {
    expect(mesAnterior('2027-01')).toBe('2026-12')
  })
})

describe('mesSiguiente', () => {
  it('avanza un mes', () => {
    expect(mesSiguiente('2026-10')).toBe('2026-11')
  })

  it('diciembre avanza a enero del año siguiente', () => {
    expect(mesSiguiente('2026-12')).toBe('2027-01')
  })
})

describe('esMesFuturo', () => {
  it('el mes siguiente es futuro', () => {
    expect(esMesFuturo('2026-11', '2026-10')).toBe(true)
  })

  it('el mismo mes no es futuro', () => {
    expect(esMesFuturo('2026-10', '2026-10')).toBe(false)
  })

  it('compara también entre años', () => {
    expect(esMesFuturo('2027-01', '2026-12')).toBe(true)
    expect(esMesFuturo('2025-12', '2026-01')).toBe(false)
  })
})

describe('leerMes', () => {
  const actual = '2026-10'

  it('un mes pasado válido se respeta', () => {
    expect(leerMes('2026-03', actual)).toBe('2026-03')
  })

  it('el mes actual se respeta', () => {
    expect(leerMes('2026-10', actual)).toBe('2026-10')
  })

  it('sin valor cae en el mes actual', () => {
    expect(leerMes(null, actual)).toBe(actual)
    expect(leerMes('', actual)).toBe(actual)
  })

  it('un mes futuro cae en el mes actual', () => {
    expect(leerMes('2026-11', actual)).toBe(actual)
    expect(leerMes('2027-01', actual)).toBe(actual)
  })

  it('un formato raro cae en el mes actual', () => {
    for (const raro of ['2026-13', '2026-00', '2026-1', '26-10', 'octubre', '2026-10-01', ' 2026-10']) {
      expect(leerMes(raro, actual)).toBe(actual)
    }
  })
})
