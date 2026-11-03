import { describe, expect, it } from 'vitest'
import {
  estaBloqueada,
  estaSuspendida,
  textoDeBloqueo,
  type EstadoDeMiSuscripcion,
} from './suscripcion'

function estado(sobrescribe: Partial<EstadoDeMiSuscripcion> = {}): EstadoDeMiSuscripcion {
  return {
    nombre: 'Century 21 Cavalca',
    plan: 'SOLO',
    estado: 'VENCIDA',
    bloqueoMotivo: null,
    metodoCobro: 'MANUAL',
    accesoPagadoHasta: null,
    tieneSuscripcionEnMp: false,
    fecha_fin_trial: null,
    fecha_proximo_cobro: null,
    cancelacionSolicitada: false,
    ...sobrescribe,
  }
}

const SUSPENDIDA = estado({ bloqueoMotivo: 'SUSPENSION_ADMIN' })
const VENCIDA = estado()

describe('estaSuspendida', () => {
  it('una VENCIDA con motivo está suspendida', () => {
    expect(estaSuspendida(SUSPENDIDA)).toBe(true)
  })

  it('una VENCIDA sin motivo es un vencimiento, no una suspensión', () => {
    expect(estaSuspendida(VENCIDA)).toBe(false)
  })

  it('el motivo solo no alcanza: si la cuenta no está VENCIDA, no se la trata como suspendida', () => {
    expect(estaSuspendida(estado({ estado: 'ACTIVA', bloqueoMotivo: 'SUSPENSION_ADMIN' }))).toBe(false)
  })

  it('sin estado leído, no', () => {
    expect(estaSuspendida(null)).toBe(false)
    expect(estaSuspendida(undefined)).toBe(false)
  })

  it('una suspendida sigue bloqueada, igual que una vencida', () => {
    expect(estaBloqueada(SUSPENDIDA)).toBe(true)
    expect(estaBloqueada(VENCIDA)).toBe(true)
    expect(estaBloqueada(estado({ estado: 'ACTIVA' }))).toBe(false)
  })
})

describe('textoDeBloqueo', () => {
  it('suspendida, para el dueño', () => {
    expect(textoDeBloqueo(SUSPENDIDA, 'DUENO')).toEqual({
      titulo: 'Tu cuenta está suspendida',
      mensaje: 'Escribinos para resolverlo.',
    })
  })

  it.each(['AGENTE', 'ASISTENTE'])('suspendida, para un %s: sin "contactá al dueño"', (rol) => {
    const texto = textoDeBloqueo(SUSPENDIDA, rol)
    expect(texto).toEqual({
      titulo: 'Esta cuenta está suspendida',
      mensaje: 'Escribinos para más información.',
    })
    expect(`${texto.titulo} ${texto.mensaje}`.toLowerCase()).not.toContain('dueño')
  })

  it('suspendida, sin saber el rol: el texto del equipo', () => {
    expect(textoDeBloqueo(SUSPENDIDA, undefined).titulo).toBe('Esta cuenta está suspendida')
    expect(textoDeBloqueo(SUSPENDIDA, null).titulo).toBe('Esta cuenta está suspendida')
  })

  it.each(['AGENTE', 'ASISTENTE'])('vencida, para un %s: conserva su texto de siempre', (rol) => {
    expect(textoDeBloqueo(VENCIDA, rol)).toEqual({
      titulo: 'Esta cuenta está vencida',
      mensaje: 'Contactá al dueño de tu inmobiliaria para reactivarla.',
    })
  })

  it('no sabe nada del motivo interno: el texto sale igual con cualquier cuenta suspendida', () => {
    const otra = estado({ nombre: 'Otra', bloqueoMotivo: 'SUSPENSION_ADMIN', plan: 'AGENCIA_GRANDE' })
    expect(textoDeBloqueo(otra, 'AGENTE')).toEqual(textoDeBloqueo(SUSPENDIDA, 'AGENTE'))
  })

  it('sin estado leído, el texto de un vencimiento', () => {
    expect(textoDeBloqueo(null, 'AGENTE').titulo).toBe('Esta cuenta está vencida')
  })
})
