import { describe, expect, it } from 'vitest'
import { CLASES_CALENDARIO_FIJO, CLASES_PANEL_FIJO } from './calendarioFijo'

describe.each([
  ['calendario', CLASES_CALENDARIO_FIJO],
  ['panel', CLASES_PANEL_FIJO],
])('modo fijo del %s', (_nombre, clases) => {
  const lista = clases.split(/\s+/)

  it('se activa solo por ancho (lg), sin condición de alto', () => {
    expect(lista).toEqual(expect.arrayContaining(['lg:sticky', 'lg:top-20', 'lg:self-start']))
    expect(clases).not.toMatch(/min-height|48rem|@media/)
  })

  it('topea el alto a la ventana y scrollea por dentro', () => {
    expect(lista).toContain('lg:max-h-[calc(100dvh_-_6rem_-_env(safe-area-inset-bottom))]')
    expect(lista).toContain('lg:overflow-y-auto')
  })

  it('no atrapa la rueda: sin overscroll-contain, el scroll pasa a la página', () => {
    expect(clases).not.toContain('overscroll')
  })

  it('no deja ninguna clase sin prefijo de breakpoint (debajo de lg es el layout apilado)', () => {
    expect(lista.every((c) => c.startsWith('lg:'))).toBe(true)
  })
})
