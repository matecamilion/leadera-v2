import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ArchivoLeido } from '../../../lib/importarLeads/leerArchivo'

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('../../../lib/supabase', () => ({ supabase: { functions: { invoke } } }))

import { prepararRevision } from './revisar'

// Todo inventado.
const ARCHIVO: ArchivoLeido = {
  hoja: null,
  encabezados: ['Nombre y apellido', 'Celular', 'Email'],
  filas: [
    { numeroFilaOriginal: 2, celdas: { 0: 'Ana Gómez', 1: '223 555-0101', 2: null } },
    { numeroFilaOriginal: 3, celdas: { 0: 'Ana G', 1: '+54 9 223 555-0101', 2: null } }, // repite la 2
    { numeroFilaOriginal: 4, celdas: { 0: 'Luis', 1: null, 2: 'LUIS@ejemplo.com' } }, // ya en la cuenta
    { numeroFilaOriginal: 5, celdas: { 0: null, 1: '223 555-0105', 2: null } }, // sin nombre
    { numeroFilaOriginal: 6, celdas: { 0: 'Marta', 1: '223 555-0106', 2: null } },
  ],
}
const MAPEO = { nombreCompleto: 0, telefono: 1, email: 2 }

beforeEach(() => invoke.mockReset())

describe('prepararRevision', () => {
  it('normaliza, marca lo repetido y clasifica con lo que dice la cuenta', async () => {
    invoke.mockResolvedValueOnce({
      data: {
        resultados: [
          { fila: 2, duplicado: null },
          { fila: 4, duplicado: 'email' },
          { fila: 6, duplicado: null },
        ],
        cupo: { limite: 200, usados: 50 },
      },
      error: null,
    })

    const r = await prepararRevision(ARCHIVO, MAPEO)

    expect(r.filas).toHaveLength(5)
    expect(r.clasificacion.aImportar.map((f) => f.fila)).toEqual([2, 6])
    expect(r.clasificacion.duplicadasEnArchivo.map((f) => f.fila)).toEqual([3])
    expect(r.clasificacion.duplicadasEnBase.porEmail.map((f) => f.fila)).toEqual([4])
    expect(r.clasificacion.conError.map((f) => f.fila)).toEqual([5])
    expect(r.cupo).toEqual({ limite: 200, usados: 50 })
  })

  it('a la función solo le manda lo que hay que comparar: sin errores ni repetidos del archivo', async () => {
    invoke.mockResolvedValueOnce({ data: { resultados: [], cupo: { limite: null, usados: 0 } }, error: null })

    await prepararRevision(ARCHIVO, MAPEO)

    const { filas } = invoke.mock.calls[0][1].body
    expect(filas.map((f: { fila: number }) => f.fila)).toEqual([2, 4, 6])
    expect(Object.keys(filas[0]).sort()).toEqual(['email', 'fila', 'telefono'])
  })

  it('si no queda nada para comparar llama igual: el cupo se necesita', async () => {
    invoke.mockResolvedValueOnce({ data: { resultados: [], cupo: { limite: 10, usados: 10 } }, error: null })

    const soloErrores: ArchivoLeido = {
      ...ARCHIVO,
      filas: [{ numeroFilaOriginal: 2, celdas: { 0: null, 1: '223 555-0101', 2: null } }],
    }
    const r = await prepararRevision(soloErrores, MAPEO)

    expect(invoke).toHaveBeenCalledOnce()
    expect(invoke.mock.calls[0][1].body.filas).toEqual([])
    expect(r.cupo).toEqual({ limite: 10, usados: 10 })
  })

  it('si la verificación falla, lanza: no se avanza sin respuesta', async () => {
    invoke.mockResolvedValueOnce({ data: null, error: { message: 'Failed to send a request' } })
    await expect(prepararRevision(ARCHIVO, MAPEO)).rejects.toThrow('No se pudo verificar')
  })
})
