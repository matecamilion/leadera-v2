import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useMediaQuery } from './useMediaQuery'

const QUERY = '(max-width: 767px)'

/** matchMedia simulado: `ancho` decide si la query se cumple. */
function simularMatchMedia(anchoInicial: number) {
  let ancho = anchoInicial
  const oyentes = new Set<() => void>()
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      get matches() {
        return query === QUERY ? ancho <= 767 : false
      },
      media: query,
      addEventListener: (_: string, fn: () => void) => oyentes.add(fn),
      removeEventListener: (_: string, fn: () => void) => oyentes.delete(fn),
    })),
  )
  return {
    oyentes,
    cambiarAncho(nuevo: number) {
      ancho = nuevo
      oyentes.forEach((fn) => fn())
    },
  }
}

describe('useMediaQuery', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('arranca con lo que dice la media query', () => {
    simularMatchMedia(500)
    expect(renderHook(() => useMediaQuery(QUERY)).result.current).toBe(true)
    simularMatchMedia(1200)
    expect(renderHook(() => useMediaQuery(QUERY)).result.current).toBe(false)
  })

  it('se actualiza al pasar de chico a grande y de grande a chico', () => {
    const sim = simularMatchMedia(500)
    const { result } = renderHook(() => useMediaQuery(QUERY))
    expect(result.current).toBe(true)
    act(() => sim.cambiarAncho(1200))
    expect(result.current).toBe(false)
    act(() => sim.cambiarAncho(400))
    expect(result.current).toBe(true)
  })

  it('al desmontar deja de escuchar', () => {
    const sim = simularMatchMedia(500)
    const { unmount } = renderHook(() => useMediaQuery(QUERY))
    expect(sim.oyentes.size).toBe(1)
    unmount()
    expect(sim.oyentes.size).toBe(0)
  })

  it('sin matchMedia (jsdom) no se cumple y no rompe', () => {
    vi.stubGlobal('matchMedia', undefined)
    expect(renderHook(() => useMediaQuery(QUERY)).result.current).toBe(false)
  })
})
