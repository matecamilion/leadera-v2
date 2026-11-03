import { describe, expect, it } from 'vitest'
import {
  FILTROS_VACIOS,
  fechaDeVencimiento,
  filtrarCuentas,
  filtrosDesdeUrl,
  hayFiltros,
  ordenarCuentas,
  urlDesdeFiltros,
  type CuentaAdmin,
  type FiltrosCuentas,
} from './admin'

/** Un instante a partir de una fecha y hora locales de Argentina (UTC−3). */
function ar(fecha: string, hora: string): string {
  return new Date(`${fecha}T${hora}:00-03:00`).toISOString()
}

/** Hoy es el 10/11/2026 al mediodía en Argentina. */
const AHORA = new Date(ar('2026-11-10', '12:00'))

function cuenta(id: string, sobrescribe: Partial<CuentaAdmin> = {}): CuentaAdmin {
  return {
    id,
    nombre: `Inmobiliaria ${id}`,
    plan: 'SOLO',
    estado: 'ACTIVA',
    tipoCuenta: 'CLIENTE',
    metodoCobro: 'MANUAL',
    accesoPagadoHasta: ar('2026-12-20', '15:00'),
    creadaEl: ar('2026-01-10', '10:00'),
    inicioTrial: ar('2026-01-10', '10:00'),
    finTrial: ar('2026-01-24', '10:00'),
    proximoCobro: null,
    ultimoPagoFallido: null,
    cancelacionSolicitada: false,
    limiteUsuarios: null,
    bloqueoMotivo: null,
    tieneSuscripcionMp: false,
    dueno: { nombre: 'Ana Pérez', email: 'ana@example.com', telefono: null },
    ultimoPagoAprobado: null,
    ...sobrescribe,
  }
}

const ids = (cuentas: CuentaAdmin[]) => cuentas.map((c) => c.id)
const filtros = (sobrescribe: Partial<FiltrosCuentas>): FiltrosCuentas => ({ ...FILTROS_VACIOS, ...sobrescribe })

describe('filtrarCuentas', () => {
  const todas = [
    cuenta('a', { nombre: 'Century 21 Cavalca', dueno: { nombre: 'Agustín Romero', email: 'agus@cavalca.com', telefono: null } }),
    cuenta('b', { nombre: 'Remax Sur', dueno: { nombre: 'Lucía Gómez', email: 'lucia@remax.com', telefono: null } }),
    cuenta('c', { nombre: 'Casa Propia', plan: null, estado: 'TRIAL', metodoCobro: 'MERCADO_PAGO', dueno: null }),
    cuenta('interna', { nombre: 'LeadEra', tipoCuenta: 'INTERNA' }),
  ]

  it('sin filtros trae los clientes y deja afuera las internas', () => {
    expect(ids(filtrarCuentas(todas, FILTROS_VACIOS))).toEqual(['a', 'b', 'c'])
  })

  it('incluirInternas las suma', () => {
    expect(ids(filtrarCuentas(todas, filtros({ incluirInternas: true })))).toEqual(['a', 'b', 'c', 'interna'])
  })

  it('el texto no distingue mayúsculas ni tildes, en los dos sentidos', () => {
    expect(ids(filtrarCuentas(todas, filtros({ texto: 'agustin' })))).toEqual(['a'])
    expect(ids(filtrarCuentas(todas, filtros({ texto: 'AGUSTÍN' })))).toEqual(['a'])
    expect(ids(filtrarCuentas(todas, filtros({ texto: 'lucia gomez' })))).toEqual(['b'])
  })

  it('busca por nombre de la inmobiliaria y por email del dueño', () => {
    expect(ids(filtrarCuentas(todas, filtros({ texto: 'remax' })))).toEqual(['b'])
    expect(ids(filtrarCuentas(todas, filtros({ texto: 'agus@cavalca' })))).toEqual(['a'])
  })

  it('cada palabra puede estar en un campo distinto, en cualquier orden', () => {
    expect(ids(filtrarCuentas(todas, filtros({ texto: 'romero century' })))).toEqual(['a'])
  })

  it('un texto de sólo espacios no filtra', () => {
    expect(ids(filtrarCuentas(todas, filtros({ texto: '   ' })))).toEqual(['a', 'b', 'c'])
  })

  it('una cuenta sin dueño sólo se encuentra por su nombre', () => {
    expect(ids(filtrarCuentas(todas, filtros({ texto: 'propia' })))).toEqual(['c'])
    expect(ids(filtrarCuentas(todas, filtros({ texto: 'ana@example' })))).toEqual([])
  })

  it('estados múltiples: alcanza con que cumpla uno', () => {
    expect(ids(filtrarCuentas(todas, filtros({ estados: ['TRIAL', 'GRACIA'] })))).toEqual(['c'])
    expect(ids(filtrarCuentas(todas, filtros({ estados: ['TRIAL', 'ACTIVA'] })))).toEqual(['a', 'b', 'c'])
  })

  it('plan y "sin plan"', () => {
    expect(ids(filtrarCuentas(todas, filtros({ plan: 'SOLO' })))).toEqual(['a', 'b'])
    expect(ids(filtrarCuentas(todas, filtros({ plan: 'SIN_PLAN' })))).toEqual(['c'])
    expect(ids(filtrarCuentas(todas, filtros({ plan: 'AGENCIA_GRANDE' })))).toEqual([])
  })

  it('método de cobro', () => {
    expect(ids(filtrarCuentas(todas, filtros({ metodo: 'MERCADO_PAGO' })))).toEqual(['c'])
  })

  it('los filtros se combinan: tienen que cumplirse todos', () => {
    const f = filtros({ texto: 'a', estados: ['ACTIVA'], plan: 'SOLO', metodo: 'MANUAL', incluirInternas: true })
    expect(ids(filtrarCuentas(todas, f))).toEqual(['a', 'b', 'interna'])
    expect(ids(filtrarCuentas(todas, { ...f, texto: 'remax' }))).toEqual(['b'])
    expect(ids(filtrarCuentas(todas, { ...f, metodo: 'MERCADO_PAGO' }))).toEqual([])
  })

  it('hayFiltros', () => {
    expect(hayFiltros(FILTROS_VACIOS)).toBe(false)
    expect(hayFiltros(filtros({ texto: '  ' }))).toBe(false)
    expect(hayFiltros(filtros({ texto: 'a' }))).toBe(true)
    expect(hayFiltros(filtros({ incluirInternas: true }))).toBe(true)
    expect(hayFiltros(filtros({ estados: ['TRIAL'] }))).toBe(true)
  })
})

describe('ordenarCuentas', () => {
  it('prioridad de cobranza: vencidas, gracia, por vencer, trial, activas, canceladas', () => {
    const lista = [
      cuenta('cancelada', { estado: 'CANCELADA' }),
      cuenta('activa-mp', { metodoCobro: 'MERCADO_PAGO', accesoPagadoHasta: null, proximoCobro: ar('2026-11-12', '10:00') }),
      cuenta('activa-lejos', { accesoPagadoHasta: ar('2026-12-20', '10:00') }),
      cuenta('trial-sano', { estado: 'TRIAL', metodoCobro: 'MERCADO_PAGO', finTrial: ar('2026-11-22', '10:00') }),
      cuenta('trial-por-vencer', { estado: 'TRIAL', metodoCobro: 'MERCADO_PAGO', finTrial: ar('2026-11-16', '10:00') }),
      cuenta('manual-por-vencer', { accesoPagadoHasta: ar('2026-11-12', '10:00') }),
      cuenta('gracia', { estado: 'GRACIA', metodoCobro: 'MERCADO_PAGO', accesoPagadoHasta: null }),
      cuenta('vencida-vieja', { estado: 'VENCIDA', accesoPagadoHasta: ar('2026-10-01', '10:00') }),
      cuenta('vencida-reciente', { estado: 'VENCIDA', accesoPagadoHasta: ar('2026-11-08', '10:00') }),
    ]
    expect(ids(ordenarCuentas(lista, 'prioridad', AHORA))).toEqual([
      'vencida-reciente',
      'vencida-vieja',
      'gracia',
      'manual-por-vencer',
      'trial-por-vencer',
      'trial-sano',
      'activa-lejos',
      'activa-mp',
      'cancelada',
    ])
  })

  it('la prioridad es el orden por defecto y desempata por nombre', () => {
    const lista = [
      cuenta('b', { nombre: 'Beta', estado: 'GRACIA' }),
      cuenta('a', { nombre: 'Alfa', estado: 'GRACIA' }),
    ]
    expect(ids(ordenarCuentas(lista))).toEqual(['a', 'b'])
  })

  it('una manual que vence hoy cuenta como por vencer, y una que ya pasó sin que corra el cron también', () => {
    const lista = [
      cuenta('activa', { nombre: 'A', accesoPagadoHasta: ar('2026-12-20', '10:00') }),
      cuenta('hoy', { nombre: 'Z', accesoPagadoHasta: ar('2026-11-10', '23:50') }),
    ]
    expect(ids(ordenarCuentas(lista, 'prioridad', AHORA))).toEqual(['hoy', 'activa'])
  })

  it('por nombre, sin importar tildes ni mayúsculas', () => {
    const lista = [cuenta('3', { nombre: 'Zeta' }), cuenta('1', { nombre: 'álamo' }), cuenta('2', { nombre: 'Beta' })]
    expect(ids(ordenarCuentas(lista, 'nombre', AHORA))).toEqual(['1', '2', '3'])
  })

  it('por alta: la más reciente primero', () => {
    const lista = [
      cuenta('vieja', { creadaEl: ar('2026-01-01', '10:00') }),
      cuenta('nueva', { creadaEl: ar('2026-10-30', '10:00') }),
      cuenta('media', { creadaEl: ar('2026-06-01', '10:00') }),
    ]
    expect(ids(ordenarCuentas(lista, 'alta', AHORA))).toEqual(['nueva', 'media', 'vieja'])
  })

  it('por vencimiento: el más próximo primero, lo ya vencido antes y sin fecha al final', () => {
    const lista = [
      cuenta('sin-fecha-mp', { nombre: 'B', metodoCobro: 'MERCADO_PAGO', accesoPagadoHasta: null, proximoCobro: null }),
      cuenta('lejos', { accesoPagadoHasta: ar('2026-12-20', '10:00') }),
      cuenta('trial', { estado: 'TRIAL', metodoCobro: 'MERCADO_PAGO', finTrial: ar('2026-11-14', '10:00') }),
      cuenta('sin-fecha-manual', { nombre: 'A', accesoPagadoHasta: null }),
      cuenta('vencida', { estado: 'VENCIDA', accesoPagadoHasta: ar('2026-11-01', '10:00') }),
      cuenta('mp', { metodoCobro: 'MERCADO_PAGO', accesoPagadoHasta: null, proximoCobro: ar('2026-11-20', '10:00') }),
    ]
    expect(ids(ordenarCuentas(lista, 'vence', AHORA))).toEqual([
      'vencida',
      'trial',
      'mp',
      'lejos',
      'sin-fecha-manual',
      'sin-fecha-mp',
    ])
  })

  it('no modifica la lista que recibe', () => {
    const lista = [cuenta('b', { nombre: 'B' }), cuenta('a', { nombre: 'A' })]
    ordenarCuentas(lista, 'nombre', AHORA)
    expect(ids(lista)).toEqual(['b', 'a'])
  })
})

describe('fechaDeVencimiento', () => {
  it('trial: el fin de la prueba', () => {
    const trial = cuenta('t', { estado: 'TRIAL', metodoCobro: 'MERCADO_PAGO', finTrial: ar('2026-11-20', '10:00') })
    expect(fechaDeVencimiento(trial)).toBe(ar('2026-11-20', '10:00'))
  })

  it('manual: el acceso pagado; Mercado Pago: el próximo cobro', () => {
    expect(fechaDeVencimiento(cuenta('m', { accesoPagadoHasta: ar('2026-12-01', '10:00') }))).toBe(ar('2026-12-01', '10:00'))
    expect(
      fechaDeVencimiento(cuenta('p', { metodoCobro: 'MERCADO_PAGO', proximoCobro: ar('2026-12-05', '10:00') })),
    ).toBe(ar('2026-12-05', '10:00'))
  })

  it('sin fecha: null', () => {
    expect(fechaDeVencimiento(cuenta('x', { metodoCobro: 'MERCADO_PAGO', proximoCobro: null }))).toBeNull()
  })
})

describe('filtros en la URL', () => {
  it('sin parámetros: filtros vacíos y orden por prioridad', () => {
    expect(filtrosDesdeUrl(new URLSearchParams())).toEqual({ filtros: FILTROS_VACIOS, orden: 'prioridad' })
  })

  it('ida y vuelta', () => {
    const f = filtros({
      texto: 'juan perez',
      estados: ['GRACIA', 'VENCIDA'],
      plan: 'AGENCIA_CHICA',
      metodo: 'MANUAL',
      incluirInternas: true,
    })
    const url = urlDesdeFiltros(f, 'vence')
    expect(filtrosDesdeUrl(new URLSearchParams(url.toString()))).toEqual({ filtros: f, orden: 'vence' })
  })

  it('lo que está en su valor por defecto no se escribe', () => {
    expect(urlDesdeFiltros(FILTROS_VACIOS, 'prioridad').toString()).toBe('')
    expect(urlDesdeFiltros(filtros({ texto: '  ' }), 'prioridad').toString()).toBe('')
  })

  it('un espacio al final del texto se conserva: si no, no se podría escribir una segunda palabra', () => {
    const url = urlDesdeFiltros(filtros({ texto: 'juan ' }), 'prioridad')
    expect(filtrosDesdeUrl(new URLSearchParams(url.toString())).filtros.texto).toBe('juan ')
  })

  it('valores inválidos o desconocidos se ignoran', () => {
    const { filtros: f, orden } = filtrosDesdeUrl(
      new URLSearchParams('estado=VENCIDA,INVENTADO&plan=PLATINO&metodo=CHEQUE&internas=si&orden=azar'),
    )
    expect(f).toEqual(filtros({ estados: ['VENCIDA'] }))
    expect(orden).toBe('prioridad')
  })

  it('los estados salen siempre en el mismo orden', () => {
    expect(filtrosDesdeUrl(new URLSearchParams('estado=VENCIDA,TRIAL')).filtros.estados).toEqual(['TRIAL', 'VENCIDA'])
  })
})
