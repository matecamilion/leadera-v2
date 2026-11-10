import { describe, expect, it } from 'vitest'
import { claveDia, diasDeLaGrilla } from './calendario'
import {
  diasDeLaSemana,
  finDeSemana,
  inicioDeSemana,
  mesDeAncla,
  moverAncla,
  rangoVisible,
  sumarDias,
  sumarMeses,
  tituloDeSemana,
  ubicarAlCambiarVista,
} from './vistaCalendario'

describe('sumarDias', () => {
  it('cruza el fin de mes', () => {
    expect(sumarDias('2026-01-31', 1)).toBe('2026-02-01')
    expect(sumarDias('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('cruza el fin de año en los dos sentidos', () => {
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01')
    expect(sumarDias('2027-01-01', -1)).toBe('2026-12-31')
  })

  it('respeta el 29 de febrero de un año bisiesto', () => {
    expect(sumarDias('2024-02-28', 1)).toBe('2024-02-29')
    expect(sumarDias('2024-02-29', 1)).toBe('2024-03-01')
    expect(sumarDias('2026-02-28', 1)).toBe('2026-03-01')
  })

  it('0 devuelve el mismo día', () => {
    expect(sumarDias('2026-08-05', 0)).toBe('2026-08-05')
  })
})

describe('sumarMeses', () => {
  it('va siempre al día 1 del mes destino', () => {
    expect(sumarMeses('2026-08-15', 1)).toBe('2026-09-01')
    expect(sumarMeses('2026-08-15', -1)).toBe('2026-07-01')
    expect(sumarMeses('2026-08-15', 0)).toBe('2026-08-01')
  })

  it('desde el 31 no se saltea febrero', () => {
    expect(sumarMeses('2026-01-31', 1)).toBe('2026-02-01')
    expect(sumarMeses('2024-01-31', 1)).toBe('2024-02-01')
  })

  it('cambia de año hacia adelante y hacia atrás', () => {
    expect(sumarMeses('2026-12-15', 1)).toBe('2027-01-01')
    expect(sumarMeses('2027-01-10', -1)).toBe('2026-12-01')
  })

  it('suma varios meses de una vez', () => {
    expect(sumarMeses('2026-11-20', 3)).toBe('2027-02-01')
    expect(sumarMeses('2026-02-01', -14)).toBe('2024-12-01')
  })
})

describe('semana de lunes a domingo', () => {
  it('un miércoles: lunes y domingo de esa semana', () => {
    // 2026-08-05 es miércoles.
    expect(inicioDeSemana('2026-08-05')).toBe('2026-08-03')
    expect(finDeSemana('2026-08-05')).toBe('2026-08-09')
  })

  it('un lunes es el inicio de su propia semana', () => {
    expect(inicioDeSemana('2026-08-03')).toBe('2026-08-03')
    expect(finDeSemana('2026-08-03')).toBe('2026-08-09')
  })

  it('un domingo es el fin de su propia semana, no el inicio de la siguiente', () => {
    expect(inicioDeSemana('2026-08-09')).toBe('2026-08-03')
    expect(finDeSemana('2026-08-09')).toBe('2026-08-09')
  })

  it('una semana que cruza dos meses', () => {
    // 2026-03-01 es domingo: la semana va del 23 de febrero al 1 de marzo.
    expect(inicioDeSemana('2026-03-01')).toBe('2026-02-23')
    expect(finDeSemana('2026-02-25')).toBe('2026-03-01')
  })

  it('una semana que cruza el fin de año', () => {
    // 2026-12-31 es jueves.
    expect(inicioDeSemana('2026-12-31')).toBe('2026-12-28')
    expect(finDeSemana('2026-12-31')).toBe('2027-01-03')
  })

  it('una semana con 29 de febrero', () => {
    // 2024-02-29 es jueves.
    expect(inicioDeSemana('2024-02-29')).toBe('2024-02-26')
    expect(finDeSemana('2024-02-29')).toBe('2024-03-03')
  })

  it('siempre da 7 días corridos de lunes a domingo', () => {
    for (const clave of ['2026-01-01', '2026-06-15', '2026-12-31', '2024-02-29']) {
      const lunes = inicioDeSemana(clave)
      expect(finDeSemana(clave)).toBe(sumarDias(lunes, 6))
      expect(new Date(`${lunes}T12:00:00`).getDay()).toBe(1)
    }
  })
})

describe('mesDeAncla', () => {
  it('ano y mes (0-11) de la ancla', () => {
    expect(mesDeAncla('2026-08-05')).toEqual({ ano: 2026, mes: 7 })
    expect(mesDeAncla('2027-01-01')).toEqual({ ano: 2027, mes: 0 })
    expect(mesDeAncla('2026-12-31')).toEqual({ ano: 2026, mes: 11 })
  })
})

describe('rangoVisible — MES', () => {
  /** El rango que se pedía antes: el de la grilla completa. */
  function rangoDeLaGrilla(ano: number, mes: number) {
    const dias = diasDeLaGrilla(ano, mes)
    return { desde: claveDia(dias[0]), hasta: claveDia(dias[dias.length - 1]) }
  }

  it('es exactamente el de diasDeLaGrilla para cualquier día de la ancla', () => {
    for (const ancla of ['2026-08-01', '2026-08-15', '2026-08-31']) {
      expect(rangoVisible('MES', ancla)).toEqual(rangoDeLaGrilla(2026, 7))
    }
  })

  it('coincide con la grilla en todos los meses de varios años', () => {
    for (const ano of [2024, 2025, 2026, 2027]) {
      for (let mes = 0; mes < 12; mes++) {
        const ancla = `${ano}-${String(mes + 1).padStart(2, '0')}-10`
        expect(rangoVisible('MES', ancla)).toEqual(rangoDeLaGrilla(ano, mes))
      }
    }
  })

  it('un mes que empieza en lunes no tiene relleno al principio', () => {
    // 2025-09-01 es lunes; el mes termina el martes 30 y la grilla cierra el domingo 5/10.
    expect(rangoVisible('MES', '2025-09-10')).toEqual({ desde: '2025-09-01', hasta: '2025-10-05' })
  })

  it('un mes que empieza en domingo arranca el lunes anterior', () => {
    // 2026-02-01 es domingo: la grilla arranca el lunes 26/1 y cierra el domingo 1/3.
    expect(rangoVisible('MES', '2026-02-14')).toEqual({ desde: '2026-01-26', hasta: '2026-03-01' })
  })

  it('un febrero bisiesto', () => {
    // 2024-02-01 es jueves y el 29 es jueves.
    expect(rangoVisible('MES', '2024-02-29')).toEqual({ desde: '2024-01-29', hasta: '2024-03-03' })
  })

  it('diciembre llega a enero del año siguiente', () => {
    const { desde, hasta } = rangoVisible('MES', '2026-12-15')
    expect(desde).toBe('2026-11-30')
    expect(hasta).toBe('2027-01-03')
  })

  it('navegar de a meses con sumarMeses da el rango del mes vecino', () => {
    expect(rangoVisible('MES', sumarMeses('2026-08-15', 1))).toEqual(rangoDeLaGrilla(2026, 8))
    expect(rangoVisible('MES', sumarMeses('2026-01-20', -1))).toEqual(rangoDeLaGrilla(2025, 11))
  })
})

describe('rangoVisible — DIA', () => {
  it('es el día de la ancla, de los dos lados', () => {
    expect(rangoVisible('DIA', '2026-08-05')).toEqual({ desde: '2026-08-05', hasta: '2026-08-05' })
    expect(rangoVisible('DIA', '2024-02-29')).toEqual({ desde: '2024-02-29', hasta: '2024-02-29' })
  })
})

describe('moverAncla', () => {
  it('en el mes mueve un mes y cae en su día 1', () => {
    expect(moverAncla('MES', '2026-08-15', 1)).toBe('2026-09-01')
    expect(moverAncla('MES', '2026-01-20', -1)).toBe('2025-12-01')
  })

  it('en el día mueve un día', () => {
    expect(moverAncla('DIA', '2026-08-15', 1)).toBe('2026-08-16')
    expect(moverAncla('DIA', '2026-08-15', -1)).toBe('2026-08-14')
  })

  it('en el día cruza el fin de mes, el de año y el 29 de febrero', () => {
    expect(moverAncla('DIA', '2026-08-31', 1)).toBe('2026-09-01')
    expect(moverAncla('DIA', '2026-12-31', 1)).toBe('2027-01-01')
    expect(moverAncla('DIA', '2027-01-01', -1)).toBe('2026-12-31')
    expect(moverAncla('DIA', '2024-02-28', 1)).toBe('2024-02-29')
    expect(moverAncla('DIA', '2024-03-01', -1)).toBe('2024-02-29')
  })
})

describe('rangoVisible — SEMANA', () => {
  it('es de lunes a domingo de la semana de la ancla', () => {
    // 2026-11-11 es miércoles.
    expect(rangoVisible('SEMANA', '2026-11-11')).toEqual({ desde: '2026-11-09', hasta: '2026-11-15' })
  })

  it('cualquier día de la semana da el mismo rango, el domingo incluido', () => {
    for (const d of ['2026-11-09', '2026-11-13', '2026-11-15']) {
      expect(rangoVisible('SEMANA', d)).toEqual({ desde: '2026-11-09', hasta: '2026-11-15' })
    }
  })

  it('cruza el mes, el año y el 29 de febrero', () => {
    expect(rangoVisible('SEMANA', '2026-12-02')).toEqual({ desde: '2026-11-30', hasta: '2026-12-06' })
    expect(rangoVisible('SEMANA', '2026-12-31')).toEqual({ desde: '2026-12-28', hasta: '2027-01-03' })
    expect(rangoVisible('SEMANA', '2024-02-29')).toEqual({ desde: '2024-02-26', hasta: '2024-03-03' })
  })
})

describe('diasDeLaSemana', () => {
  it('siete días corridos de lunes a domingo', () => {
    expect(diasDeLaSemana('2026-11-11')).toEqual([
      '2026-11-09',
      '2026-11-10',
      '2026-11-11',
      '2026-11-12',
      '2026-11-13',
      '2026-11-14',
      '2026-11-15',
    ])
  })

  it('cruza el mes y el 29 de febrero', () => {
    expect(diasDeLaSemana('2026-12-02')[0]).toBe('2026-11-30')
    expect(diasDeLaSemana('2026-12-02')[6]).toBe('2026-12-06')
    expect(diasDeLaSemana('2024-02-29')).toContain('2024-02-29')
    expect(diasDeLaSemana('2024-02-29')[3]).toBe('2024-02-29')
  })
})

describe('moverAncla — SEMANA', () => {
  it('mueve siete días', () => {
    expect(moverAncla('SEMANA', '2026-11-11', 1)).toBe('2026-11-18')
    expect(moverAncla('SEMANA', '2026-11-11', -1)).toBe('2026-11-04')
  })

  it('cruza el fin de mes, el de año y el 29 de febrero', () => {
    expect(moverAncla('SEMANA', '2026-11-27', 1)).toBe('2026-12-04')
    expect(moverAncla('SEMANA', '2026-12-30', 1)).toBe('2027-01-06')
    expect(moverAncla('SEMANA', '2024-02-26', 1)).toBe('2024-03-04')
    expect(moverAncla('SEMANA', '2024-03-04', -1)).toBe('2024-02-26')
  })
})

describe('tituloDeSemana', () => {
  it('dentro de un mes: rango con el mes una vez', () => {
    expect(tituloDeSemana('2026-11-11')).toEqual({ corto: '9 – 15 nov', completo: '9 – 15 nov 2026' })
  })

  it('cruza de mes: los dos meses', () => {
    expect(tituloDeSemana('2026-12-02')).toEqual({
      corto: '30 nov – 6 dic',
      completo: '30 nov – 6 dic 2026',
    })
  })

  it('cruza de año: los dos años, también en el corto', () => {
    const t = tituloDeSemana('2026-12-31')
    expect(t.completo).toBe('28 dic 2026 – 3 ene 2027')
    expect(t.corto).toBe('28 dic 2026 – 3 ene 2027')
  })

  it('semana con 29 de febrero', () => {
    expect(tituloDeSemana('2024-02-29').completo).toBe('26 feb – 3 mar 2024')
  })

  it('es el mismo para cualquier día de la semana', () => {
    expect(tituloDeSemana('2026-11-15')).toEqual(tituloDeSemana('2026-11-09'))
  })
})

describe('ubicarAlCambiarVista', () => {
  it('desde el mes: el día seleccionado si cae en el mes que se veía', () => {
    expect(ubicarAlCambiarVista('MES', '2026-11-01', '2026-11-20')).toEqual({
      ancla: '2026-11-20',
      diaSel: '2026-11-20',
    })
  })

  it('desde el mes: si el día seleccionado quedó en otro mes, el de la ancla', () => {
    // Navegó a diciembre sin seleccionar nada; el seleccionado sigue en noviembre.
    expect(ubicarAlCambiarVista('MES', '2026-12-01', '2026-11-20')).toEqual({
      ancla: '2026-12-01',
      diaSel: '2026-12-01',
    })
    // Mismo mes de otro año no cuenta como el mes visible.
    expect(ubicarAlCambiarVista('MES', '2027-11-01', '2026-11-20').ancla).toBe('2027-11-01')
  })

  it('desde la semana o el día: conserva el día seleccionado, también para volver al mes', () => {
    // En la semana se pudo elegir una columna distinta de la ancla.
    expect(ubicarAlCambiarVista('SEMANA', '2026-11-11', '2026-11-14')).toEqual({
      ancla: '2026-11-14',
      diaSel: '2026-11-14',
    })
    expect(ubicarAlCambiarVista('DIA', '2026-11-30', '2026-11-30')).toEqual({
      ancla: '2026-11-30',
      diaSel: '2026-11-30',
    })
  })

  it('Mes → Semana → Mes termina en el mismo día, y su semana lo contiene', () => {
    const aSemana = ubicarAlCambiarVista('MES', '2026-11-01', '2026-11-20')
    expect(diasDeLaSemana(aSemana.ancla)).toContain('2026-11-20')
    expect(ubicarAlCambiarVista('SEMANA', aSemana.ancla, aSemana.diaSel).diaSel).toBe('2026-11-20')
  })
})
