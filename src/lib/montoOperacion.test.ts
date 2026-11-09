import { describe, expect, it } from 'vitest'
import { etiquetaValorDeCierre, montoVigenteOperacion } from './montoOperacion'

const base = { moneda: 'USD', monto: 150, monto_cierre: null }

describe('montoVigenteOperacion', () => {
  it('cerrada con valor de cierre: es el de cierre, no el publicado', () => {
    expect(montoVigenteOperacion({ ...base, estado: 'CERRADA_GANADA', monto_cierre: 140 })).toEqual({
      valor: 140,
      moneda: 'USD',
      esDeCierre: true,
      esPublicadoDeCerrada: false,
    })
  })

  it('cerrada vieja sin valor de cierre: respaldo publicado, marcado', () => {
    expect(montoVigenteOperacion({ ...base, estado: 'CERRADA_GANADA' })).toEqual({
      valor: 150,
      moneda: 'USD',
      esDeCierre: false,
      esPublicadoDeCerrada: true,
    })
  })

  it('cerrada sin valor de cierre ni publicado: no hay nada que mostrar ni que marcar', () => {
    expect(montoVigenteOperacion({ ...base, estado: 'CERRADA_GANADA', monto: null })).toEqual({
      valor: null,
      moneda: 'USD',
      esDeCierre: false,
      esPublicadoDeCerrada: false,
    })
  })

  it.each(['PUBLICADA', 'RESERVADA', 'EN_NEGOCIACION', 'CANCELADA'] as const)(
    'reabierta o %s con valor de cierre conservado: se muestra el publicado',
    (estado) => {
      expect(montoVigenteOperacion({ ...base, estado, monto_cierre: 140 })).toEqual({
        valor: 150,
        moneda: 'USD',
        esDeCierre: false,
        esPublicadoDeCerrada: false,
      })
    },
  )

  it('abierta con monto null', () => {
    expect(montoVigenteOperacion({ ...base, estado: 'PUBLICADA', monto: null }).valor).toBeNull()
  })

  it('conserva la moneda de la operación', () => {
    expect(
      montoVigenteOperacion({ estado: 'CERRADA_GANADA', moneda: 'ARS', monto: 1, monto_cierre: 2 }).moneda,
    ).toBe('ARS')
  })
})

describe('etiquetaValorDeCierre', () => {
  it.each([
    ['VENTA', 'Valor de cierre'],
    ['COMPRA', 'Valor de cierre'],
    ['ALQUILER', 'Canon mensual acordado'],
    ['BUSQUEDA_ALQUILER', 'Canon mensual acordado'],
  ] as const)('%s → %s', (tipo, etiqueta) => {
    expect(etiquetaValorDeCierre(tipo)).toBe(etiqueta)
  })
})
