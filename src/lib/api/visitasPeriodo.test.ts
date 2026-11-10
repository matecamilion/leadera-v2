import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Cliente simulado: cada `from('visitas').select(...)` devuelve un constructor que
 * registra los filtros y, al esperarlo, responde según el estado que filtró.
 */
const { llamadas, respuestas } = vi.hoisted(() => ({
  llamadas: [] as { select: unknown[]; filtros: [string, ...unknown[]][] }[],
  respuestas: {
    REALIZADA: { count: 0, error: null as unknown },
    AGENDADA: { count: 0, error: null as unknown },
    CANCELADA: { count: 0, error: null as unknown },
  } as Record<string, { count: number | null; error: unknown }>,
}))

vi.mock('../supabase', () => ({
  supabase: {
    from: (tabla: string) => ({
      select: (...select: unknown[]) => {
        const llamada = { select: [tabla, ...select], filtros: [] as [string, ...unknown[]][] }
        llamadas.push(llamada)
        const constructor = {
          eq: (...a: unknown[]) => (llamada.filtros.push(['eq', ...a]), constructor),
          gte: (...a: unknown[]) => (llamada.filtros.push(['gte', ...a]), constructor),
          lte: (...a: unknown[]) => (llamada.filtros.push(['lte', ...a]), constructor),
          in: (...a: unknown[]) => (llamada.filtros.push(['in', ...a]), constructor),
          then: (resolver: (v: unknown) => unknown) => {
            const estado = llamada.filtros.find((f) => f[0] === 'eq' && f[1] === 'estado')?.[2]
            return Promise.resolve(respuestas[estado as string]).then(resolver)
          },
        }
        return constructor
      },
    }),
  },
}))

import { contarVisitasDelPeriodo } from './visitas'

beforeEach(() => {
  llamadas.length = 0
  respuestas.REALIZADA = { count: 0, error: null }
  respuestas.AGENDADA = { count: 0, error: null }
  respuestas.CANCELADA = { count: 0, error: null }
})

describe('contarVisitasDelPeriodo', () => {
  it('devuelve un conteo por estado', async () => {
    respuestas.REALIZADA = { count: 7, error: null }
    respuestas.AGENDADA = { count: 3, error: null }
    respuestas.CANCELADA = { count: 1, error: null }
    await expect(contarVisitasDelPeriodo('2026-11-01', '2026-11-30', ['a', 'b'])).resolves.toEqual({
      realizadas: 7,
      agendadas: 3,
      canceladas: 1,
    })
  })

  it('hace tres consultas head, una por estado, sobre la tabla visitas', async () => {
    await contarVisitasDelPeriodo('2026-11-01', '2026-11-30', ['a'])
    expect(llamadas).toHaveLength(3)
    for (const l of llamadas) {
      expect(l.select).toEqual(['visitas', 'id', { count: 'exact', head: true }])
    }
    const estados = llamadas.map((l) => l.filtros.find((f) => f[0] === 'eq')?.[2])
    expect(estados.sort()).toEqual(['AGENDADA', 'CANCELADA', 'REALIZADA'])
  })

  it('filtra por la fecha con los dos extremos incluidos y por el equipo, y por nada más', async () => {
    await contarVisitasDelPeriodo('2026-11-01', '2026-11-30', ['agente', 'asistente'])
    for (const l of llamadas) {
      expect(l.filtros).toContainEqual(['gte', 'fecha', '2026-11-01'])
      expect(l.filtros).toContainEqual(['lte', 'fecha', '2026-11-30'])
      expect(l.filtros).toContainEqual(['in', 'asignado_a', ['agente', 'asistente']])
      // Ni lead, ni propiedad, ni origen: entran las externas y las importadas.
      expect(l.filtros.map((f) => f[1]).sort()).toEqual(['asignado_a', 'estado', 'fecha', 'fecha'])
    }
  })

  it('un count nulo cuenta como cero', async () => {
    respuestas.REALIZADA = { count: null, error: null }
    const r = await contarVisitasDelPeriodo('2026-11-01', '2026-11-30', ['a'])
    expect(r.realizadas).toBe(0)
  })

  it('si una consulta falla, falla todo: no devuelve ceros inventados', async () => {
    respuestas.AGENDADA = { count: null, error: { message: 'boom', code: 'XX000' } }
    await expect(contarVisitasDelPeriodo('2026-11-01', '2026-11-30', ['a'])).rejects.toThrow()
  })

  it('sin equipo no consulta y devuelve ceros', async () => {
    await expect(contarVisitasDelPeriodo('2026-11-01', '2026-11-30', [])).resolves.toEqual({
      realizadas: 0,
      agendadas: 0,
      canceladas: 0,
    })
    expect(llamadas).toHaveLength(0)
  })
})
