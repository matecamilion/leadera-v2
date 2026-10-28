import { describe, expect, it, vi } from 'vitest'

// Los dos módulos crean el cliente de Supabase al importarse y sin variables de
// entorno lanza; acá sólo se prueban funciones puras.
vi.mock('../supabase', () => ({ supabase: {} }))

import { mismaMoneda } from '../moneda'
import { leSirve, type FilaBusqueda, type FilaPropiedad } from './dashboard'
import { precioEntra, textoRango } from './detalleMatch'

describe('mismaMoneda', () => {
  it('iguales', () => {
    expect(mismaMoneda('ARS', 'ARS')).toBe(true)
  })
  it('distintas', () => {
    expect(mismaMoneda('ARS', 'USD')).toBe(false)
  })
  it('null cuenta como USD', () => {
    expect(mismaMoneda(null, 'USD')).toBe(true)
    expect(mismaMoneda('USD', undefined)).toBe(true)
    expect(mismaMoneda(null, 'ARS')).toBe(false)
  })
})

describe('precioEntra', () => {
  it('misma moneda y precio dentro del rango', () => {
    expect(precioEntra(100_000, 80_000, 120_000, 'USD', 'USD')).toBe(true)
  })
  it('misma moneda y precio fuera del rango', () => {
    expect(precioEntra(200_000, 80_000, 120_000, 'USD', 'USD')).toBe(false)
  })
  it('distinta moneda: el número cae adentro pero no entra', () => {
    expect(precioEntra(100_000, 80_000, 120_000, 'ARS', 'USD')).toBe(false)
  })
  it('moneda null de los dos lados cuenta como USD', () => {
    expect(precioEntra(100_000, 80_000, 120_000, null, null)).toBe(true)
  })
  it('moneda null de un lado contra ARS no entra', () => {
    expect(precioEntra(100_000, 80_000, 120_000, null, 'ARS')).toBe(false)
  })
  it('propiedad sin precio no entra', () => {
    expect(precioEntra(null, 80_000, 120_000, 'USD', 'USD')).toBe(false)
  })
})

describe('textoRango', () => {
  it('rango completo con la moneda', () => {
    expect(textoRango(80_000, 120_000, 'ARS')).toBe('ARS 80.000 - 120.000')
  })
  it('sólo mínimo y sólo máximo', () => {
    expect(textoRango(80_000, null, 'USD')).toBe('Desde USD 80.000')
    expect(textoRango(null, 120_000, 'USD')).toBe('Hasta USD 120.000')
  })
  it('moneda null se muestra como USD', () => {
    expect(textoRango(null, 120_000, null)).toBe('Hasta USD 120.000')
  })
  it('sin rango', () => {
    expect(textoRango(null, null, 'USD')).toBe('Sin preferencia')
  })
})

const propiedad = (moneda: string, precio: number | null = 100_000): FilaPropiedad => ({
  id: 'p',
  inmobiliaria_id: 'i',
  direccion: 'Calle 1',
  zona: null,
  tipo: 'DEPARTAMENTO',
  precio,
  moneda,
  estado: 'DISPONIBLE',
})

const busqueda = (moneda: string | null, min: number | null, max: number | null): FilaBusqueda => ({
  id: 'b',
  inmobiliaria_id: 'i',
  tipo_propiedad: null,
  zona: null,
  precio_min: min,
  precio_max: max,
  moneda,
  ambientes_min: null,
  lead: null,
})

describe('leSirve', () => {
  it('misma moneda y precio dentro del rango', () => {
    expect(leSirve(propiedad('USD'), busqueda('USD', 80_000, 120_000))).toBe(true)
  })
  it('distinta moneda con rango de precio: no sirve', () => {
    expect(leSirve(propiedad('ARS'), busqueda('USD', 80_000, 120_000))).toBe(false)
  })
  it('moneda null de la búsqueda cuenta como USD', () => {
    expect(leSirve(propiedad('USD'), busqueda(null, 80_000, 120_000))).toBe(true)
    expect(leSirve(propiedad('ARS'), busqueda(null, 80_000, 120_000))).toBe(false)
  })
  it('búsqueda sin rango de precio sirve en cualquier moneda', () => {
    expect(leSirve(propiedad('ARS'), busqueda('USD', null, null))).toBe(true)
  })
  it('propiedad sin precio no evalúa el rango ni la moneda', () => {
    expect(leSirve(propiedad('ARS', null), busqueda('USD', 80_000, 120_000))).toBe(true)
  })
})
