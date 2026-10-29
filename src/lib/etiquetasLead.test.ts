import { describe, expect, it } from 'vitest'
import { ORIGENES_LEAD, etiquetaOrigen } from './etiquetasLead'

describe('etiquetaOrigen: portales', () => {
  it('ZonaProp, Argenprop y Mercado Libre tienen etiqueta legible', () => {
    expect(etiquetaOrigen('ZONAPROP')).toBe('ZonaProp')
    expect(etiquetaOrigen('ARGENPROP')).toBe('Argenprop')
    expect(etiquetaOrigen('MERCADO_LIBRE')).toBe('Mercado Libre')
  })

  it('no se ofrecen al cargar un lead a mano', () => {
    const valores = ORIGENES_LEAD.map((o) => o.valor) as string[]
    expect(valores).not.toContain('ZONAPROP')
    expect(valores).not.toContain('ARGENPROP')
    expect(valores).not.toContain('MERCADO_LIBRE')
  })

  it('los de sistema que ya existían siguen igual', () => {
    expect(etiquetaOrigen('IMPORTACION')).toBe('Importación')
    expect(etiquetaOrigen('LINK_CONSULTA')).toBe('Link de consultas')
    expect(etiquetaOrigen(null)).toBe('—')
  })
})
