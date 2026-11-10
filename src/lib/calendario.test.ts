import { describe, expect, it } from 'vitest'
import { rangoDelMes } from './calendario'

describe('rangoDelMes', () => {
  it('primer y último día del mes, los dos incluidos', () => {
    expect(rangoDelMes('2026-11-12')).toEqual({ desde: '2026-11-01', hasta: '2026-11-30' })
    expect(rangoDelMes('2026-10-31')).toEqual({ desde: '2026-10-01', hasta: '2026-10-31' })
  })

  it('es el mismo para cualquier día del mes, incluidos los extremos', () => {
    for (const dia of ['2026-11-01', '2026-11-15', '2026-11-30']) {
      expect(rangoDelMes(dia)).toEqual({ desde: '2026-11-01', hasta: '2026-11-30' })
    }
  })

  it('diciembre termina el 31 sin pasar al año siguiente, y enero empieza en el 1', () => {
    expect(rangoDelMes('2026-12-15')).toEqual({ desde: '2026-12-01', hasta: '2026-12-31' })
    expect(rangoDelMes('2027-01-01')).toEqual({ desde: '2027-01-01', hasta: '2027-01-31' })
  })

  it('febrero, bisiesto y no bisiesto', () => {
    expect(rangoDelMes('2026-02-10').hasta).toBe('2026-02-28')
    expect(rangoDelMes('2028-02-10').hasta).toBe('2028-02-29')
    expect(rangoDelMes('2100-02-10').hasta).toBe('2100-02-28')
  })

  it('meses de 30 y de 31 días', () => {
    expect(rangoDelMes('2026-04-05').hasta).toBe('2026-04-30')
    expect(rangoDelMes('2026-07-05').hasta).toBe('2026-07-31')
  })
})
