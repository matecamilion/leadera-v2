import { describe, expect, it } from 'vitest'
import { estadoDeActualizacion, puedeActualizarCalendario } from './actualizarCalendario'

const activa = { conectado: true, importacionActiva: true }

describe('puedeActualizarCalendario', () => {
  it('dueño y agente con Google conectado e importación activa', () => {
    expect(puedeActualizarCalendario('DUENO', activa)).toBe(true)
    expect(puedeActualizarCalendario('AGENTE', activa)).toBe(true)
  })

  it('el asistente, con la conexión activa de su agente', () => {
    expect(puedeActualizarCalendario('ASISTENTE', activa)).toBe(true)
  })

  it('el asistente no, si su agente no está conectado o no importa', () => {
    expect(puedeActualizarCalendario('ASISTENTE', null)).toBe(false)
    expect(puedeActualizarCalendario('ASISTENTE', { conectado: false, importacionActiva: true })).toBe(false)
    expect(puedeActualizarCalendario('ASISTENTE', { conectado: true, importacionActiva: false })).toBe(false)
  })

  it('otro rol, no', () => {
    expect(puedeActualizarCalendario('ADMIN', activa)).toBe(false)
  })

  it('sin conexión, desconectado o con la importación apagada, no', () => {
    expect(puedeActualizarCalendario('AGENTE', null)).toBe(false)
    expect(puedeActualizarCalendario('AGENTE', undefined)).toBe(false)
    expect(puedeActualizarCalendario('AGENTE', { conectado: false, importacionActiva: true })).toBe(false)
    expect(puedeActualizarCalendario('AGENTE', { conectado: true, importacionActiva: false })).toBe(false)
  })

  it('sin rol, no', () => {
    expect(puedeActualizarCalendario(undefined, activa)).toBe(false)
    expect(puedeActualizarCalendario(null, activa)).toBe(false)
  })
})

describe('estadoDeActualizacion', () => {
  it('ok y ya_actualizado se muestran igual: "Actualizado"', () => {
    expect(estadoDeActualizacion('ok')).toEqual({ tipo: 'actualizado', mensaje: 'Actualizado' })
    expect(estadoDeActualizacion('ya_actualizado')).toEqual({ tipo: 'actualizado', mensaje: 'Actualizado' })
  })

  it('todo lo demás es un error con mensaje propio', () => {
    for (const r of ['reautorizar', 'reintentar', 'no_conectado', 'importacion_no_activada', 'error'] as const) {
      const e = estadoDeActualizacion(r)
      expect(e.tipo).toBe('error')
      expect(e.mensaje.length).toBeGreaterThan(0)
    }
  })

  it('reautorizar manda al perfil', () => {
    expect(estadoDeActualizacion('reautorizar').mensaje).toMatch(/perfil/)
    expect(estadoDeActualizacion('reautorizar', 'AGENTE').mensaje).toMatch(/perfil/)
  })

  it('un asistente no es mandado a reconectar: lo resuelve el agente', () => {
    const m = estadoDeActualizacion('reautorizar', 'ASISTENTE').mensaje
    expect(m).toMatch(/agente/)
    expect(m).not.toMatch(/perfil/)
    expect(estadoDeActualizacion('importacion_no_activada', 'ASISTENTE').mensaje).not.toMatch(/perfil/)
  })
})
