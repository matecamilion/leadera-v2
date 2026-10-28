import { describe, expect, it, vi } from 'vitest'

// El módulo crea el cliente de Supabase al importarse y sin variables de entorno
// lanza. Acá solo se prueban las funciones puras.
vi.mock('../supabase', () => ({ supabase: {} }))

import {
  construirMensajeReconfirmacion,
  contactoDeVisita,
  diaSiguiente,
  nombreDelDia,
} from './visitas'

describe('diaSiguiente', () => {
  it('suma un día dentro del mes', () => {
    expect(diaSiguiente('2026-10-28')).toBe('2026-10-29')
  })

  it('cruza el fin de mes', () => {
    expect(diaSiguiente('2026-10-31')).toBe('2026-11-01')
    expect(diaSiguiente('2026-04-30')).toBe('2026-05-01')
  })

  it('cruza el fin de año', () => {
    expect(diaSiguiente('2026-12-31')).toBe('2027-01-01')
  })

  it('respeta febrero en año bisiesto y no bisiesto', () => {
    expect(diaSiguiente('2028-02-28')).toBe('2028-02-29')
    expect(diaSiguiente('2028-02-29')).toBe('2028-03-01')
    expect(diaSiguiente('2027-02-28')).toBe('2027-03-01')
  })
})

describe('nombreDelDia', () => {
  it('devuelve el día de la semana en castellano', () => {
    expect(nombreDelDia('2026-10-26')).toBe('lunes')
    expect(nombreDelDia('2026-10-28')).toBe('miércoles')
    expect(nombreDelDia('2026-10-31')).toBe('sábado')
    expect(nombreDelDia('2026-11-01')).toBe('domingo')
  })
})

describe('construirMensajeReconfirmacion', () => {
  const base = {
    nombre: 'Juan',
    fecha: '2026-10-29',
    hora: '10:30:00',
    hoy: '2026-10-28',
    direccion: 'Alvear 3355',
  }

  it('dice "mañana" con día de la semana, fecha, hora sin segundos y dirección', () => {
    expect(construirMensajeReconfirmacion(base)).toBe(
      'Hola Juan! Te escribo para reconfirmar la visita de mañana, jueves 29/10, a las 10:30, en Alvear 3355.\n¿Seguimos en pie?',
    )
  })

  it('dice "hoy" cuando la visita es hoy', () => {
    const mensaje = construirMensajeReconfirmacion({ ...base, fecha: '2026-10-28' })
    expect(mensaje).toContain('la visita de hoy, miércoles 28/10,')
  })

  it('agrega el link de la publicación de una visita externa', () => {
    const mensaje = construirMensajeReconfirmacion({
      ...base,
      direccion: 'Casa en Los Troncos',
      link: 'https://portal.com/aviso/123',
    })
    expect(mensaje).toBe(
      'Hola Juan! Te escribo para reconfirmar la visita de mañana, jueves 29/10, a las 10:30, en Casa en Los Troncos.\nPublicación: https://portal.com/aviso/123\n¿Seguimos en pie?',
    )
  })

  it('no agrega la línea del link si la visita externa no lo tiene', () => {
    expect(construirMensajeReconfirmacion({ ...base, link: null })).not.toContain('Publicación')
  })

  it('omite la hora si la visita no la tiene', () => {
    const mensaje = construirMensajeReconfirmacion({ ...base, hora: null })
    expect(mensaje).toContain('jueves 29/10, en Alvear 3355.')
    expect(mensaje).not.toContain('a las')
  })

  it('formatea la fecha con ceros y no corre un día', () => {
    const mensaje = construirMensajeReconfirmacion({ ...base, fecha: '2027-01-05', hoy: '2027-01-04' })
    expect(mensaje).toContain('martes 05/01')
  })
})

describe('contactoDeVisita', () => {
  it('sin cliente solo se puede marcar', () => {
    expect(contactoDeVisita(null)).toBe('SIN_CLIENTE')
  })

  it('cliente sin teléfono o con uno vacío pide completarlo', () => {
    expect(contactoDeVisita({ telefono: null })).toBe('SIN_TELEFONO')
    expect(contactoDeVisita({ telefono: '' })).toBe('SIN_TELEFONO')
  })

  it('cliente con un teléfono que no es confiable pide completarlo', () => {
    expect(contactoDeVisita({ telefono: '12345678' })).toBe('SIN_TELEFONO')
  })

  it('cliente con un celular argentino completo permite WhatsApp', () => {
    expect(contactoDeVisita({ telefono: '223 512-4477' })).toBe('CON_WHATSAPP')
  })
})
