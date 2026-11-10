import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAhora } from './useAhora'

describe('useAhora', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 10, 11, 10, 0, 0))
  })
  afterEach(() => vi.useRealTimers())

  it('se actualiza cada minuto', () => {
    const { result } = renderHook(() => useAhora())
    expect(result.current.getMinutes()).toBe(0)
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(result.current.getMinutes()).toBe(1)
  })

  it('se actualiza al volver a la pestaña', () => {
    const { result } = renderHook(() => useAhora())
    vi.setSystemTime(new Date(2026, 10, 11, 10, 30, 0))
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(result.current.getMinutes()).toBe(30)
  })

  it('detecta el cambio de día', () => {
    vi.setSystemTime(new Date(2026, 10, 11, 23, 59, 30))
    const { result } = renderHook(() => useAhora())
    expect(result.current.getDate()).toBe(11)
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(result.current.getDate()).toBe(12)
  })

  it('al desmontar limpia el intervalo', () => {
    const { unmount } = renderHook(() => useAhora())
    expect(vi.getTimerCount()).toBe(1)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
