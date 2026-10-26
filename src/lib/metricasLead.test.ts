import { describe, expect, it } from 'vitest'
import {
  desgloseInteracciones,
  diasDesde,
  diasEntre,
  fechaCompleta,
  textoEnCartera,
  textoHace,
  textoProximaVisita,
  textoUltimoContacto,
} from './metricasLead'

const sinNada = { total: 0, llamadas: 0, whatsapps: 0, emails: 0, reuniones: 0 }

describe('desgloseInteracciones', () => {
  it('sin interacciones', () => {
    expect(desgloseInteracciones(sinNada)).toBe('Sin interacciones')
  })

  it('solo las partes no nulas, con "otras" por la diferencia', () => {
    expect(desgloseInteracciones({ ...sinNada, total: 8, whatsapps: 2 })).toBe('2 WhatsApp · 6 otras')
  })

  it('respeta el orden llamadas, WhatsApp, mails, reuniones', () => {
    expect(
      desgloseInteracciones({ total: 10, reuniones: 2, emails: 1, whatsapps: 3, llamadas: 4 }),
    ).toBe('4 llamadas · 3 WhatsApp · 1 mail · 2 reuniones')
  })

  it('singular y plural', () => {
    expect(desgloseInteracciones({ ...sinNada, total: 1, llamadas: 1 })).toBe('1 llamada')
    expect(desgloseInteracciones({ ...sinNada, total: 3, llamadas: 3 })).toBe('3 llamadas')
    expect(desgloseInteracciones({ ...sinNada, total: 1, reuniones: 1 })).toBe('1 reunión')
    expect(desgloseInteracciones({ ...sinNada, total: 2, emails: 1 })).toBe('1 mail · 1 otra')
  })

  it('sin "otras" cuando el desglose suma el total', () => {
    expect(desgloseInteracciones({ ...sinNada, total: 2, llamadas: 1, emails: 1 })).toBe(
      '1 llamada · 1 mail',
    )
  })

  it('un total menor que la suma no da "otras" negativas', () => {
    expect(desgloseInteracciones({ ...sinNada, total: 1, llamadas: 2 })).toBe('2 llamadas')
  })
})

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

  it('un instante de la madrugada UTC cae en el día anterior de Buenos Aires', () => {
    expect(fechaCompleta('2026-11-01T01:00:00Z')).toBe('31/10/2026')
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

describe('textoProximaVisita', () => {
  it('con fecha y hora', () => {
    expect(textoProximaVisita({ fecha: '2026-10-28', hora: '15:30:00', agendadas: 1 })).toBe(
      'Próxima: 28/10 · 15:30',
    )
  })

  it('sin hora', () => {
    expect(textoProximaVisita({ fecha: '2026-11-03', hora: null, agendadas: 2 })).toBe('Próxima: 03/11')
  })

  it('sin próxima pero con agendadas', () => {
    expect(textoProximaVisita({ fecha: null, hora: null, agendadas: 1 })).toBe('1 agendada')
    expect(textoProximaVisita({ fecha: null, hora: null, agendadas: 3 })).toBe('3 agendadas')
  })

  it('sin nada agendado', () => {
    expect(textoProximaVisita({ fecha: null, hora: null, agendadas: 0 })).toBe('Sin visitas agendadas')
  })
})

describe('textoEnCartera', () => {
  it('con primer contacto, cuenta los días entre ingreso y contacto', () => {
    expect(textoEnCartera('2026-10-29T15:00:00Z', '2026-11-02T15:00:00Z')).toBe('Primer contacto a los 4 días')
  })

  it('el mismo día y al día siguiente', () => {
    expect(textoEnCartera('2026-10-29T13:00:00Z', '2026-10-29T20:00:00Z')).toBe('Primer contacto el mismo día')
    expect(textoEnCartera('2026-10-29T13:00:00Z', '2026-10-30T13:00:00Z')).toBe('Primer contacto al día siguiente')
  })

  it('sin primer contacto, la fecha de ingreso', () => {
    expect(textoEnCartera('2026-10-29T15:00:00Z', null)).toBe('Ingresó el 29/10/2026')
  })
})
