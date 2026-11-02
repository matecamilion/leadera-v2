import { describe, expect, it } from 'vitest'
import { puedeEditarPropiedad, TEXTO_SIN_PERMISO } from './puedeEditarPropiedad'

const DUENO = { id: 'dueno', rol: 'DUENO' as const, asiste_a: null }
const AGENTE = { id: 'agente-a', rol: 'AGENTE' as const, asiste_a: null }
const ASISTENTE_DE_A = { id: 'asist-a', rol: 'ASISTENTE' as const, asiste_a: 'agente-a' }

const DE_A = { agente_id: 'agente-a' }
const DE_B = { agente_id: 'agente-b' }
const SIN_AGENTE = { agente_id: null }

describe('puedeEditarPropiedad', () => {
  it('el DUENO edita cualquiera: de un agente, de otro y sin agente', () => {
    expect(puedeEditarPropiedad(DUENO, DE_A)).toEqual({ puede: true })
    expect(puedeEditarPropiedad(DUENO, DE_B)).toEqual({ puede: true })
    expect(puedeEditarPropiedad(DUENO, SIN_AGENTE)).toEqual({ puede: true })
  })

  it('el AGENTE edita la suya', () => {
    expect(puedeEditarPropiedad(AGENTE, DE_A)).toEqual({ puede: true })
  })

  it('el AGENTE no edita la de otro agente', () => {
    expect(puedeEditarPropiedad(AGENTE, DE_B)).toEqual({ puede: false, motivo: 'otro_agente' })
  })

  it('el ASISTENTE edita la de su agente', () => {
    expect(puedeEditarPropiedad(ASISTENTE_DE_A, DE_A)).toEqual({ puede: true })
  })

  it('el ASISTENTE edita la que cargó él, que quedó a su nombre', () => {
    expect(puedeEditarPropiedad(ASISTENTE_DE_A, { agente_id: 'asist-a' })).toEqual({ puede: true })
  })

  it('el ASISTENTE no edita la de otro agente', () => {
    expect(puedeEditarPropiedad(ASISTENTE_DE_A, DE_B)).toEqual({
      puede: false,
      motivo: 'otro_agente',
    })
  })

  it('el ASISTENTE sin agente asignado no hereda propiedades por tener asiste_a nulo', () => {
    const huerfano = { id: 'asist-x', rol: 'ASISTENTE' as const, asiste_a: null }
    expect(puedeEditarPropiedad(huerfano, SIN_AGENTE)).toEqual({
      puede: false,
      motivo: 'sin_agente',
    })
    expect(puedeEditarPropiedad(huerfano, DE_A)).toEqual({ puede: false, motivo: 'otro_agente' })
  })

  it('una propiedad sin agente la edita sólo el DUENO', () => {
    expect(puedeEditarPropiedad(DUENO, SIN_AGENTE).puede).toBe(true)
    expect(puedeEditarPropiedad(AGENTE, SIN_AGENTE)).toEqual({ puede: false, motivo: 'sin_agente' })
    expect(puedeEditarPropiedad(ASISTENTE_DE_A, SIN_AGENTE)).toEqual({
      puede: false,
      motivo: 'sin_agente',
    })
  })

  it('los textos de cada motivo', () => {
    expect(TEXTO_SIN_PERMISO.sin_agente).toBe(
      'Pedile al dueño que te asigne la propiedad para cargar fotos',
    )
    expect(TEXTO_SIN_PERMISO.otro_agente).toBe(
      'Solo la puede editar su agente asignado o el dueño',
    )
  })
})
