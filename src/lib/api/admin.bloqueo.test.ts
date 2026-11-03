import { describe, expect, it } from 'vitest'
import {
  bloqueoVigente,
  contarPorEstadoVisible,
  esSuspendida,
  estadoVisible,
  FILTROS_VACIOS,
  filtrarCuentas,
  filtrosDesdeUrl,
  hayIncoherenciaDeBloqueo,
  motivoNoSuspender,
  puedeMarcarVencida,
  puedeReactivar,
  puedeSuspender,
  urlDesdeFiltros,
  type BloqueoCuenta,
  type CuentaAdmin,
} from './admin'

function cuenta(id: string, sobrescribe: Partial<CuentaAdmin> = {}): CuentaAdmin {
  return {
    id,
    nombre: `Inmobiliaria ${id}`,
    plan: 'SOLO',
    estado: 'ACTIVA',
    bloqueoMotivo: null,
    tipoCuenta: 'CLIENTE',
    metodoCobro: 'MANUAL',
    tieneSuscripcionMp: false,
    accesoPagadoHasta: '2026-12-20T18:00:00.000Z',
    creadaEl: '2026-01-10T13:00:00.000Z',
    inicioTrial: '2026-01-10T13:00:00.000Z',
    finTrial: '2026-01-24T13:00:00.000Z',
    proximoCobro: null,
    ultimoPagoFallido: null,
    cancelacionSolicitada: false,
    limiteUsuarios: null,
    dueno: { nombre: 'Ana Pérez', email: 'ana@example.com', telefono: null },
    ultimoPagoAprobado: null,
    ...sobrescribe,
  }
}

const SUSPENDIDA = cuenta('susp', { estado: 'VENCIDA', bloqueoMotivo: 'SUSPENSION_ADMIN' })
const MP_VIVA = cuenta('mp', {
  metodoCobro: 'MERCADO_PAGO',
  tieneSuscripcionMp: true,
  estado: 'ACTIVA',
  accesoPagadoHasta: null,
})

describe('esSuspendida y estadoVisible', () => {
  it('VENCIDA con motivo es SUSPENDIDA; sin motivo, VENCIDA', () => {
    expect(esSuspendida(SUSPENDIDA)).toBe(true)
    expect(estadoVisible(SUSPENDIDA)).toBe('SUSPENDIDA')
    expect(estadoVisible(cuenta('v', { estado: 'VENCIDA' }))).toBe('VENCIDA')
  })

  it('el resto de los estados se ven como son', () => {
    for (const estado of ['TRIAL', 'ACTIVA', 'GRACIA', 'CANCELADA'] as const) {
      expect(estadoVisible(cuenta('x', { estado }))).toBe(estado)
    }
  })

  it('con motivo pero en otro estado no se muestra como suspendida', () => {
    expect(estadoVisible(cuenta('x', { estado: 'ACTIVA', bloqueoMotivo: 'SUSPENSION_ADMIN' }))).toBe('ACTIVA')
  })
})

describe('puedeSuspender (precondiciones de admin_suspender_cuenta)', () => {
  it('una cuenta manual activa, sí', () => {
    expect(puedeSuspender(cuenta('a'))).toBe(true)
    expect(motivoNoSuspender(cuenta('a'))).toBeNull()
  })

  it('una vencida sin suspensión, sí: pasa a ser una suspensión', () => {
    expect(puedeSuspender(cuenta('v', { estado: 'VENCIDA' }))).toBe(true)
  })

  it('una prueba, sí; también con un preapproval cargado todavía sin cobrar', () => {
    expect(puedeSuspender(cuenta('t', { estado: 'TRIAL' }))).toBe(true)
    expect(
      puedeSuspender(
        cuenta('t2', { estado: 'TRIAL', metodoCobro: 'MERCADO_PAGO', tieneSuscripcionMp: true }),
      ),
    ).toBe(true)
  })

  it('con una suspensión abierta, no', () => {
    expect(puedeSuspender(SUSPENDIDA)).toBe(false)
    expect(motivoNoSuspender(SUSPENDIDA)).toMatch(/ya está suspendida/)
  })

  it('cancelada, no', () => {
    expect(puedeSuspender(cuenta('c', { estado: 'CANCELADA' }))).toBe(false)
    expect(motivoNoSuspender(cuenta('c', { estado: 'CANCELADA' }))).toMatch(/cancelada/)
  })

  it('Mercado Pago con suscripción cargada en ACTIVA o GRACIA, no', () => {
    expect(puedeSuspender(MP_VIVA)).toBe(false)
    expect(puedeSuspender({ ...MP_VIVA, estado: 'GRACIA' })).toBe(false)
    expect(motivoNoSuspender(MP_VIVA)).toMatch(/Mercado Pago/)
  })

  it('Mercado Pago ACTIVA con la baja ya pedida también se frena: la base es más estricta que antes', () => {
    expect(puedeSuspender({ ...MP_VIVA, cancelacionSolicitada: true })).toBe(false)
  })

  it('Mercado Pago sin suscripción cargada, o ya vencida, sí', () => {
    expect(puedeSuspender({ ...MP_VIVA, tieneSuscripcionMp: false })).toBe(true)
    expect(puedeSuspender({ ...MP_VIVA, estado: 'VENCIDA' })).toBe(true)
  })
})

describe('puedeMarcarVencida (precondiciones de admin_marcar_vencida)', () => {
  it('manual en ACTIVA o GRACIA, sí', () => {
    expect(puedeMarcarVencida(cuenta('a'))).toBe(true)
    expect(puedeMarcarVencida(cuenta('g', { estado: 'GRACIA' }))).toBe(true)
  })

  it('manual vencida o cancelada, no', () => {
    expect(puedeMarcarVencida(cuenta('v', { estado: 'VENCIDA' }))).toBe(false)
    expect(puedeMarcarVencida(cuenta('c', { estado: 'CANCELADA' }))).toBe(false)
  })

  it('prueba sin preapproval, sí; con preapproval cargado, no', () => {
    expect(puedeMarcarVencida(cuenta('t', { estado: 'TRIAL', metodoCobro: 'MERCADO_PAGO' }))).toBe(true)
    expect(puedeMarcarVencida(cuenta('t', { estado: 'TRIAL' }))).toBe(true)
    expect(
      puedeMarcarVencida(
        cuenta('t', { estado: 'TRIAL', metodoCobro: 'MERCADO_PAGO', tieneSuscripcionMp: true }),
      ),
    ).toBe(false)
  })

  it('Mercado Pago ACTIVA o GRACIA, no: lo vence Mercado Pago', () => {
    expect(puedeMarcarVencida(MP_VIVA)).toBe(false)
    expect(puedeMarcarVencida({ ...MP_VIVA, estado: 'GRACIA' })).toBe(false)
  })

  it('con una suspensión abierta, no', () => {
    expect(puedeMarcarVencida(SUSPENDIDA)).toBe(false)
    expect(puedeMarcarVencida({ ...SUSPENDIDA, estado: 'ACTIVA' })).toBe(false)
  })
})

describe('puedeReactivar y la incoherencia', () => {
  it('sólo con una suspensión abierta', () => {
    expect(puedeReactivar(SUSPENDIDA)).toBe(true)
    expect(puedeReactivar(cuenta('a'))).toBe(false)
    expect(puedeReactivar(cuenta('v', { estado: 'VENCIDA' }))).toBe(false)
  })

  it('una cuenta con motivo en otro estado se puede reactivar y está incoherente', () => {
    const revertida = cuenta('r', { estado: 'ACTIVA', bloqueoMotivo: 'SUSPENSION_ADMIN' })
    expect(puedeReactivar(revertida)).toBe(true)
    expect(hayIncoherenciaDeBloqueo(revertida)).toBe(true)
  })

  it('suspendida de verdad, o sin suspensión: coherente', () => {
    expect(hayIncoherenciaDeBloqueo(SUSPENDIDA)).toBe(false)
    expect(hayIncoherenciaDeBloqueo(cuenta('a'))).toBe(false)
    expect(hayIncoherenciaDeBloqueo(cuenta('v', { estado: 'VENCIDA' }))).toBe(false)
  })
})

describe('bloqueoVigente', () => {
  const bloqueo = (id: string, levantadoEl: string | null): BloqueoCuenta => ({
    id,
    motivo: 'SUSPENSION_ADMIN',
    nota: 'nota',
    estadoAnterior: 'ACTIVA',
    bloqueadoEl: '2026-10-01T12:00:00.000Z',
    bloqueadoPorNombre: null,
    levantadoEl,
    levantadoPorNombre: null,
    notaReactivacion: null,
  })

  it('es el que no tiene fecha de levantamiento', () => {
    expect(bloqueoVigente([bloqueo('viejo', '2026-10-05T12:00:00.000Z'), bloqueo('actual', null)])?.id).toBe('actual')
  })

  it('sin ninguno abierto, null', () => {
    expect(bloqueoVigente([bloqueo('viejo', '2026-10-05T12:00:00.000Z')])).toBeNull()
    expect(bloqueoVigente([])).toBeNull()
  })
})

describe('el listado y la suspendida', () => {
  const todas = [
    cuenta('activa'),
    cuenta('vencida', { estado: 'VENCIDA' }),
    SUSPENDIDA,
    cuenta('susp2', { estado: 'VENCIDA', bloqueoMotivo: 'SUSPENSION_ADMIN' }),
  ]

  it('el filtro Suspendida trae sólo las suspendidas', () => {
    expect(filtrarCuentas(todas, { ...FILTROS_VACIOS, estados: ['SUSPENDIDA'] }).map((c) => c.id)).toEqual([
      'susp',
      'susp2',
    ])
  })

  it('el filtro Vencida ya no trae a las suspendidas', () => {
    expect(filtrarCuentas(todas, { ...FILTROS_VACIOS, estados: ['VENCIDA'] }).map((c) => c.id)).toEqual(['vencida'])
  })

  it('se pueden combinar', () => {
    expect(
      filtrarCuentas(todas, { ...FILTROS_VACIOS, estados: ['VENCIDA', 'SUSPENDIDA'] }).map((c) => c.id),
    ).toEqual(['vencida', 'susp', 'susp2'])
  })

  it('el contador de chips las cuenta aparte', () => {
    expect(contarPorEstadoVisible(todas)).toEqual({
      TRIAL: 0,
      ACTIVA: 1,
      GRACIA: 0,
      VENCIDA: 1,
      SUSPENDIDA: 2,
      CANCELADA: 0,
    })
  })

  it('SUSPENDIDA viaja por la URL', () => {
    const url = urlDesdeFiltros({ ...FILTROS_VACIOS, estados: ['VENCIDA', 'SUSPENDIDA'] }, 'prioridad')
    expect(url.toString()).toBe('estado=VENCIDA%2CSUSPENDIDA')
    expect(filtrosDesdeUrl(new URLSearchParams(url.toString())).filtros.estados).toEqual(['VENCIDA', 'SUSPENDIDA'])
  })
})
