import { describe, expect, it } from 'vitest'
import { normalizarPayloadPush, resolverUrlInterna } from './pushPayload'

const ORIGEN = 'https://app.leadera.test'

describe('normalizarPayloadPush', () => {
  it('lee un JSON válido', () => {
    const p = normalizarPayloadPush(
      JSON.stringify({ title: 'Seguimiento', body: 'Llamar a Ana', url: '/leads/1', tag: 'seg:1' }),
    )
    expect(p).toEqual({ title: 'Seguimiento', body: 'Llamar a Ana', url: '/leads/1', tag: 'seg:1' })
  })

  it('usa el texto plano como cuerpo (lo que manda DevTools)', () => {
    expect(normalizarPayloadPush('Test push message from DevTools.')).toEqual({
      title: 'LeadEra',
      body: 'Test push message from DevTools.',
      url: '/',
    })
  })

  it('con JSON roto usa el texto como cuerpo', () => {
    expect(normalizarPayloadPush('{"title": "x"').body).toBe('{"title": "x"')
  })

  it('con tipos incorrectos cae a los defaults', () => {
    const p = normalizarPayloadPush(JSON.stringify({ title: 5, body: { a: 1 }, url: 7, tag: [] }))
    expect(p).toEqual({ title: 'LeadEra', body: '', url: '/' })
  })

  it('un JSON que no es objeto da defaults', () => {
    expect(normalizarPayloadPush('[1,2]').url).toBe('/')
    expect(normalizarPayloadPush('42').title).toBe('LeadEra')
  })

  it('con null da el payload genérico', () => {
    expect(normalizarPayloadPush(null)).toEqual({ title: 'LeadEra', body: '', url: '/' })
  })

  it('recorta strings enormes', () => {
    const grande = 'a'.repeat(5000)
    const p = normalizarPayloadPush(JSON.stringify({ title: grande, body: grande, tag: grande }))
    expect(p.title).toHaveLength(100)
    expect(p.body).toHaveLength(300)
    expect(p.tag).toHaveLength(64)
    expect(normalizarPayloadPush(grande).body).toHaveLength(300)
  })

  it('descarta un tag con caracteres inválidos', () => {
    expect(normalizarPayloadPush(JSON.stringify({ tag: 'a b<script>' })).tag).toBeUndefined()
  })
})

describe('resolverUrlInterna', () => {
  it('deja pasar una ruta relativa con query y hash', () => {
    expect(resolverUrlInterna('/leads/1?tab=notas#fin', ORIGEN)).toBe('/leads/1?tab=notas#fin')
  })

  it('acepta una URL absoluta del mismo origen', () => {
    expect(resolverUrlInterna(`${ORIGEN}/mi-dia`, ORIGEN)).toBe('/mi-dia')
  })

  it.each(['//evil.com', '/\\evil.com', 'https://evil.com', 'javascript:alert(1)', ''])(
    'rechaza %j',
    (url) => {
      expect(resolverUrlInterna(url, ORIGEN)).toBe('/')
    },
  )
})
