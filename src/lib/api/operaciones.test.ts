import { describe, expect, it, vi } from 'vitest'

// El módulo crea el cliente de Supabase al importarse y sin variables de entorno
// lanza. Sin sesión, `crearReserva` corta en la primera lectura: alcanza para ver
// si el monto la frenó antes.
vi.mock('../supabase', () => ({
  supabase: { auth: { getUser: async () => ({ data: { user: null }, error: null }) } },
}))

import {
  crearReserva,
  limitesDelMes,
  llevaEscritura,
  MENSAJE_MONTO_RESERVA,
  puntaDeTipo,
  seMuestraTramite,
  tipoDeReserva,
  type CrearReservaInput,
} from './operaciones'

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

describe('llevaEscritura', () => {
  it('la compraventa pasa por escribanía, en las dos puntas', () => {
    expect(llevaEscritura('VENTA')).toBe(true)
    expect(llevaEscritura('COMPRA')).toBe(true)
  })

  it('el alquiler no', () => {
    expect(llevaEscritura('ALQUILER')).toBe(false)
    expect(llevaEscritura('BUSQUEDA_ALQUILER')).toBe(false)
  })
})

describe('seMuestraTramite', () => {
  it('hay trámite desde la reserva y después del cierre', () => {
    expect(seMuestraTramite('VENTA', 'RESERVADA')).toBe(true)
    expect(seMuestraTramite('COMPRA', 'CERRADA_GANADA')).toBe(true)
  })

  it('no hay antes de reservar ni cuando se cancela', () => {
    expect(seMuestraTramite('VENTA', 'PUBLICADA')).toBe(false)
    expect(seMuestraTramite('VENTA', 'EN_NEGOCIACION')).toBe(false)
    expect(seMuestraTramite('COMPRA', 'CANCELADA')).toBe(false)
  })

  it('no hay en el alquiler, cualquiera sea el estado', () => {
    expect(seMuestraTramite('ALQUILER', 'RESERVADA')).toBe(false)
    expect(seMuestraTramite('BUSQUEDA_ALQUILER', 'CERRADA_GANADA')).toBe(false)
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

describe('crearReserva: monto obligatorio', () => {
  const base: CrearReservaInput = {
    punta: 'vendedora',
    operacion: 'venta',
    titulo: 'Alvear 1890',
    fecha: '2026-10-28',
    monto: 100000,
  }

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['0', 0],
    ['negativo', -5],
    ['menor a 1', 0.5],
    ['NaN', Number.NaN],
    ['un texto', '100'],
  ])('rechaza un monto %s', async (_nombre, monto) => {
    await expect(
      crearReserva({ ...base, monto: monto as unknown as number }),
    ).rejects.toThrow(MENSAJE_MONTO_RESERVA)
  })

  it('con monto 1 pasa la validación y sigue con la sesión', async () => {
    await expect(crearReserva({ ...base, monto: 1 })).rejects.toThrow('Tu sesión expiró')
  })
})
