import { describe, expect, it } from 'vitest'
import {
  asignarColumna,
  mapeoTieneNombre,
  normalizarEncabezado,
  sugerirMapeo,
} from './mapeoColumnas'

describe('normalizarEncabezado', () => {
  it('minúsculas, sin tildes ni signos', () => {
    expect(normalizarEncabezado('  Teléfono: ')).toBe('telefono')
    expect(normalizarEncabezado('E-mail')).toBe('e mail')
    expect(normalizarEncabezado('Nombre y Apellido')).toBe('nombre y apellido')
    expect(normalizarEncabezado('Fecha_de_Ingreso')).toBe('fecha de ingreso')
  })
})

describe('sugerirMapeo', () => {
  it('detecta una planilla típica', () => {
    const { mapeo, sinMapear } = sugerirMapeo([
      'Nombre',
      'Apellido',
      'Celular',
      'Mail',
      'Temperatura',
      'Fecha de ingreso',
      'Comentarios',
      'Barrio',
    ])
    expect(mapeo).toEqual({
      nombre: 0,
      apellido: 1,
      telefono: 2,
      email: 3,
      estado: 4,
      fechaIngreso: 5,
      descripcion: 6,
    })
    expect(sinMapear).toEqual([7])
  })

  it('"Nombre y apellido" y "Cliente" son nombre completo', () => {
    expect(sugerirMapeo(['Nombre y Apellido', 'WhatsApp']).mapeo).toEqual({
      nombreCompleto: 0,
      telefono: 1,
    })
    expect(sugerirMapeo(['Cliente', 'Tel']).mapeo.nombreCompleto).toBe(0)
  })

  it('reconoce variantes con tildes, signos y frases', () => {
    const { mapeo } = sugerirMapeo(['Teléfono particular', 'Correo electrónico', 'Observaciones'])
    expect(mapeo).toEqual({ telefono: 0, email: 1, descripcion: 2 })
  })

  it('una columna no se asigna a dos campos ni un campo toma dos columnas', () => {
    const { mapeo, sinMapear } = sugerirMapeo(['Teléfono', 'Teléfono alternativo', 'Celular'])
    // El exacto gana al "contiene" y las otras quedan sin mapear.
    expect(mapeo).toEqual({ telefono: 0 })
    expect(sinMapear).toEqual([1, 2])

    const columnas = Object.values(mapeo)
    expect(new Set(columnas).size).toBe(columnas.length)
  })

  it('a igual puntaje gana la columna de más a la izquierda', () => {
    expect(sugerirMapeo(['Celular', 'Whatsapp']).mapeo).toEqual({ telefono: 0 })
  })

  it('"fecha de nacimiento" no es la fecha de ingreso', () => {
    expect(sugerirMapeo(['Fecha de nacimiento']).mapeo).toEqual({})
    expect(sugerirMapeo(['Fecha', 'Fecha de nacimiento']).mapeo).toEqual({ fechaIngreso: 0 })
  })

  it('"Apellido y nombre" queda sin mapear para que lo decida el usuario', () => {
    expect(sugerirMapeo(['Apellido y Nombre']).mapeo).toEqual({})
  })

  it('encabezados vacíos no se mapean y cuentan como sin mapear', () => {
    const { mapeo, sinMapear } = sugerirMapeo(['', 'Nombre'])
    expect(mapeo).toEqual({ nombre: 1 })
    expect(sinMapear).toEqual([0])
  })
})

describe('mapeoTieneNombre', () => {
  it('con nombre o nombre completo', () => {
    expect(mapeoTieneNombre({ nombre: 0 })).toBe(true)
    expect(mapeoTieneNombre({ nombreCompleto: 3 })).toBe(true)
    expect(mapeoTieneNombre({ apellido: 1, telefono: 2 })).toBe(false)
  })
})

describe('asignarColumna', () => {
  it('mover una columna a otro campo se la saca al anterior', () => {
    expect(asignarColumna({ nombre: 0, telefono: 1 }, 'email', 1)).toEqual({ nombre: 0, email: 1 })
  })

  it('reasignar un campo reemplaza su columna', () => {
    expect(asignarColumna({ telefono: 1 }, 'telefono', 4)).toEqual({ telefono: 4 })
  })

  it('undefined deja el campo sin columna', () => {
    expect(asignarColumna({ nombre: 0, telefono: 1 }, 'telefono', undefined)).toEqual({ nombre: 0 })
  })

  it('no muta el mapeo original', () => {
    const original = { nombre: 0, telefono: 1 }
    asignarColumna(original, 'email', 1)
    expect(original).toEqual({ nombre: 0, telefono: 1 })
  })
})
