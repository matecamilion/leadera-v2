import { describe, expect, it } from 'vitest'
import { avisoDePostventa, sumarDias, sumarMeses, tareasDePostventa } from './postventa'

describe('sumarDias', () => {
  it('suma dentro del mes', () => {
    expect(sumarDias('2026-11-10', 1)).toBe('2026-11-11')
    expect(sumarDias('2026-11-10', 7)).toBe('2026-11-17')
  })

  it('cruza fin de mes y de año', () => {
    expect(sumarDias('2026-11-30', 1)).toBe('2026-12-01')
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01')
    expect(sumarDias('2026-12-28', 7)).toBe('2027-01-04')
  })

  it('respeta el 29 de febrero de los bisiestos', () => {
    expect(sumarDias('2028-02-28', 1)).toBe('2028-02-29')
    expect(sumarDias('2027-02-28', 1)).toBe('2027-03-01')
  })
})

describe('sumarMeses', () => {
  it('conserva el día cuando existe en el mes de destino', () => {
    expect(sumarMeses('2026-11-15', 1)).toBe('2026-12-15')
    expect(sumarMeses('2026-11-15', 6)).toBe('2027-05-15')
  })

  it('el 31/01 más un mes es el último día de febrero, no marzo', () => {
    expect(sumarMeses('2027-01-31', 1)).toBe('2027-02-28')
    expect(sumarMeses('2028-01-31', 1)).toBe('2028-02-29')
  })

  it('se queda en el último día de meses de 30', () => {
    expect(sumarMeses('2026-08-31', 1)).toBe('2026-09-30')
    expect(sumarMeses('2026-08-31', 6)).toBe('2027-02-28')
  })

  it('cruza el año', () => {
    expect(sumarMeses('2026-12-15', 1)).toBe('2027-01-15')
    expect(sumarMeses('2026-10-31', 6)).toBe('2027-04-30')
  })

  it('12 meses desde un 29/02 cae en el 28/02 del año siguiente', () => {
    expect(sumarMeses('2028-02-29', 12)).toBe('2029-02-28')
  })
})

describe('tareasDePostventa', () => {
  const base = {
    fechaEscritura: '2026-11-10',
    hoy: '2026-11-10',
    tipo: 'VENTA',
    cliente: null,
  } as const

  it('genera las cinco, en orden, a +1 día, +7 días, +1, +6 y +12 meses', () => {
    expect(tareasDePostventa(base).map((t) => t.fecha)).toEqual([
      '2026-11-11',
      '2026-11-17',
      '2026-12-10',
      '2027-05-10',
      '2027-11-10',
    ])
  })

  it('en el borde de mes usa el último día del mes de destino', () => {
    const tareas = tareasDePostventa({ ...base, fechaEscritura: '2027-01-31', hoy: '2027-01-31' })
    expect(tareas.map((t) => t.fecha)).toEqual([
      '2027-02-01',
      '2027-02-07',
      '2027-02-28',
      '2027-07-31',
      '2028-01-31',
    ])
  })

  it('descarta las que caen antes de hoy', () => {
    // Escritura de hace 10 días: el día 1 y la semana 1 ya pasaron.
    const tareas = tareasDePostventa({ ...base, fechaEscritura: '2026-10-31', hoy: '2026-11-10' })
    expect(tareas.map((t) => t.fecha)).toEqual(['2026-11-30', '2027-04-30', '2027-10-31'])
  })

  it('conserva la que cae hoy', () => {
    const tareas = tareasDePostventa({ ...base, fechaEscritura: '2026-11-09', hoy: '2026-11-10' })
    expect(tareas[0].fecha).toBe('2026-11-10')
    expect(tareas).toHaveLength(5)
  })

  it('con una escritura de hace más de un año no queda ninguna', () => {
    const tareas = tareasDePostventa({ ...base, fechaEscritura: '2025-01-15', hoy: '2026-11-10' })
    expect(tareas).toEqual([])
  })

  it('el título dice compra o venta según el tipo', () => {
    const venta = tareasDePostventa({ ...base, tipo: 'VENTA' })
    const compra = tareasDePostventa({ ...base, tipo: 'COMPRA' })
    expect(venta[2].titulo).toBe('Postventa: cómo se viene sintiendo con la venta')
    expect(compra[2].titulo).toBe('Postventa: cómo se viene sintiendo con la compra')
    expect(compra[3].titulo).toBe('Postventa: consultar cómo sigue todo a los 6 meses de la compra')
    expect(venta[4].titulo).toBe('Postventa: un año de la venta, pedir referidos')
  })

  it('los dos primeros títulos no dependen del tipo', () => {
    const [dia, semana] = tareasDePostventa(base)
    expect(dia.titulo).toBe('Postventa: preguntar cómo quedó todo tras la escritura')
    expect(semana.titulo).toBe('Postventa: seguimiento de la primera semana')
  })

  it('con cliente, cada título termina con su nombre', () => {
    const tareas = tareasDePostventa({ ...base, cliente: 'Ana Pérez' })
    expect(tareas.every((t) => t.titulo.endsWith(' — Ana Pérez'))).toBe(true)
    expect(tareas[0].titulo).toBe(
      'Postventa: preguntar cómo quedó todo tras la escritura — Ana Pérez',
    )
  })
})

describe('avisoDePostventa', () => {
  it('sin intento de generar, no hay aviso', () => {
    expect(avisoDePostventa(null)).toBeNull()
  })

  it('cuenta las tareas agendadas', () => {
    expect(avisoDePostventa(5)).toBe('Se agendaron 5 tareas de postventa')
    expect(avisoDePostventa(1)).toBe('Se agendó 1 tarea de postventa')
  })

  it('con cero, avisa que no se agendó nada y por qué', () => {
    expect(avisoDePostventa(0)).toContain('No se agendaron tareas de postventa')
    expect(avisoDePostventa(0)).toContain('ya pasaron')
  })
})
