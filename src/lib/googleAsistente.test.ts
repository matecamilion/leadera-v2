import { describe, expect, it } from 'vitest'
import {
  esAsistente,
  estadoDelAgente,
  mostrarBannerConectar,
  vistaGooglePerfil,
} from './googleAsistente'

describe('mostrarBannerConectar', () => {
  it('dueño y agente sí', () => {
    expect(mostrarBannerConectar('DUENO')).toBe(true)
    expect(mostrarBannerConectar('AGENTE')).toBe(true)
  })
  it('el asistente no', () => {
    expect(mostrarBannerConectar('ASISTENTE')).toBe(false)
  })
  it('sin rol todavía, no', () => {
    expect(mostrarBannerConectar(undefined)).toBe(false)
    expect(mostrarBannerConectar(null)).toBe(false)
  })
})

describe('vistaGooglePerfil', () => {
  it('dueño y agente gestionan Google', () => {
    for (const rol of ['DUENO', 'AGENTE']) {
      expect(vistaGooglePerfil(rol, false)).toEqual({
        gestiona: true,
        loGestionaElAgente: false,
        soloDesconectar: false,
      })
    }
  })

  it('el asistente no gestiona: ve "lo gestiona tu agente"', () => {
    expect(vistaGooglePerfil('ASISTENTE', false)).toEqual({
      gestiona: false,
      loGestionaElAgente: true,
      soloDesconectar: false,
    })
  })

  it('un asistente con fila propia conectada solo puede desconectar', () => {
    expect(vistaGooglePerfil('ASISTENTE', true)).toEqual({
      gestiona: false,
      loGestionaElAgente: true,
      soloDesconectar: true,
    })
  })

  it('la fila propia no cambia la vista de un agente', () => {
    expect(vistaGooglePerfil('AGENTE', true).soloDesconectar).toBe(false)
  })
})

describe('estadoDelAgente', () => {
  it('conectado', () => {
    expect(estadoDelAgente({ conectado: true }).etiqueta).toBe('Conectado')
  })
  it('permiso revocado: lo resuelve el agente, no el asistente', () => {
    const e = estadoDelAgente({ conectado: false })
    expect(e.etiqueta).toBe('Reconexión pendiente')
    expect(e.detalle).toMatch(/tu agente/i)
  })
  it('sin fila: el agente no conectó', () => {
    expect(estadoDelAgente(null).etiqueta).toBe('No conectado')
    expect(estadoDelAgente(undefined).etiqueta).toBe('No conectado')
  })
})

describe('esAsistente', () => {
  it('solo ASISTENTE', () => {
    expect(esAsistente('ASISTENTE')).toBe(true)
    expect(esAsistente('AGENTE')).toBe(false)
    expect(esAsistente(undefined)).toBe(false)
  })
})
