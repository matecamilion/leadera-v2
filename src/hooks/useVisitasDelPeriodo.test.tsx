import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { contar } = vi.hoisted(() => ({ contar: vi.fn() }))

vi.mock('../lib/api/visitas', () => ({ contarVisitasDelPeriodo: contar }))
vi.mock('./useUid', () => ({ useUid: () => 'u1' }))
vi.mock('./useEquipoCalendario', () => ({
  useEquipoCalendario: () => ({
    equipo: { duenoCalendario: 'u1', equipoIds: ['u1', 'asis'] },
    listo: true,
  }),
}))
// Lo demás que importa `useVisitas` no se ejerce acá.
vi.mock('../lib/api/googleCalendar', () => ({ sincronizarConGoogle: vi.fn() }))

import { claves } from '../lib/queryKeys'
import { useVisitasDelPeriodo } from './useVisitas'

function montar() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
  )
  return { cliente, ...renderHook(() => useVisitasDelPeriodo(), { wrapper }) }
}

beforeEach(() => {
  contar.mockReset()
  vi.useRealTimers()
})

describe('useVisitasDelPeriodo', () => {
  it('pide el mes en curso del equipo del calendario', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 12, 12, 0, 0))
    contar.mockResolvedValue({ realizadas: 2, agendadas: 1, canceladas: 0 })
    const { result } = montar()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(contar).toHaveBeenCalledWith('2026-11-01', '2026-11-30', ['u1', 'asis'])
    expect(result.current.data).toEqual({ realizadas: 2, agendadas: 1, canceladas: 0 })
  })

  it('cuelga de la raíz de visitas: invalidarla (como hacen marcar realizada, cancelar, crear y eliminar) la recalcula', async () => {
    contar.mockResolvedValueOnce({ realizadas: 0, agendadas: 1, canceladas: 0 })
    const { result, cliente } = montar()
    await waitFor(() => expect(result.current.data?.agendadas).toBe(1))

    // Es lo que hace `onSettled` de `useCambiarEstadoVisita` al marcar una visita como realizada.
    contar.mockResolvedValueOnce({ realizadas: 1, agendadas: 0, canceladas: 0 })
    await cliente.invalidateQueries({ queryKey: claves.visitas.raiz })

    await waitFor(() => expect(result.current.data).toEqual({ realizadas: 1, agendadas: 0, canceladas: 0 }))
    expect(contar).toHaveBeenCalledTimes(2)
  })

  it('el usuario y el equipo van en la clave', () => {
    expect(claves.visitas.delPeriodo('u1', 'eq', '2026-11-01', '2026-11-30')).toEqual([
      'visitas',
      'del-periodo',
      'u1',
      'eq',
      '2026-11-01',
      '2026-11-30',
    ])
  })

  it('un error queda como error, sin datos', async () => {
    contar.mockRejectedValue(new Error('x'))
    const { result } = montar()
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.data).toBeUndefined()
  })
})
