import { describe, expect, it } from 'vitest'
import { CAMPOS_FICHA, datosParaFicha, type OrigenFicha } from './datos'

const BASE: OrigenFicha = {
  direccion: 'Av. Colón 1234',
  zona: 'Centro',
  tipo: 'DEPARTAMENTO',
  precio: 120000,
  moneda: 'USD',
  ambientes: 3,
  banos: 2,
  cocheras: 1,
  metros_cubiertos: 70,
  metros_cuadrados: 80,
  disposicion: 'FRENTE',
  expensas: 85000,
  descripcion: 'Luminoso.',
  fotos_urls: ['https://x/1.jpg'],
}

/** Lo que trae una propiedad real de la base y la ficha NO puede mostrar. */
const PROHIBIDOS = {
  id: 'p1',
  agente_id: 'ag1',
  inmobiliaria_id: 'in1',
  lead_propietario: { id: 'l1', nombre: 'Marta', apellido: 'Pérez' },
  lead_propietario_id: 'l1',
  link_portal: 'https://portal.example/aviso/123',
  telefono: '+5492235551234',
  email: 'duena@example.com',
  observaciones: 'Llamar a la dueña',
}

describe('datosParaFicha', () => {
  it('devuelve exactamente los campos permitidos, ni uno más', () => {
    const datos = datosParaFicha(BASE, 'Inmobiliaria Sur')
    expect(Object.keys(datos).sort()).toEqual([...CAMPOS_FICHA].sort())
  })

  it('no deja pasar campos prohibidos aunque se le pase la propiedad completa', () => {
    const completa = { ...BASE, ...PROHIBIDOS } as OrigenFicha
    const datos = datosParaFicha(completa, 'Inmobiliaria Sur')

    for (const prohibido of Object.keys(PROHIBIDOS)) {
      expect(datos).not.toHaveProperty(prohibido)
    }
    // Y tampoco se cuelan en ningún valor, ni siquiera anidados.
    const serializado = JSON.stringify(datos)
    expect(serializado).not.toContain('Marta')
    expect(serializado).not.toContain('portal.example')
    expect(serializado).not.toContain('5492235551234')
    expect(serializado).not.toContain('duena@example.com')
    expect(serializado).not.toContain('ag1')
    expect(serializado).not.toContain('in1')
  })

  it('trae los campos nuevos', () => {
    const datos = datosParaFicha(BASE, 'Inmobiliaria Sur')
    expect(datos).toMatchObject({
      banos: 2,
      cocheras: 1,
      metros_cubiertos: 70,
      disposicion: 'FRENTE',
      expensas: 85000,
      inmobiliaria: 'Inmobiliaria Sur',
    })
  })

  it('sin fotos o sin inmobiliaria, usa valores vacíos y no rompe', () => {
    const datos = datosParaFicha({ ...BASE, fotos_urls: null }, '   ')
    expect(datos.fotos_urls).toEqual([])
    expect(datos.inmobiliaria).toBeNull()
    expect(datosParaFicha(BASE, null).inmobiliaria).toBeNull()
  })
})
