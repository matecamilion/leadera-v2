import { describe, expect, it } from 'vitest'
import {
  esRegistroNuevo,
  MAX_REGISTROS_RECIENTES,
  registrosRecientes,
  type CuentaAdmin,
  type TipoCuenta,
} from './admin'

const AHORA = new Date('2026-11-01T12:00:00Z')
const HORA = 60 * 60 * 1000

function haceHoras(horas: number): string {
  return new Date(AHORA.getTime() - horas * HORA).toISOString()
}

function cuenta(id: string, horas: number, tipo: TipoCuenta = 'CLIENTE'): CuentaAdmin {
  return {
    id,
    nombre: `Inmobiliaria ${id}`,
    plan: 'SOLO',
    estado: 'TRIAL',
    tipoCuenta: tipo,
    metodoCobro: 'MERCADO_PAGO',
    accesoPagadoHasta: null,
    creadaEl: haceHoras(horas),
    finTrial: haceHoras(-24 * 14),
    proximoCobro: null,
    ultimoPagoFallido: null,
    cancelacionSolicitada: false,
    dueno: { nombre: 'Ana Pérez', email: 'ana@example.com', telefono: '+5492235550101' },
    ultimoPagoAprobado: null,
  }
}

describe('registrosRecientes', () => {
  it('deja las de los últimos 7 días y saca las más viejas', () => {
    const { lista, total } = registrosRecientes(
      [cuenta('a', 1), cuenta('b', 24 * 6), cuenta('c', 24 * 8)],
      AHORA,
    )
    expect(lista.map((c) => c.id)).toEqual(['a', 'b'])
    expect(total).toBe(2)
  })

  it('el límite de 7 días es inclusivo y se corta justo después', () => {
    const { lista } = registrosRecientes([cuenta('justo', 24 * 7), cuenta('pasada', 24 * 7 + 1)], AHORA)
    expect(lista.map((c) => c.id)).toEqual(['justo'])
  })

  it('las más nuevas primero, sin importar el orden de entrada', () => {
    const { lista } = registrosRecientes([cuenta('vieja', 100), cuenta('nueva', 2), cuenta('media', 50)], AHORA)
    expect(lista.map((c) => c.id)).toEqual(['nueva', 'media', 'vieja'])
  })

  it('excluye las cuentas INTERNA y TESTING', () => {
    const { lista, total } = registrosRecientes(
      [cuenta('cliente', 1), cuenta('interna', 1, 'INTERNA'), cuenta('testing', 1, 'TESTING')],
      AHORA,
    )
    expect(lista.map((c) => c.id)).toEqual(['cliente'])
    expect(total).toBe(1)
  })

  it('la lista se corta en 20 pero el total cuenta todas', () => {
    const muchas = Array.from({ length: 25 }, (_, i) => cuenta(`c${i}`, i + 1))
    const { lista, total } = registrosRecientes(muchas, AHORA)
    expect(lista).toHaveLength(MAX_REGISTROS_RECIENTES)
    expect(total).toBe(25)
    expect(lista[0].id).toBe('c0')
  })

  it('no modifica el arreglo que recibe', () => {
    const entrada = [cuenta('vieja', 100), cuenta('nueva', 2)]
    registrosRecientes(entrada, AHORA)
    expect(entrada.map((c) => c.id)).toEqual(['vieja', 'nueva'])
  })

  it('sin registros devuelve vacío', () => {
    expect(registrosRecientes([], AHORA)).toEqual({ total: 0, lista: [] })
  })
})

describe('esRegistroNuevo', () => {
  it('es nuevo con menos de 48 horas', () => {
    expect(esRegistroNuevo(cuenta('a', 47.9), AHORA)).toBe(true)
    expect(esRegistroNuevo(cuenta('b', 0), AHORA)).toBe(true)
  })

  it('a las 48 horas ya no', () => {
    expect(esRegistroNuevo(cuenta('a', 48), AHORA)).toBe(false)
    expect(esRegistroNuevo(cuenta('b', 24 * 5), AHORA)).toBe(false)
  })
})
