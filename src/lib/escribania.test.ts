import { describe, expect, it } from 'vitest'
import {
  formatearPresupuesto,
  MAX_NOMBRE_ESCRIBANIA,
  normalizarDatosEscribania,
  parsearMonto,
  pasosFaltantes,
  pasosResueltos,
  siguientePaso,
  textoEstadoTramite,
  type FilaPasoTramite,
} from './tramite'

describe('parsearMonto (es-AR)', () => {
  it('"1.500" son mil quinientos', () => {
    expect(parsearMonto('1.500')).toEqual({ ok: true, monto: 1500 })
  })
  it('"1.500,50" es 1500,5', () => {
    expect(parsearMonto('1.500,50')).toEqual({ ok: true, monto: 1500.5 })
  })
  it('"1500,5" es 1500,5', () => {
    expect(parsearMonto('1500,5')).toEqual({ ok: true, monto: 1500.5 })
  })
  it('sin separadores y con varios grupos de miles', () => {
    expect(parsearMonto('1500')).toEqual({ ok: true, monto: 1500 })
    expect(parsearMonto('1.250.000')).toEqual({ ok: true, monto: 1250000 })
    expect(parsearMonto('0')).toEqual({ ok: true, monto: 0 })
  })
  it('ignora los espacios', () => {
    expect(parsearMonto(' 1 500 ')).toEqual({ ok: true, monto: 1500 })
  })
  it('vacío es "sin monto", no un error', () => {
    expect(parsearMonto('')).toEqual({ ok: true, monto: null })
    expect(parsearMonto('   ')).toEqual({ ok: true, monto: null })
  })
  it('"1500.5" se rechaza con un mensaje que explica el formato', () => {
    const r = parsearMonto('1500.5')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/punto para los miles y coma para los decimales/)
  })
  it('un punto con 1 o 2 dígitos detrás tampoco se adivina', () => {
    expect(parsearMonto('1.5').ok).toBe(false)
    expect(parsearMonto('1.50').ok).toBe(false)
    expect(parsearMonto('1.5000').ok).toBe(false)
  })
  it('texto y símbolos se rechazan', () => {
    expect(parsearMonto('mil').ok).toBe(false)
    expect(parsearMonto('$1500').ok).toBe(false)
    expect(parsearMonto('1,2,3').ok).toBe(false)
  })
  it('negativo, más de 2 decimales y demasiado grande', () => {
    expect(parsearMonto('-5')).toMatchObject({ ok: false, error: expect.stringMatching(/negativo/) })
    expect(parsearMonto('1500,555')).toMatchObject({
      ok: false,
      error: expect.stringMatching(/2 decimales/),
    })
    expect(parsearMonto('1.000.000.000.000')).toMatchObject({
      ok: false,
      error: expect.stringMatching(/grande/),
    })
    expect(parsearMonto('999.999.999.999,99')).toEqual({ ok: true, monto: 999999999999.99 })
  })
})

describe('normalizarDatosEscribania', () => {
  it('nombre y monto con moneda', () => {
    expect(
      normalizarDatosEscribania({ nombre: '  Escribanía Pérez ', monto: '1.500,50', moneda: 'ARS' }),
    ).toEqual({
      ok: true,
      datos: {
        escribania_nombre: 'Escribanía Pérez',
        presupuesto_monto: 1500.5,
        presupuesto_moneda: 'ARS',
      },
    })
  })

  it('monto sin moneda usa USD: nunca null ni undefined', () => {
    for (const moneda of [null, undefined, '']) {
      const r = normalizarDatosEscribania({ nombre: null, monto: '1.500', moneda })
      expect(r.ok && r.datos.presupuesto_moneda).toBe('USD')
    }
  })

  it('sin monto, la moneda es null aunque venga una', () => {
    for (const monto of ['', '  ', null, undefined]) {
      expect(normalizarDatosEscribania({ nombre: 'X', monto, moneda: 'ARS' })).toEqual({
        ok: true,
        datos: { escribania_nombre: 'X', presupuesto_monto: null, presupuesto_moneda: null },
      })
    }
  })

  it('con monto, la moneda NUNCA queda null ni undefined (todas las combinaciones)', () => {
    for (const moneda of [null, undefined, '', 'USD', 'ARS']) {
      for (const monto of ['0', '1.500', '1500,5', 1500, 0]) {
        const r = normalizarDatosEscribania({ nombre: null, monto, moneda })
        expect(r.ok).toBe(true)
        if (r.ok) {
          expect(r.datos.presupuesto_monto).not.toBeNull()
          expect(['USD', 'ARS']).toContain(r.datos.presupuesto_moneda)
        }
      }
    }
  })

  it('las tres propiedades siempre existen y valen null cuando no hay valor', () => {
    const r = normalizarDatosEscribania({ nombre: '   ', monto: '', moneda: undefined })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(Object.keys(r.datos).sort()).toEqual([
        'escribania_nombre',
        'presupuesto_moneda',
        'presupuesto_monto',
      ])
      expect(Object.values(r.datos).every((v) => v === null)).toBe(true)
    }
  })

  it('se puede cargar el nombre sin monto y el monto sin nombre', () => {
    expect(normalizarDatosEscribania({ nombre: 'Pérez', monto: '', moneda: 'USD' })).toMatchObject({
      ok: true,
      datos: { escribania_nombre: 'Pérez', presupuesto_monto: null, presupuesto_moneda: null },
    })
    expect(normalizarDatosEscribania({ nombre: '', monto: '900', moneda: 'USD' })).toMatchObject({
      ok: true,
      datos: { escribania_nombre: null, presupuesto_monto: 900, presupuesto_moneda: 'USD' },
    })
  })

  it('acepta un monto ya guardado (número)', () => {
    expect(normalizarDatosEscribania({ nombre: null, monto: 1500.5, moneda: 'ARS' })).toMatchObject({
      ok: true,
      datos: { presupuesto_monto: 1500.5, presupuesto_moneda: 'ARS' },
    })
    expect(normalizarDatosEscribania({ nombre: null, monto: -1, moneda: 'USD' }).ok).toBe(false)
  })

  it('errores: monto mal escrito, moneda inválida, nombre muy largo', () => {
    expect(normalizarDatosEscribania({ nombre: null, monto: '1500.5', moneda: 'USD' })).toMatchObject({
      ok: false,
      errores: { monto: expect.any(String) },
    })
    expect(normalizarDatosEscribania({ nombre: null, monto: '10', moneda: 'EUR' })).toMatchObject({
      ok: false,
      errores: { moneda: expect.any(String) },
    })
    expect(
      normalizarDatosEscribania({
        nombre: 'x'.repeat(MAX_NOMBRE_ESCRIBANIA + 1),
        monto: '',
        moneda: null,
      }),
    ).toMatchObject({ ok: false, errores: { nombre: expect.any(String) } })
    expect(
      normalizarDatosEscribania({
        nombre: 'x'.repeat(MAX_NOMBRE_ESCRIBANIA),
        monto: '',
        moneda: null,
      }).ok,
    ).toBe(true)
  })
})

describe('formatearPresupuesto', () => {
  it('enteros como formatearMonto: moneda y miles con punto', () => {
    expect(formatearPresupuesto(1500, 'USD')).toBe('USD 1.500')
    expect(formatearPresupuesto(0, 'ARS')).toBe('ARS 0')
  })
  it('con centavos no redondea', () => {
    expect(formatearPresupuesto(1500.5, 'USD')).toBe('USD 1.500,50')
  })
})

describe('una fila de la escribanía con datos pero sin completar', () => {
  // La fila real trae más columnas (incluidas las de la escribanía); los helpers
  // del trámite solo miran estas tres.
  const conDatos: FilaPasoTramite = {
    paso: 'ESCRIBANIA_ELEGIDA',
    fecha_completado: null,
    no_aplica: false,
  }
  const presupuestosPedidos: FilaPasoTramite = {
    paso: 'PRESUPUESTOS_PEDIDOS',
    fecha_completado: '2026-10-30',
    no_aplica: false,
  }

  it('cuenta como pendiente y no suma al "n de 6"', () => {
    expect(pasosFaltantes([conDatos])).toContain('ESCRIBANIA_ELEGIDA')
    expect(pasosResueltos([conDatos])).toBe(0)
    expect(pasosResueltos([presupuestosPedidos, conDatos])).toBe(1)
  })

  it('el siguiente paso sigue siendo el primero sin resolver', () => {
    expect(siguientePaso([presupuestosPedidos, conDatos])).toBe('ESCRIBANIA_ELEGIDA')
    expect(textoEstadoTramite([presupuestosPedidos, conDatos])).toBe('Siguiente: Escribanía elegida')
  })

  it('completarla después sí la resuelve', () => {
    expect(pasosResueltos([{ ...conDatos, fecha_completado: '2026-11-02' }])).toBe(1)
  })

  it('un "no aplica" con datos guardados sigue siendo resuelto', () => {
    expect(pasosResueltos([{ ...conDatos, no_aplica: true }])).toBe(1)
  })
})
