import { describe, expect, it } from 'vitest'
import { diasDesde, diasEntre, textoHace, textoUltimoContacto } from './metricasLead'

describe('días por día calendario en Buenos Aires', () => {
  it('cruza el cambio de mes', () => {
    // 31/10 12:00 y 01/11 12:00 en Buenos Aires (UTC-3).
    expect(diasEntre('2026-10-31T15:00:00Z', '2026-11-01T15:00:00Z')).toBe(1)
    expect(diasEntre('2026-10-28T15:00:00Z', '2026-11-02T15:00:00Z')).toBe(5)
  })

  it('cuenta por día y no por horas: anoche tarde sigue siendo ayer', () => {
    // 23:00 del 30/10 en Buenos Aires = 02:00Z del 31/10; ahora, 09:00 del 31/10.
    const ahora = new Date('2026-10-31T12:00:00Z')
    expect(diasDesde('2026-10-31T02:00:00Z', ahora)).toBe(1)
  })

  it('hoy es 0 y nunca es negativo', () => {
    const ahora = new Date('2026-10-31T15:00:00Z')
    expect(diasDesde('2026-10-31T10:00:00Z', ahora)).toBe(0)
    expect(diasDesde('2026-11-05T10:00:00Z', ahora)).toBe(0)
  })
})

describe('textoHace y textoUltimoContacto', () => {
  it('hoy, ayer y hace N días', () => {
    expect(textoHace(0)).toBe('hoy')
    expect(textoHace(1)).toBe('ayer')
    expect(textoHace(4)).toBe('hace 4 días')
  })

  it('último contacto', () => {
    const ahora = new Date('2026-10-31T15:00:00Z')
    expect(textoUltimoContacto('2026-10-27T15:00:00Z', ahora)).toBe('Último: hace 4 días')
    expect(textoUltimoContacto(null, ahora)).toBe('Todavía sin contactar')
  })
})
