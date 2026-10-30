import { describe, expect, it } from 'vitest'
import { avisosDeContraste, derivarPaleta } from './color'
import {
  cambiarColor,
  elegirAtajo,
  normalizarHex,
  paletaDeAtajo,
  paletaDeEleccion,
} from './eleccionColor'
import { PALETAS } from './paletas'

describe('normalizarHex', () => {
  it('acepta #rrggbb con o sin #, en cualquier caso y con espacios', () => {
    expect(normalizarHex('#AD8420')).toBe('#ad8420')
    expect(normalizarHex(' ad8420 ')).toBe('#ad8420')
  })

  it('rechaza lo que no es de seis dígitos hexadecimales', () => {
    for (const malo of ['', '#', '#fff', '#12345', '#1234567', '#gggggg', 'rojo', '##ad8420']) {
      expect(normalizarHex(malo)).toBeNull()
    }
  })
})

describe('atajos y colores personalizados', () => {
  it('un atajo muestra su acento y su fondo en los selectores', () => {
    const e = elegirAtajo('bosque')
    expect(e).toEqual({ clave: 'bosque', primario: '#8fd4a6', secundario: '#0c3a2c' })
  })

  it('la paleta de un atajo es exactamente la de PALETAS, sin recalcular', () => {
    for (const p of PALETAS) expect(paletaDeEleccion(elegirAtajo(p.clave))).toBe(p)
    expect(paletaDeAtajo('dorado').acentoTexto).toBe('#765a10')
  })

  it('cambiar cualquiera de los dos colores pasa a personalizada', () => {
    const base = elegirAtajo('salvia')
    const a = cambiarColor(base, 'primario', '#112233')
    expect(a).toEqual({ clave: 'personalizada', primario: '#112233', secundario: base.secundario })
    const b = cambiarColor(base, 'secundario', '#445566')
    expect(b).toEqual({ clave: 'personalizada', primario: base.primario, secundario: '#445566' })
  })

  it('la paleta personalizada sale de derivarPaleta', () => {
    const e = cambiarColor(elegirAtajo('negro'), 'primario', '#e63946')
    expect(paletaDeEleccion(e)).toEqual(derivarPaleta('#e63946', '#ffffff'))
  })
})

describe('aviso de contraste según la elección', () => {
  it('ningún atajo avisa', () => {
    for (const p of PALETAS) expect(avisosDeContraste(paletaDeEleccion(elegirAtajo(p.clave)))).toEqual([])
  })

  it('amarillo sobre blanco avisa', () => {
    const e = cambiarColor(elegirAtajo('negro'), 'primario', '#ffeb00')
    expect(avisosDeContraste(paletaDeEleccion(e)).map((a) => a.par)).toContain('acento')
  })

  it('un par que se lee bien no avisa', () => {
    const e = cambiarColor(cambiarColor(elegirAtajo('negro'), 'primario', '#1d3557'), 'secundario', '#f1faee')
    expect(avisosDeContraste(paletaDeEleccion(e))).toEqual([])
  })
})
