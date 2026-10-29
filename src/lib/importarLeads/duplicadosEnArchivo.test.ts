import { describe, expect, it } from 'vitest'
import { marcarDuplicadosEnArchivo } from './duplicadosEnArchivo'
import type { FilaCruda } from './leerArchivo'
import { normalizarFilas } from './normalizarFilas'

/** nombre, teléfono, email -> filas normalizadas, numeradas desde la 2. */
function armar(filas: [string | null, string | null, string | null][]) {
  const crudas: FilaCruda[] = filas.map((valores, i) => ({
    numeroFilaOriginal: i + 2,
    celdas: { 0: valores[0], 1: valores[1], 2: valores[2] },
  }))
  return normalizarFilas(crudas, { nombre: 0, telefono: 1, email: 2 })
}

describe('marcarDuplicadosEnArchivo', () => {
  it('detecta el mismo teléfono escrito de formas distintas', () => {
    const r = marcarDuplicadosEnArchivo(
      armar([
        ['Ana', '223 555-0101', null],
        ['Ana G', '+54 9 223 555-0101', null],
        ['Ana H', '0223 15 555-0101', null],
        ['Luis', '223 555-0102', null],
      ]),
    )
    expect(r.map((f) => f.duplicadoEnArchivo)).toEqual([
      null,
      { duplicaA: 2, por: 'TELEFONO' },
      { duplicaA: 2, por: 'TELEFONO' },
      null,
    ])
  })

  it('detecta el mismo email sin importar mayúsculas', () => {
    const r = marcarDuplicadosEnArchivo(
      armar([
        ['Ana', null, 'ana@ejemplo.com'],
        ['Ana G', null, 'ANA@Ejemplo.com'],
      ]),
    )
    expect(r[1].duplicadoEnArchivo).toEqual({ duplicaA: 2, por: 'EMAIL' })
  })

  it('el teléfono tiene prioridad sobre el email', () => {
    const r = marcarDuplicadosEnArchivo(
      armar([
        ['Ana', '2235550101', 'a@x.com'],
        ['Beto', '2235550102', 'b@x.com'],
        ['Ana bis', '2235550102', 'a@x.com'],
      ]),
    )
    expect(r[2].duplicadoEnArchivo).toEqual({ duplicaA: 3, por: 'TELEFONO' })
  })

  it('gana la primera y cada duplicada apunta a ella', () => {
    const r = marcarDuplicadosEnArchivo(
      armar([
        ['A', '2235550101', null],
        ['B', null, 'x@x.com'],
        ['C', '2235550101', null],
        ['D', null, 'x@x.com'],
      ]),
    )
    expect(r.map((f) => f.duplicadoEnArchivo?.duplicaA ?? null)).toEqual([null, null, 2, 3])
  })

  it('los teléfonos dudosos no se comparan entre sí', () => {
    const r = marcarDuplicadosEnArchivo(
      armar([
        ['A', '+1 310 555 0108', null],
        ['B', '+1 310 555 0108', null],
      ]),
    )
    expect(r.map((f) => f.duplicadoEnArchivo)).toEqual([null, null])
  })

  it('dos dudosos con el mismo email sí se marcan por email', () => {
    const r = marcarDuplicadosEnArchivo(
      armar([
        ['A', '+1 310 555 0108', 'a@x.com'],
        ['B', '+1 310 555 0108', 'a@x.com'],
      ]),
    )
    expect(r[1].duplicadoEnArchivo).toEqual({ duplicaA: 2, por: 'EMAIL' })
  })

  it('las filas sin teléfono ni email nunca se marcan', () => {
    const r = marcarDuplicadosEnArchivo(
      armar([
        ['Ana', null, null],
        ['Ana', null, null],
      ]),
    )
    expect(r.map((f) => f.duplicadoEnArchivo)).toEqual([null, null])
  })

  it('una fila con error bloqueante no gana ni se marca', () => {
    const r = marcarDuplicadosEnArchivo(
      armar([
        [null, '2235550101', null],
        ['Ana', '2235550101', null],
      ]),
    )
    expect(r[0].errores).toHaveLength(1)
    expect(r.map((f) => f.duplicadoEnArchivo)).toEqual([null, null])
  })

  it('una duplicada registra sus datos a nombre de la primera para las siguientes', () => {
    // Antes la C quedaba como otro lead con un email que la A ya había ganado.
    const r = marcarDuplicadosEnArchivo(
      armar([
        ['A', '2235550101', null],
        ['B', '2235550101', 'b@x.com'],
        ['C', null, 'b@x.com'],
      ]),
    )
    expect(r[2].duplicadoEnArchivo).toEqual({ duplicaA: 2, por: 'EMAIL' })
    expect(r[0].email).toBe('b@x.com')
    expect(r[0].consultasFusionadas).toBe(2)
  })

  it('no muta las filas de entrada', () => {
    const filas = armar([['A', '2235550101', null]])
    marcarDuplicadosEnArchivo(filas)
    expect('duplicadoEnArchivo' in filas[0]).toBe(false)
  })
})
