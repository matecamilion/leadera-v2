import { describe, expect, it } from 'vitest'
import { ORIGENES_VEDADOS, esOrigenImportable, traducirOrigen } from './origenes'

describe('traducirOrigen', () => {
  it.each([
    ['ZonaProp', 'ZONAPROP'],
    ['ZONAPROP', 'ZONAPROP'],
    ['zonaprop', 'ZONAPROP'],
    ['Argenprop', 'ARGENPROP'],
    ['ARGENPROP', 'ARGENPROP'],
    ['Mercado Libre', 'MERCADO_LIBRE'],
    ['MERCADO LIBRE', 'MERCADO_LIBRE'],
    ['MercadoLibre', 'MERCADO_LIBRE'],
    ['WhatsApp', 'WHATSAPP'],
    ['WhatsApp (C21)', 'WHATSAPP'],
    ['web-form', 'FORMULARIO_WEB'],
    ['Formulario', 'FORMULARIO_WEB'],
    ['Formulario web', 'FORMULARIO_WEB'],
    ['Instagram', 'INSTAGRAM'],
    ['Facebook', 'FACEBOOK'],
    ['Meta Ads', 'META_ADS'],
    ['Landing', 'LANDING'],
  ])('"%s" es %s', (texto, esperado) => {
    expect(traducirOrigen(texto)).toBe(esperado)
  })

  it('no distingue mayúsculas, tildes ni espacios de más', () => {
    expect(traducirOrigen('  ZONAPROP ')).toBe('ZONAPROP')
    expect(traducirOrigen('Mercado Líbre')).toBe('MERCADO_LIBRE')
    expect(traducirOrigen('WHATSAPP  (c21)')).toBe('WHATSAPP')
  })

  it('lo desconocido, incluido "Century 21", es OTRO', () => {
    expect(traducirOrigen('Century 21')).toBe('OTRO')
    expect(traducirOrigen('Cartel en la calle')).toBe('OTRO')
    expect(traducirOrigen('???')).toBe('OTRO')
  })

  it('nunca devuelve MANUAL, REFERIDO ni LINK_CONSULTA, aunque el archivo los nombre', () => {
    for (const texto of ['MANUAL', 'Manual', 'REFERIDO', 'Referido', 'LINK_CONSULTA', 'Link de consultas']) {
      expect(traducirOrigen(texto)).toBe('OTRO')
    }
  })
})

describe('esOrigenImportable', () => {
  it('rechaza los orígenes vedados y acepta el resto', () => {
    for (const vedado of ORIGENES_VEDADOS) expect(esOrigenImportable(vedado)).toBe(false)
    for (const valor of ['IMPORTACION', 'ZONAPROP', 'ARGENPROP', 'MERCADO_LIBRE', 'OTRO', 'WHATSAPP']) {
      expect(esOrigenImportable(valor)).toBe(true)
    }
  })
})
