import { describe, expect, it } from 'vitest'
import { detectarPlataforma } from './instalarApp'

const nav = (userAgent: string, platform = '', maxTouchPoints = 0, standalone?: boolean) => ({
  userAgent,
  platform,
  maxTouchPoints,
  standalone,
})

describe('detectarPlataforma', () => {
  it('reconoce iPhone', () => {
    const p = detectarPlataforma(nav('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'), () => false)
    expect(p).toEqual({ esIos: true, instalada: false })
  })

  it('reconoce un iPad que se reporta como Mac', () => {
    const p = detectarPlataforma(nav('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 5), () => false)
    expect(p.esIos).toBe(true)
  })

  it('una Mac sin pantalla táctil no es iOS', () => {
    const p = detectarPlataforma(nav('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 0), () => false)
    expect(p.esIos).toBe(false)
  })

  it('Android no es iOS', () => {
    const p = detectarPlataforma(nav('Mozilla/5.0 (Linux; Android 14)', 'Linux armv81', 5), () => false)
    expect(p.esIos).toBe(false)
  })

  it('instalada por display-mode standalone', () => {
    expect(detectarPlataforma(nav('Mozilla/5.0 (Windows NT 10.0)'), () => true).instalada).toBe(true)
  })

  it('instalada por navigator.standalone (iOS)', () => {
    const p = detectarPlataforma(nav('Mozilla/5.0 (iPhone)', '', 0, true), () => false)
    expect(p.instalada).toBe(true)
  })
})
