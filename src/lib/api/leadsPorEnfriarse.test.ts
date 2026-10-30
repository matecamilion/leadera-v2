import { describe, expect, it, vi } from 'vitest'

// El módulo crea el cliente de Supabase al importarse y sin variables de entorno
// lanza. Acá solo se prueba la función pura.
vi.mock('../supabase', () => ({ supabase: {} }))

import { aPorEnfriarse } from './leadsPorEnfriarse'

const fila = {
  lead_id: 'a',
  nombre: 'Ana',
  apellido: null as unknown as string,
  estado: null as unknown as 'FRIO',
  ultimo_contacto: '2026-10-01T12:00:00Z',
  dias_sin_contacto: 29,
  importado: false,
  total: 37,
}

describe('aPorEnfriarse', () => {
  it('sin filas devuelve lista vacía y total 0', () => {
    expect(aPorEnfriarse([])).toEqual({ leads: [], total: 0 })
  })

  it('toma el total de la primera fila y no lo deja dentro de cada lead', () => {
    const r = aPorEnfriarse([fila, { ...fila, lead_id: 'b' }])
    expect(r.total).toBe(37)
    expect(r.leads).toHaveLength(2)
    expect('total' in r.leads[0]).toBe(false)
  })

  it('conserva apellido y estado nulos', () => {
    const [lead] = aPorEnfriarse([fila]).leads
    expect(lead.apellido).toBeNull()
    expect(lead.estado).toBeNull()
  })
})
