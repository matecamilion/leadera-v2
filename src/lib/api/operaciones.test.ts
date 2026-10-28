import { describe, expect, it, vi } from 'vitest'

// El módulo crea el cliente de Supabase al importarse y sin variables de entorno
// lanza; acá sólo se prueban funciones puras.
vi.mock('../supabase', () => ({ supabase: {} }))

import { limitesDelMes, tipoDeReserva } from './operaciones'

describe('tipoDeReserva', () => {
  it('vendedora + venta es VENTA', () => {
    expect(tipoDeReserva('vendedora', 'venta')).toBe('VENTA')
  })

  it('vendedora + alquiler es ALQUILER', () => {
    expect(tipoDeReserva('vendedora', 'alquiler')).toBe('ALQUILER')
  })

  it('compradora + venta es COMPRA', () => {
    expect(tipoDeReserva('compradora', 'venta')).toBe('COMPRA')
  })

  it('compradora + alquiler es BUSQUEDA_ALQUILER', () => {
    expect(tipoDeReserva('compradora', 'alquiler')).toBe('BUSQUEDA_ALQUILER')
  })
})

describe('limitesDelMes', () => {
  it('va del primer día del mes al primero del siguiente', () => {
    expect(limitesDelMes('2026-10-28')).toEqual({ desde: '2026-10-01', hasta: '2026-11-01' })
  })

  it('el primer y el último día del mes caen en el mismo mes', () => {
    const esperado = { desde: '2026-10-01', hasta: '2026-11-01' }
    expect(limitesDelMes('2026-10-01')).toEqual(esperado)
    expect(limitesDelMes('2026-10-31')).toEqual(esperado)
  })

  it('diciembre termina en enero del año siguiente', () => {
    expect(limitesDelMes('2026-12-15')).toEqual({ desde: '2026-12-01', hasta: '2027-01-01' })
  })

  it('enero arranca en el 1 de enero y termina en febrero', () => {
    expect(limitesDelMes('2027-01-03')).toEqual({ desde: '2027-01-01', hasta: '2027-02-01' })
  })

  it('el cambio de mes cambia el rango', () => {
    expect(limitesDelMes('2026-11-01').desde).toBe('2026-11-01')
    expect(limitesDelMes('2026-10-31').desde).toBe('2026-10-01')
  })
})
