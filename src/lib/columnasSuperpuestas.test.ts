import { describe, expect, it } from 'vitest'
import { columnasSuperpuestas, MINUTOS_DEL_DIA } from './columnasSuperpuestas'

const hm = (h: number, m = 0) => h * 60 + m
const iv = (inicio: number, fin: number) => ({ inicio, fin })

describe('columnasSuperpuestas', () => {
  it('sin eventos devuelve una lista vacía', () => {
    expect(columnasSuperpuestas([])).toEqual([])
  })

  it('un evento solo ocupa toda la franja', () => {
    expect(columnasSuperpuestas([iv(hm(9), hm(9, 45))])).toEqual([{ columna: 0, columnas: 1 }])
  })

  it('sin superposición, cada uno ocupa su franja entera', () => {
    const r = columnasSuperpuestas([iv(hm(9), hm(9, 45)), iv(hm(11), hm(11, 30)), iv(hm(15), hm(16))])
    expect(r).toEqual([
      { columna: 0, columnas: 1 },
      { columna: 0, columnas: 1 },
      { columna: 0, columnas: 1 },
    ])
  })

  it('dos a la misma hora van lado a lado', () => {
    const r = columnasSuperpuestas([iv(hm(10), hm(10, 45)), iv(hm(10), hm(10, 30))])
    expect(r).toEqual([
      { columna: 0, columnas: 2 },
      { columna: 1, columnas: 2 },
    ])
  })

  it('tres en paralelo: tres columnas', () => {
    const r = columnasSuperpuestas([iv(hm(10), hm(10, 45)), iv(hm(10), hm(10, 45)), iv(hm(10, 15), hm(11))])
    expect(r.map((u) => u.columnas)).toEqual([3, 3, 3])
    expect(r.map((u) => u.columna).sort()).toEqual([0, 1, 2])
  })

  it('encadenados: A pisa B y B pisa C, pero A no pisa C. Forman un grupo y C reusa la columna de A', () => {
    const A = iv(hm(9), hm(9, 45))
    const B = iv(hm(9, 30), hm(10, 15))
    const C = iv(hm(10), hm(10, 45))
    expect(columnasSuperpuestas([A, B, C])).toEqual([
      { columna: 0, columnas: 2 },
      { columna: 1, columnas: 2 },
      { columna: 0, columnas: 2 },
    ])
  })

  it('un grupo no contagia a los que vienen después de que terminó', () => {
    const r = columnasSuperpuestas([
      iv(hm(9), hm(9, 45)),
      iv(hm(9, 30), hm(10, 15)),
      iv(hm(11), hm(11, 45)),
    ])
    expect(r[0].columnas).toBe(2)
    expect(r[1].columnas).toBe(2)
    expect(r[2]).toEqual({ columna: 0, columnas: 1 })
  })

  it('si el fin de uno es justo el inicio del otro, no se superponen', () => {
    const r = columnasSuperpuestas([iv(hm(10), hm(10, 30)), iv(hm(10, 30), hm(11))])
    expect(r).toEqual([
      { columna: 0, columnas: 1 },
      { columna: 0, columnas: 1 },
    ])
  })

  it('un minuto de solape ya es superposición', () => {
    const r = columnasSuperpuestas([iv(hm(10), hm(10, 31)), iv(hm(10, 30), hm(11))])
    expect(r.map((u) => u.columnas)).toEqual([2, 2])
  })

  it('recorta a las 24:00: uno que cruzaría la medianoche no pisa nada más allá', () => {
    // 23:45 + 45 min sería 24:30: se recorta a 24:00 y termina el día.
    const r = columnasSuperpuestas([iv(hm(23, 45), hm(23, 45) + 45), iv(hm(23, 50), hm(23, 50) + 30)])
    expect(r.map((u) => u.columnas)).toEqual([2, 2])
    expect(MINUTOS_DEL_DIA).toBe(1440)
  })

  it('un evento que termina pasadas las 24:00 se trata como si terminara a las 24:00', () => {
    // El segundo arranca a las 24:00 menos 1: se pisa con el primero hasta el borde.
    const solapa = columnasSuperpuestas([iv(hm(23, 30), 5000), iv(hm(23, 59), 6000)])
    expect(solapa.map((u) => u.columnas)).toEqual([2, 2])
  })

  it('un intervalo vacío dura un minuto y no se pisa con el que arranca justo después', () => {
    const r = columnasSuperpuestas([iv(hm(10), hm(10)), iv(hm(10, 1), hm(10, 30))])
    expect(r).toEqual([
      { columna: 0, columnas: 1 },
      { columna: 0, columnas: 1 },
    ])
  })

  it('desempate estable: a igual inicio, el que vino antes queda a la izquierda', () => {
    const iguales = [iv(hm(10), hm(10, 30)), iv(hm(10), hm(10, 30)), iv(hm(10), hm(10, 30))]
    expect(columnasSuperpuestas(iguales).map((u) => u.columna)).toEqual([0, 1, 2])
  })

  it('el resultado sigue el orden de la entrada aunque no venga ordenada por hora', () => {
    const r = columnasSuperpuestas([iv(hm(11), hm(11, 45)), iv(hm(9), hm(9, 45)), iv(hm(9, 30), hm(10, 15))])
    expect(r[0]).toEqual({ columna: 0, columnas: 1 })
    expect(r[1]).toEqual({ columna: 0, columnas: 2 })
    expect(r[2]).toEqual({ columna: 1, columnas: 2 })
  })

  it('no muta la entrada', () => {
    const entrada = [iv(hm(10), hm(10, 45)), iv(hm(9), hm(9, 45))]
    const copia = JSON.stringify(entrada)
    columnasSuperpuestas(entrada)
    expect(JSON.stringify(entrada)).toBe(copia)
  })
})
