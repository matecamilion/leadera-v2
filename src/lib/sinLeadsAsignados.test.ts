import { describe, expect, it } from 'vitest'
import { sinLeadsAsignados } from './sinLeadsAsignados'

describe('sinLeadsAsignados', () => {
  it('mirando lo asignado, sin nada asignado y con pool: sí', () => {
    expect(sinLeadsAsignados({ mios: true, cantidadAsignados: 0, hayLeadsEnElPool: true })).toBe(true)
  })

  it('si el pool también está vacío es una cuenta vacía, no este mensaje', () => {
    expect(sinLeadsAsignados({ mios: true, cantidadAsignados: 0, hayLeadsEnElPool: false })).toBe(false)
  })

  it('con leads asignados no aplica', () => {
    expect(sinLeadsAsignados({ mios: true, cantidadAsignados: 3, hayLeadsEnElPool: true })).toBe(false)
  })

  it('sin Míos activo no aplica', () => {
    expect(sinLeadsAsignados({ mios: false, cantidadAsignados: 0, hayLeadsEnElPool: true })).toBe(false)
  })

  it('mientras se averigua algo no dice nada', () => {
    expect(sinLeadsAsignados({ mios: true, cantidadAsignados: undefined, hayLeadsEnElPool: true })).toBe(false)
    expect(sinLeadsAsignados({ mios: true, cantidadAsignados: 0, hayLeadsEnElPool: undefined })).toBe(false)
  })
})
