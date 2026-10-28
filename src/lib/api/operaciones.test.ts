import { describe, expect, it, vi } from 'vitest'

// El módulo crea el cliente de Supabase al importarse y sin variables de entorno
// lanza; acá sólo se prueban funciones puras.
vi.mock('../supabase', () => ({ supabase: {} }))

import { limitesDelMes, puntaDeTipo, tipoDeReserva } from './operaciones'

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

describe('puntaDeTipo', () => {
  it('VENTA y ALQUILER son punta vendedora', () => {
    expect(puntaDeTipo('VENTA')).toBe('vendedora')
    expect(puntaDeTipo('ALQUILER')).toBe('vendedora')
  })

  it('COMPRA y BUSQUEDA_ALQUILER son punta compradora', () => {
    expect(puntaDeTipo('COMPRA')).toBe('compradora')
    expect(puntaDeTipo('BUSQUEDA_ALQUILER')).toBe('compradora')
  })

  it('es la inversa de tipoDeReserva', () => {
    for (const punta of ['vendedora', 'compradora'] as const) {
      for (const clase of ['venta', 'alquiler'] as const) {
        expect(puntaDeTipo(tipoDeReserva(punta, clase))).toBe(punta)
      }
    }
  })
})

describe('limitesDelMes', () => {
  it('acepta el primer día de un mes (YYYY-MM-01), como lo arma la vista de reservas', () => {
    expect(limitesDelMes('2026-12-01')).toEqual({ desde: '2026-12-01', hasta: '2027-01-01' })
    expect(limitesDelMes('2027-01-01')).toEqual({ desde: '2027-01-01', hasta: '2027-02-01' })
  })

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
