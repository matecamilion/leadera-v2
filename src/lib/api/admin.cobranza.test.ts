import { describe, expect, it } from 'vitest'
import {
  alertaDeCobro,
  cuentasPorVencer,
  diasHastaFechaAR,
  diasVencida,
  estaPorVencer,
  formatearFechaAR,
  graciaMercadoPago,
  haceCuantoAR,
  mrrAPrecioDeLista,
  nivelDeActividad,
  progresoDeTrial,
  resumenDeCobros,
  textoDiasHasta,
  textoVencidaHace,
  vencidasPorRecuperar,
  type CuentaAdmin,
  type EventoCuenta,
  type PagoAprobado,
} from './admin'
import type { PrecioPlan } from './suscripcion'

/** Un instante a partir de una fecha y hora locales de Argentina (UTC−3). */
function ar(fecha: string, hora: string): string {
  return new Date(`${fecha}T${hora}:00-03:00`).toISOString()
}

/** Hoy es el 10/11/2026 al mediodía en Argentina. */
const AHORA = new Date(ar('2026-11-10', '12:00'))

function cuenta(sobrescribe: Partial<CuentaAdmin> = {}): CuentaAdmin {
  return {
    id: 'c1',
    nombre: 'Inmobiliaria Uno',
    plan: 'SOLO',
    estado: 'ACTIVA',
    tipoCuenta: 'CLIENTE',
    metodoCobro: 'MANUAL',
    accesoPagadoHasta: ar('2026-12-10', '15:00'),
    creadaEl: ar('2026-01-10', '10:00'),
    inicioTrial: ar('2026-01-10', '10:00'),
    finTrial: ar('2026-01-24', '10:00'),
    proximoCobro: null,
    ultimoPagoFallido: null,
    cancelacionSolicitada: false,
    dueno: null,
    limiteUsuarios: null,
    bloqueoMotivo: null,
    tieneSuscripcionMp: false,
    ultimoPagoAprobado: null,
    ...sobrescribe,
  }
}

const PRECIOS: PrecioPlan[] = [
  { plan: 'SOLO', precio_usd: 15, precio_ars: 23100, actualizado_at: null },
  { plan: 'AGENCIA_CHICA', precio_usd: 40, precio_ars: 61000, actualizado_at: null },
  { plan: 'AGENCIA_GRANDE', precio_usd: 90, precio_ars: null, actualizado_at: null },
]

function pago(inmobiliariaId: string): PagoAprobado {
  return { id: `p-${inmobiliariaId}`, inmobiliariaId, monto: 23100, moneda: 'ARS', fecha: ar('2026-10-01', '10:00') }
}

describe('diasHastaFechaAR y formatearFechaAR', () => {
  it('cuenta días calendario en hora de Argentina, no por milisegundos', () => {
    // 23:50 AR de hoy ya es el 11/11 en UTC: igual es "hoy".
    expect(diasHastaFechaAR(ar('2026-11-10', '23:50'), AHORA)).toBe(0)
    expect(diasHastaFechaAR(ar('2026-11-10', '00:30'), AHORA)).toBe(0)
    expect(diasHastaFechaAR(ar('2026-11-11', '00:30'), AHORA)).toBe(1)
    expect(diasHastaFechaAR(ar('2026-11-09', '23:50'), AHORA)).toBe(-1)
  })

  it('el "ahora" de la noche argentina tampoco corre el día', () => {
    const tarde = new Date(ar('2026-11-10', '23:50'))
    expect(diasHastaFechaAR(ar('2026-11-17', '00:30'), tarde)).toBe(7)
  })

  it('una fecha ilegible no es un número', () => {
    expect(diasHastaFechaAR('no es una fecha', AHORA)).toBeNull()
    expect(formatearFechaAR('no es una fecha')).toBe('—')
    expect(formatearFechaAR(null)).toBe('—')
  })

  it('formatea en hora de Argentina', () => {
    expect(formatearFechaAR(ar('2026-11-10', '23:50'))).toBe('10/11/2026')
    expect(formatearFechaAR(ar('2026-11-10', '00:30'))).toBe('10/11/2026')
  })
})

describe('estaPorVencer', () => {
  it('manual ACTIVA: entra hasta 7 días contando hoy, a cualquier hora del día', () => {
    expect(estaPorVencer(cuenta({ accesoPagadoHasta: ar('2026-11-17', '00:30') }), AHORA)).toBe(true)
    expect(estaPorVencer(cuenta({ accesoPagadoHasta: ar('2026-11-17', '23:50') }), AHORA)).toBe(true)
  })

  it('manual ACTIVA: el día 8 todavía no', () => {
    expect(estaPorVencer(cuenta({ accesoPagadoHasta: ar('2026-11-18', '00:30') }), AHORA)).toBe(false)
    expect(estaPorVencer(cuenta({ accesoPagadoHasta: ar('2026-11-18', '23:50') }), AHORA)).toBe(false)
  })

  it('manual ACTIVA con la fecha ya pasada y el cron sin correr: sigue pendiente', () => {
    expect(estaPorVencer(cuenta({ accesoPagadoHasta: ar('2026-11-09', '15:00') }), AHORA)).toBe(true)
  })

  it('trial: mismo borde de 7 días', () => {
    const trial = (finTrial: string) => cuenta({ estado: 'TRIAL', metodoCobro: 'MERCADO_PAGO', finTrial })
    expect(estaPorVencer(trial(ar('2026-11-17', '23:50')), AHORA)).toBe(true)
    expect(estaPorVencer(trial(ar('2026-11-18', '00:30')), AHORA)).toBe(false)
    expect(estaPorVencer(trial(ar('2026-11-05', '10:00')), AHORA)).toBe(true)
  })

  it('no cuenta Mercado Pago ACTIVA, gracia, vencidas ni canceladas', () => {
    const proximo = ar('2026-11-12', '10:00')
    expect(
      estaPorVencer(cuenta({ metodoCobro: 'MERCADO_PAGO', proximoCobro: proximo }), AHORA),
    ).toBe(false)
    expect(estaPorVencer(cuenta({ estado: 'GRACIA', accesoPagadoHasta: proximo }), AHORA)).toBe(false)
    expect(estaPorVencer(cuenta({ estado: 'VENCIDA', accesoPagadoHasta: proximo }), AHORA)).toBe(false)
    expect(estaPorVencer(cuenta({ estado: 'CANCELADA', accesoPagadoHasta: proximo }), AHORA)).toBe(false)
  })

  it('manual ACTIVA sin fecha de acceso no entra', () => {
    expect(estaPorVencer(cuenta({ accesoPagadoHasta: null }), AHORA)).toBe(false)
  })
})

describe('alertaDeCobro usa la misma definición', () => {
  it('por vencer sólo donde estaPorVencer', () => {
    expect(alertaDeCobro(cuenta({ accesoPagadoHasta: ar('2026-11-13', '10:00') }), AHORA)).toBe('por_vencer')
    expect(
      alertaDeCobro(
        cuenta({ metodoCobro: 'MERCADO_PAGO', proximoCobro: ar('2026-11-13', '10:00') }),
        AHORA,
      ),
    ).toBeNull()
  })

  it('vencida y gracia mandan sobre cualquier fecha', () => {
    expect(alertaDeCobro(cuenta({ estado: 'VENCIDA' }), AHORA)).toBe('vencida')
    expect(alertaDeCobro(cuenta({ estado: 'GRACIA' }), AHORA)).toBe('gracia')
  })
})

describe('cuentasPorVencer', () => {
  it('trae las que vencen en 7 días, la más cercana primero, con sus días', () => {
    const lista = cuentasPorVencer(
      [
        cuenta({ id: 'a', nombre: 'A', accesoPagadoHasta: ar('2026-11-15', '10:00') }),
        cuenta({ id: 'b', nombre: 'B', estado: 'TRIAL', finTrial: ar('2026-11-11', '10:00') }),
        cuenta({ id: 'c', nombre: 'C', accesoPagadoHasta: ar('2026-12-30', '10:00') }),
      ],
      AHORA,
    )
    expect(lista.map((l) => [l.cuenta.id, l.dias])).toEqual([
      ['b', 1],
      ['a', 5],
    ])
  })
})

describe('mrrAPrecioDeLista', () => {
  it('suma el precio de lista de las CLIENTE en ACTIVA', () => {
    const r = mrrAPrecioDeLista(
      [
        cuenta({ id: 'a', plan: 'SOLO' }),
        cuenta({ id: 'b', plan: 'AGENCIA_CHICA', metodoCobro: 'MERCADO_PAGO' }),
      ],
      PRECIOS,
    )
    expect(r).toEqual({ total: 84100, contadas: 2, sinPrecio: 0 })
  })

  it('ignora las que no tienen plan y las cuenta aparte', () => {
    const r = mrrAPrecioDeLista([cuenta({ id: 'a', plan: null }), cuenta({ id: 'b', plan: 'SOLO' })], PRECIOS)
    expect(r).toEqual({ total: 23100, contadas: 1, sinPrecio: 1 })
  })

  it('un plan sin precio de lista tampoco suma', () => {
    const r = mrrAPrecioDeLista([cuenta({ plan: 'AGENCIA_GRANDE' })], PRECIOS)
    expect(r).toEqual({ total: 0, contadas: 0, sinPrecio: 1 })
  })

  it('no cuenta internas, testing ni cuentas que no están ACTIVA', () => {
    const r = mrrAPrecioDeLista(
      [
        cuenta({ id: 'a', tipoCuenta: 'INTERNA' }),
        cuenta({ id: 'b', tipoCuenta: 'TESTING' }),
        cuenta({ id: 'c', estado: 'TRIAL' }),
        cuenta({ id: 'd', estado: 'GRACIA' }),
        cuenta({ id: 'e', estado: 'VENCIDA' }),
      ],
      PRECIOS,
    )
    expect(r).toEqual({ total: 0, contadas: 0, sinPrecio: 0 })
  })
})

describe('diasVencida', () => {
  it('cuenta desde el día siguiente al vencimiento, sin importar la hora del vencimiento', () => {
    const hoy = new Date(ar('2026-11-13', '12:00'))
    const vencida = (hasta: string) => cuenta({ estado: 'VENCIDA', accesoPagadoHasta: hasta })
    // Venció el día 10: el 11 es el día 0, el 13 el día 2.
    expect(diasVencida(vencida(ar('2026-11-10', '00:30')), hoy)).toBe(2)
    expect(diasVencida(vencida(ar('2026-11-10', '15:00')), hoy)).toBe(2)
    expect(diasVencida(vencida(ar('2026-11-10', '23:50')), hoy)).toBe(2)
  })

  it('el día en que el cron la corta es el día 0', () => {
    const corte = new Date(ar('2026-11-11', '02:30'))
    expect(diasVencida(cuenta({ estado: 'VENCIDA', accesoPagadoHasta: ar('2026-11-10', '23:50') }), corte)).toBe(0)
  })

  it('es null si no se puede saber', () => {
    const vencida = cuenta({ estado: 'VENCIDA', accesoPagadoHasta: ar('2026-11-01', '10:00') })
    expect(diasVencida({ ...vencida, estado: 'ACTIVA' }, AHORA)).toBeNull()
    expect(diasVencida({ ...vencida, metodoCobro: 'MERCADO_PAGO' }, AHORA)).toBeNull()
    expect(diasVencida({ ...vencida, accesoPagadoHasta: null }, AHORA)).toBeNull()
    // Suspendida a mano con el acceso todavía vigente.
    expect(diasVencida({ ...vencida, accesoPagadoHasta: ar('2026-12-01', '10:00') }, AHORA)).toBeNull()
  })

  it('textoVencidaHace', () => {
    expect(textoVencidaHace(0)).toBe('hoy')
    expect(textoVencidaHace(1)).toBe('hace 1 día')
    expect(textoVencidaHace(5)).toBe('hace 5 días')
  })
})

describe('vencidasPorRecuperar', () => {
  const vencida = (id: string, hasta: string, resto: Partial<CuentaAdmin> = {}) =>
    cuenta({ id, nombre: `Cuenta ${id}`, estado: 'VENCIDA', accesoPagadoHasta: hasta, ...resto })

  it('trae las manuales vencidas que ya pagaron, con plan, monto de lista, fecha y días', () => {
    const r = vencidasPorRecuperar(
      [vencida('a', ar('2026-11-05', '15:00'))],
      [pago('a')],
      PRECIOS,
      AHORA,
    )
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({
      plan: 'SOLO',
      montoLista: 23100,
      vencimiento: ar('2026-11-05', '15:00'),
      diasVencida: 4,
    })
    expect(r[0].cuenta.id).toBe('a')
  })

  it('no incluye a las que nunca pagaron', () => {
    const r = vencidasPorRecuperar([vencida('a', ar('2026-11-05', '15:00'))], [pago('otra')], PRECIOS, AHORA)
    expect(r).toEqual([])
  })

  it('no incluye trials vencidos, Mercado Pago, internas ni cuentas que no están vencidas', () => {
    const r = vencidasPorRecuperar(
      [
        vencida('trial', ar('2026-11-05', '15:00'), { metodoCobro: 'MERCADO_PAGO' }),
        vencida('interna', ar('2026-11-05', '15:00'), { tipoCuenta: 'INTERNA' }),
        cuenta({ id: 'activa' }),
        cuenta({ id: 'gracia', estado: 'GRACIA' }),
      ],
      ['trial', 'interna', 'activa', 'gracia'].map(pago),
      PRECIOS,
      AHORA,
    )
    expect(r).toEqual([])
  })

  it('la que venció más recientemente va primero', () => {
    const r = vencidasPorRecuperar(
      [
        vencida('vieja', ar('2026-10-01', '10:00')),
        vencida('nueva', ar('2026-11-08', '10:00')),
        vencida('media', ar('2026-10-20', '10:00')),
      ],
      ['vieja', 'nueva', 'media'].map(pago),
      PRECIOS,
      AHORA,
    )
    expect(r.map((v) => v.cuenta.id)).toEqual(['nueva', 'media', 'vieja'])
  })

  it('sin plan o sin precio de lista: monto null, la cuenta igual entra', () => {
    const r = vencidasPorRecuperar(
      [
        vencida('sinplan', ar('2026-11-05', '10:00'), { plan: null }),
        vencida('grande', ar('2026-11-04', '10:00'), { plan: 'AGENCIA_GRANDE' }),
      ],
      ['sinplan', 'grande'].map(pago),
      PRECIOS,
      AHORA,
    )
    expect(r.map((v) => [v.cuenta.id, v.montoLista])).toEqual([
      ['sinplan', null],
      ['grande', null],
    ])
  })

  it('vencida a las 00:30 y a las 23:50 del mismo día: mismos días', () => {
    const r = vencidasPorRecuperar(
      [
        vencida('madrugada', ar('2026-11-05', '00:30')),
        vencida('noche', ar('2026-11-05', '23:50')),
      ],
      ['madrugada', 'noche'].map(pago),
      PRECIOS,
      AHORA,
    )
    expect(r.map((v) => v.diasVencida)).toEqual([4, 4])
  })

  it('una suspendida con el acceso vigente entra, pero sin días', () => {
    const r = vencidasPorRecuperar(
      [vencida('susp', ar('2026-12-20', '10:00'))],
      [pago('susp')],
      PRECIOS,
      AHORA,
    )
    expect(r).toHaveLength(1)
    expect(r[0].diasVencida).toBeNull()
  })
})

describe('graciaMercadoPago', () => {
  const gracia = (id: string, falloEl: string | null, resto: Partial<CuentaAdmin> = {}) =>
    cuenta({
      id,
      estado: 'GRACIA',
      metodoCobro: 'MERCADO_PAGO',
      accesoPagadoHasta: null,
      ultimoPagoFallido: falloEl,
      ...resto,
    })

  it('sólo Mercado Pago de clientes, el fallo más viejo primero', () => {
    const r = graciaMercadoPago(
      [
        gracia('nuevo', ar('2026-11-09', '10:00')),
        gracia('viejo', ar('2026-11-07', '10:00')),
        gracia('manual', ar('2026-11-07', '10:00'), { metodoCobro: 'MANUAL' }),
        gracia('interna', ar('2026-11-07', '10:00'), { tipoCuenta: 'INTERNA' }),
      ],
      AHORA,
    )
    expect(r.map((g) => [g.cuenta.id, g.diasDesdeFallo])).toEqual([
      ['viejo', 3],
      ['nuevo', 1],
    ])
  })

  it('sin fecha de fallo: días null, y al final', () => {
    const r = graciaMercadoPago([gracia('sin', null), gracia('con', ar('2026-11-09', '10:00'))], AHORA)
    expect(r.map((g) => g.cuenta.id)).toEqual(['con', 'sin'])
    expect(r[1].diasDesdeFallo).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Ficha de la cuenta
// ---------------------------------------------------------------------------

function evento(sobrescribe: Partial<EventoCuenta> & { id: string }): EventoCuenta {
  return {
    fecha: ar('2026-10-05', '12:00'),
    tipo: 'pago_manual',
    etiqueta: 'Pago manual',
    detalle: null,
    monto: 23100,
    moneda: 'ARS',
    relacionadoId: null,
    ...sobrescribe,
  }
}

describe('resumenDeCobros', () => {
  const ALTA = ar('2026-10-01', '10:00')

  it('una cuenta sin pagos: todo en cero y sin fechas', () => {
    expect(resumenDeCobros([], ALTA)).toEqual({
      total: 0,
      cantidad: 0,
      ticketPromedio: null,
      primerPago: null,
      ultimoPago: null,
      diasHastaPrimerPago: null,
      enOtraMoneda: 0,
    })
  })

  it('los eventos que no son pagos no cuentan', () => {
    const r = resumenDeCobros(
      [
        evento({ id: 'a', tipo: 'pago_rechazado', monto: 23100 }),
        evento({ id: 'b', tipo: 'ajuste_vencimiento', monto: null }),
      ],
      ALTA,
    )
    expect(r.cantidad).toBe(0)
    expect(r.total).toBe(0)
  })

  it('con un solo pago: ticket igual al monto, primer y último pago iguales', () => {
    const r = resumenDeCobros([evento({ id: 'a', fecha: ar('2026-10-04', '12:00') })], ALTA)
    expect(r.total).toBe(23100)
    expect(r.cantidad).toBe(1)
    expect(r.ticketPromedio).toBe(23100)
    expect(r.primerPago).toBe(r.ultimoPago)
    expect(r.diasHastaPrimerPago).toBe(3)
  })

  it('suma pagos manuales y de Mercado Pago, con ticket promedio y primer/último pago', () => {
    const r = resumenDeCobros(
      [
        evento({ id: 'nuevo', tipo: 'pago_aprobado', monto: 61000, fecha: ar('2026-11-05', '12:00') }),
        evento({ id: 'viejo', monto: 23100, fecha: ar('2026-10-01', '12:00') }),
      ],
      ALTA,
    )
    expect(r.total).toBe(84100)
    expect(r.cantidad).toBe(2)
    expect(r.ticketPromedio).toBe(42050)
    expect(r.primerPago).toBe(ar('2026-10-01', '12:00'))
    expect(r.ultimoPago).toBe(ar('2026-11-05', '12:00'))
    expect(r.diasHastaPrimerPago).toBe(0)
  })

  it('un pago anulado no suma, no cuenta y no es el primer pago', () => {
    const r = resumenDeCobros(
      [
        evento({ id: 'malo', fecha: ar('2026-10-02', '12:00') }),
        evento({ id: 'anulacion', tipo: 'pago_anulado', relacionadoId: 'malo', fecha: ar('2026-10-03', '12:00') }),
        evento({ id: 'bueno', monto: 30000, fecha: ar('2026-10-10', '12:00') }),
      ],
      ALTA,
    )
    expect(r.total).toBe(30000)
    expect(r.cantidad).toBe(1)
    expect(r.primerPago).toBe(ar('2026-10-10', '12:00'))
    expect(r.diasHastaPrimerPago).toBe(9)
  })

  it('con todos los pagos anulados queda como una cuenta que no pagó', () => {
    const r = resumenDeCobros(
      [evento({ id: 'p' }), evento({ id: 'a', tipo: 'pago_anulado', relacionadoId: 'p' })],
      ALTA,
    )
    expect(r.cantidad).toBe(0)
    expect(r.primerPago).toBeNull()
  })

  it('no suma entre monedas: el otro pago se cuenta aparte', () => {
    const r = resumenDeCobros(
      [evento({ id: 'ars', monto: 23100 }), evento({ id: 'usd', monto: 15, moneda: 'USD' })],
      ALTA,
    )
    expect(r.total).toBe(23100)
    expect(r.ticketPromedio).toBe(23100)
    expect(r.cantidad).toBe(2)
    expect(r.enOtraMoneda).toBe(1)
  })
})

describe('nivelDeActividad', () => {
  it('nunca tuvo actividad', () => {
    expect(nivelDeActividad(null, AHORA)).toEqual({ nivel: 'sin_actividad', dias: null })
  })

  it('hoy y hasta 7 días: activa', () => {
    expect(nivelDeActividad(ar('2026-11-10', '09:00'), AHORA)).toEqual({ nivel: 'activa', dias: 0 })
    expect(nivelDeActividad(ar('2026-11-03', '09:00'), AHORA)).toEqual({ nivel: 'activa', dias: 7 })
  })

  it('de 8 a 30 días: baja', () => {
    expect(nivelDeActividad(ar('2026-11-02', '09:00'), AHORA)).toEqual({ nivel: 'baja', dias: 8 })
    expect(nivelDeActividad(ar('2026-10-11', '23:50'), AHORA)).toEqual({ nivel: 'baja', dias: 30 })
  })

  it('más de 30 días: dormida', () => {
    expect(nivelDeActividad(ar('2026-10-10', '00:30'), AHORA)).toEqual({ nivel: 'dormida', dias: 31 })
  })

  it('cuenta el día en Argentina, no las horas: 00:30 del día 7 sigue siendo activa', () => {
    expect(nivelDeActividad(ar('2026-11-03', '00:30'), AHORA)).toEqual({ nivel: 'activa', dias: 7 })
  })
})

describe('progresoDeTrial', () => {
  const trial = (inicio: string, fin: string) =>
    cuenta({ estado: 'TRIAL', metodoCobro: 'MERCADO_PAGO', inicioTrial: inicio, finTrial: fin })
  const INICIO = ar('2026-11-01', '10:00')
  const FIN = ar('2026-11-15', '10:00')

  it('el día del alta es el día 1 de 14', () => {
    expect(progresoDeTrial(trial(INICIO, FIN), new Date(ar('2026-11-01', '10:05')))).toEqual({
      dia: 1,
      total: 14,
      diasRestantes: 14,
    })
  })

  it('a mitad de la prueba', () => {
    expect(progresoDeTrial(trial(INICIO, FIN), new Date(ar('2026-11-08', '23:50')))).toEqual({
      dia: 8,
      total: 14,
      diasRestantes: 7,
    })
  })

  it('el último día no pasa de N y quedan 0 días', () => {
    expect(progresoDeTrial(trial(INICIO, FIN), new Date(ar('2026-11-15', '09:00')))).toEqual({
      dia: 14,
      total: 14,
      diasRestantes: 0,
    })
  })

  it('una prueba extendida suma días al total', () => {
    const p = progresoDeTrial(trial(INICIO, ar('2026-11-22', '10:00')), new Date(ar('2026-11-10', '12:00')))
    expect(p).toEqual({ dia: 10, total: 21, diasRestantes: 12 })
  })

  it('sólo las cuentas en TRIAL tienen progreso', () => {
    expect(progresoDeTrial(cuenta({ estado: 'ACTIVA' }), AHORA)).toBeNull()
  })
})

describe('haceCuantoAR y textoDiasHasta', () => {
  it('cero días es "Hoy"', () => {
    expect(haceCuantoAR(ar('2026-11-10', '00:30'), AHORA)).toBe('Hoy')
    expect(textoDiasHasta(0)).toBe('Hoy')
  })

  it('días y meses', () => {
    expect(haceCuantoAR(ar('2026-11-09', '23:50'), AHORA)).toBe('hace 1 día')
    expect(haceCuantoAR(ar('2026-10-20', '12:00'), AHORA)).toBe('hace 21 días')
    expect(haceCuantoAR(ar('2026-10-10', '12:00'), AHORA)).toBe('hace 1 mes')
    expect(haceCuantoAR(ar('2026-05-01', '12:00'), AHORA)).toBe('hace 6 meses')
  })

  it('textoDiasHasta', () => {
    expect(textoDiasHasta(1)).toBe('1 día')
    expect(textoDiasHasta(5)).toBe('5 días')
    expect(textoDiasHasta(-1)).toBe('Hace 1 día')
    expect(textoDiasHasta(-3)).toBe('Hace 3 días')
  })
})
