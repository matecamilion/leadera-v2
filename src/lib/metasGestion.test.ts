import { describe, expect, it } from 'vitest'
import { METAS_GESTION } from '../../supabase/functions/_shared/metasGestion.ts'
import {
  esEstadoVacio,
  nombreAnillo,
  seccionGestionHtml,
  textoEstado,
} from '../../supabase/functions/_shared/seccionGestion.ts'
import { METAS_SEMANALES } from './detalleGestion'

describe('metas del reporte semanal', () => {
  it('la copia de las funciones coincide con METAS_SEMANALES del front', () => {
    expect(METAS_GESTION).toEqual(METAS_SEMANALES)
  })
})

describe('nombreAnillo', () => {
  it.each([
    [0, 15, 'anillo-000.png'],
    [1, 15, 'anillo-005.png'],
    [7, 15, 'anillo-045.png'],
    [14, 15, 'anillo-095.png'],
    [15, 15, 'anillo-100.png'],
    [20, 15, 'anillo-100.png'],
    [1, 3, 'anillo-035.png'],
    [2, 3, 'anillo-065.png'],
    [0, 1, 'anillo-000.png'],
    [1, 1, 'anillo-100.png'],
    [5, 0, 'anillo-000.png'],
    [1, 100, 'anillo-005.png'],
    [199, 200, 'anillo-095.png'],
  ])('(%i, %i) -> %s', (valor, meta, esperado) => {
    expect(nombreAnillo(valor, meta)).toBe(esperado)
  })
})

describe('textoEstado', () => {
  it('dice cuánto falta', () => {
    expect(textoEstado(7, 15)).toBe('Faltan 8')
    expect(textoEstado(2, 3)).toBe('Falta 1')
    expect(textoEstado(15, 15)).toBe('Meta cumplida')
    expect(textoEstado(20, 15)).toBe('Meta cumplida')
  })
})

describe('seccionGestionHtml', () => {
  it('arma los tres anillos con su texto de respaldo', () => {
    const html = seccionGestionHtml({
      periodo_inicio: '2026-10-12',
      verdes: 7,
      prelistings: 1,
      prebuyings: 1,
      nuevos_contactos: 0,
    })
    expect(html).toContain('alt="7 de 15"')
    expect(html).toContain('alt="2 de 3"')
    expect(html).toContain('alt="0 de 1"')
    expect(html).toContain('/email/anillos/anillo-045.png')
    expect(html).toContain('/email/anillos/anillo-065.png')
    expect(html).toContain('/email/anillos/anillo-000.png')
  })
})

describe('estado vacío de la sección', () => {
  it('es vacío sólo cuando las tres métricas son 0', () => {
    expect(esEstadoVacio(0, 0, 0)).toBe(true)
    expect(esEstadoVacio(1, 0, 0)).toBe(false)
    expect(esEstadoVacio(0, 1, 0)).toBe(false)
    expect(esEstadoVacio(0, 0, 1)).toBe(false)
  })

  it('la variante vacía no lleva imágenes y la normal sí', () => {
    const vacia = seccionGestionHtml({
      periodo_inicio: '2026-10-12',
      verdes: 0,
      prelistings: 0,
      prebuyings: 0,
      nuevos_contactos: 0,
    })
    const normal = seccionGestionHtml({
      periodo_inicio: '2026-10-12',
      verdes: 0,
      prelistings: 0,
      prebuyings: 0,
      nuevos_contactos: 1,
    })
    expect(vacia).not.toContain('<img')
    expect(vacia).toContain('Todavía no hay actividad registrada esta semana.')
    expect(vacia).toContain('15 reuniones y visitas, 3 prelistings y prebuyings, 1 contacto nuevo.')
    expect(normal).toContain('<img')
  })
})
