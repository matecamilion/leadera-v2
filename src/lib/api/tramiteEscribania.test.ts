import { describe, expect, it, vi } from 'vitest'

// El módulo crea el cliente de Supabase al importarse y sin variables de entorno
// lanza. Acá solo se prueba lo puro.
vi.mock('../supabase', () => ({ supabase: {} }))

import {
  cambiosDeEscribania,
  mensajeDeErrorTramite,
  MENSAJE_DATOS_ESCRIBANIA_INVALIDOS,
} from './tramite'

describe('cambiosDeEscribania', () => {
  it('manda las tres columnas', () => {
    expect(
      cambiosDeEscribania({
        escribania_nombre: 'Pérez',
        presupuesto_monto: 1500.5,
        presupuesto_moneda: 'ARS',
      }),
    ).toEqual({ escribania_nombre: 'Pérez', presupuesto_monto: 1500.5, presupuesto_moneda: 'ARS' })
  })

  it('sin valor manda null, no undefined: las tres claves existen', () => {
    const cambios = cambiosDeEscribania({
      escribania_nombre: null,
      presupuesto_monto: null,
      presupuesto_moneda: null,
    })
    expect(Object.keys(cambios).sort()).toEqual([
      'escribania_nombre',
      'presupuesto_moneda',
      'presupuesto_monto',
    ])
    expect(cambios.escribania_nombre).toBeNull()
    expect(cambios.presupuesto_monto).toBeNull()
    expect(cambios.presupuesto_moneda).toBeNull()
  })

  it('aunque llegue undefined (dato mal tipado), se manda null', () => {
    const cambios = cambiosDeEscribania({} as never)
    expect(cambios).toEqual({
      escribania_nombre: null,
      presupuesto_monto: null,
      presupuesto_moneda: null,
    })
    // En el cuerpo del pedido las tres claves viajan; undefined se omitiría.
    expect(JSON.stringify(cambios)).toBe(
      '{"escribania_nombre":null,"presupuesto_monto":null,"presupuesto_moneda":null}',
    )
  })

  it('no toca el estado del paso: no completa ni marca "no aplica"', () => {
    const cambios = cambiosDeEscribania({
      escribania_nombre: 'X',
      presupuesto_monto: 1,
      presupuesto_moneda: 'USD',
    })
    expect(cambios).not.toHaveProperty('fecha_completado')
    expect(cambios).not.toHaveProperty('no_aplica')
    expect(cambios).not.toHaveProperty('completado_por')
  })
})

describe('mensajeDeErrorTramite con un CHECK de la base', () => {
  it('23514 explica que los datos de la escribanía no son válidos', () => {
    expect(mensajeDeErrorTramite({ code: '23514', message: 'violates check constraint' })).toBe(
      MENSAJE_DATOS_ESCRIBANIA_INVALIDOS,
    )
  })
})
