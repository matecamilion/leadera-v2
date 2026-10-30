import { describe, expect, it } from 'vitest'
import {
  ajustarParaContraste,
  avisosDeContraste,
  BLANCO_CALIDO,
  contraste,
  derivarPaleta,
  NEGRO_CALIDO,
  textoSobre,
} from './color'
import { PALETAS } from './paletas'

const PRECIO_ESPERADO: Record<string, number> = {
  dorado: 5.04,
  terracota: 5.65,
  negro: 18.88,
  salvia: 6.03,
  bosque: 7.32,
  noche: 8.06,
  bordo: 8.78,
  carbon: 8.71,
}

describe('contraste', () => {
  it('negro sobre blanco da 21', () => {
    expect(contraste('#000000', '#ffffff')).toBeCloseTo(21, 5)
  })

  it('es simétrico', () => {
    expect(contraste('#ad8420', '#faf5e6')).toBeCloseTo(contraste('#faf5e6', '#ad8420'), 10)
  })

  it('coincide con el precio de las 8 paletas actuales', () => {
    for (const p of PALETAS) {
      expect(Math.abs(contraste(p.sobreAcento, p.acento) - PRECIO_ESPERADO[p.clave])).toBeLessThan(0.05)
    }
  })

  it('rechaza un hex mal formado con un mensaje claro', () => {
    expect(() => contraste('rojo', '#ffffff')).toThrow(/#rrggbb/)
    expect(() => contraste('#fff', '#ffffff')).toThrow(/#rrggbb/)
  })
})

describe('textoSobre', () => {
  it('negro cálido sobre claro y blanco cálido sobre oscuro', () => {
    expect(textoSobre('#faf5e6')).toBe(NEGRO_CALIDO)
    expect(textoSobre('#0a1f4d')).toBe(BLANCO_CALIDO)
  })
})

describe('ajustarParaContraste', () => {
  it('no toca un color que ya alcanza', () => {
    expect(ajustarParaContraste('#111111', '#ffffff', 4.5)).toBe('#111111')
  })

  it('oscurece sobre un fondo claro', () => {
    const r = ajustarParaContraste('#ad8420', '#faf5e6', 4.5)
    expect(contraste(r, '#faf5e6')).toBeGreaterThanOrEqual(4.5)
  })

  it('aclara sobre un fondo oscuro', () => {
    const r = ajustarParaContraste('#1a4a8a', '#0a1f4d', 4.5)
    expect(contraste(r, '#0a1f4d')).toBeGreaterThanOrEqual(4.5)
    expect(r > '#1a4a8a').toBe(true)
  })
})

describe('derivarPaleta', () => {
  const pares: [string, string][] = [
    ['#ad8420', '#faf5e6'],
    ['#e63946', '#ffffff'],
    ['#2a9d8f', '#0a1f4d'],
  ]

  it.each(pares)('acentoTexto de %s sobre %s alcanza 4,5', (primario, secundario) => {
    const paleta = derivarPaleta(primario, secundario)
    expect(paleta.fondo).toBe(secundario)
    expect(paleta.acento).toBe(primario)
    expect(contraste(paleta.acentoTexto, paleta.fondo)).toBeGreaterThanOrEqual(4.5)
  })

  it('rechaza colores inválidos', () => {
    expect(() => derivarPaleta('#12345', '#ffffff')).toThrow(/#rrggbb/)
    expect(() => derivarPaleta('#ffffff', 'azul')).toThrow(/#rrggbb/)
  })
})

describe('avisosDeContraste', () => {
  it('no avisa nada en las 8 paletas actuales', () => {
    for (const p of PALETAS) expect(avisosDeContraste(p)).toEqual([])
  })

  it('reporta amarillo sobre blanco', () => {
    const avisos = avisosDeContraste({
      clave: 'personalizada',
      nombre: 'Personalizada',
      fondo: '#ffffff',
      tinta: '#111111',
      acento: '#ffeb00',
      acentoTexto: '#ffeb00',
      sobreAcento: '#ffffff',
    })
    expect(avisos.map((a) => a.par)).toEqual(['sobreAcento', 'acento'])
    expect(avisos[0].ratio).toBeLessThan(4.5)
    expect(avisos[0].mensaje).toMatch(/se lee mal/)
  })
})
