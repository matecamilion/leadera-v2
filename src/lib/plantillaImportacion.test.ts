import { describe, expect, it, vi } from 'vitest'
import { sugerirMapeo } from './importarLeads/mapeoColumnas'
import { ENCABEZADOS_PLANTILLA, construirLibroPlantilla } from './plantillaImportacion'

// La primera prueba que usa exceljs paga la carga en frío.
vi.setConfig({ testTimeout: 30_000 })

describe('plantilla de importación', () => {
  it('tiene los encabezados pedidos y una fila de ejemplo', async () => {
    const libro = await construirLibroPlantilla()
    const hoja = libro.worksheets[0]

    expect(hoja.getRow(1).values).toEqual([
      undefined,
      'Nombre',
      'Apellido',
      'Teléfono',
      'Email',
      'Estado',
      'Fecha de ingreso',
      'Descripción inicial',
    ])
    expect(hoja.rowCount).toBe(2)
  })

  it('el ejemplo es claramente falso', async () => {
    const libro = await construirLibroPlantilla()
    const ejemplo = libro.worksheets[0].getRow(2).values as unknown[]

    expect(String(ejemplo[1])).toBe('EJEMPLO')
    expect(String(ejemplo[4])).toMatch(/\.invalid$/)
  })

  it('sus encabezados se reconocen solos en el paso de columnas', () => {
    const { mapeo, sinMapear } = sugerirMapeo(ENCABEZADOS_PLANTILLA)

    expect(mapeo).toEqual({
      nombre: 0,
      apellido: 1,
      telefono: 2,
      email: 3,
      estado: 4,
      fechaIngreso: 5,
      descripcion: 6,
    })
    expect(sinMapear).toEqual([])
  })
})
