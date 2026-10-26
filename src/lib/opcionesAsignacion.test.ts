import { describe, expect, it } from 'vitest'
import { nombreAsignado, opcionesDeAsignacion } from './opcionesAsignacion'

const miembro = (
  id: string,
  nombre: string,
  rol: 'DUENO' | 'AGENTE' | 'ASISTENTE',
  extra: { activo?: boolean; asiste?: string } = {},
) => ({
  id,
  nombre,
  apellido: 'X',
  rol,
  activo: extra.activo ?? true,
  asisteA: extra.asiste ? { id: extra.asiste, nombre: 'Agente' } : null,
})

describe('opcionesDeAsignacion', () => {
  const miembros = [
    miembro('a1', 'Bautista', 'DUENO'),
    miembro('a2', 'Otra', 'AGENTE'),
    miembro('s1', 'Leandro', 'ASISTENTE', { asiste: 'a1' }),
    miembro('s2', 'Zoe', 'ASISTENTE', { asiste: 'a1' }),
    miembro('s3', 'Inactivo', 'ASISTENTE', { asiste: 'a1', activo: false }),
    miembro('s4', 'De otro', 'ASISTENTE', { asiste: 'a2' }),
  ]

  it('el agente primero y luego sus asistentes activos, por nombre', () => {
    const ops = opcionesDeAsignacion({ agenteId: 'a1', agenteNombre: 'Bautista X', miembros })
    expect(ops.map((o) => o.id)).toEqual(['a1', 's1', 's2'])
  })

  it('deja afuera inactivos y asistentes de otro agente', () => {
    const ids = opcionesDeAsignacion({ agenteId: 'a1', agenteNombre: null, miembros }).map((o) => o.id)
    expect(ids).not.toContain('s3')
    expect(ids).not.toContain('s4')
    expect(ids).not.toContain('a2')
  })

  it('un agente que no está en la lista igual aparece, con el nombre que se le pasa', () => {
    const soloAsistentes = miembros.filter((m) => m.rol === 'ASISTENTE')
    const ops = opcionesDeAsignacion({ agenteId: 'a1', agenteNombre: 'Bautista X', miembros: soloAsistentes })
    expect(ops[0]).toEqual({ id: 'a1', nombre: 'Bautista X', rol: null })
    expect(ops.map((o) => o.id)).toEqual(['a1', 's1', 's2'])
  })

  it('sin agente no hay opciones', () => {
    expect(opcionesDeAsignacion({ agenteId: null, agenteNombre: 'X', miembros })).toEqual([])
  })

  it('sin asistentes queda solo el agente', () => {
    const ops = opcionesDeAsignacion({
      agenteId: 'a2',
      agenteNombre: null,
      miembros: [miembro('a2', 'Otra', 'AGENTE')],
    })
    expect(ops).toHaveLength(1)
  })
})

describe('nombreAsignado', () => {
  it('une nombre y apellido sin espacios de más', () => {
    expect(nombreAsignado({ nombre: 'Ana', apellido: 'Paz' })).toBe('Ana Paz')
    expect(nombreAsignado({ nombre: 'Ana', apellido: null })).toBe('Ana')
    expect(nombreAsignado(null)).toBeNull()
  })
})
