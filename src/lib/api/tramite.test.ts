import { describe, expect, it, vi } from 'vitest'

// El módulo crea el cliente de Supabase al importarse y sin variables de entorno
// lanza. Acá solo se prueba lo puro.
vi.mock('../supabase', () => ({ supabase: {} }))

import {
  cambiosDeDesmarcar,
  cambiosDeFechaPrevista,
  cambiosDeMarcar,
  cambiosDeNoAplica,
  mensajeDeErrorPostventa,
  mensajeDeErrorTramite,
  MENSAJE_POSTVENTA_FALLIDA,
  MENSAJE_POSTVENTA_SIN_PERMISO,
  MENSAJE_SIN_PERMISO_TRAMITE,
} from './tramite'

describe('cambiosDeMarcar', () => {
  it('completa con la fecha, saca el "no aplica" y deja al usuario', () => {
    expect(cambiosDeMarcar('2026-10-28', 'u1')).toEqual({
      fecha_completado: '2026-10-28',
      no_aplica: false,
      completado_por: 'u1',
    })
  })
})

describe('cambiosDeNoAplica', () => {
  it('resuelve sin fecha', () => {
    expect(cambiosDeNoAplica('u1')).toEqual({
      fecha_completado: null,
      no_aplica: true,
      completado_por: 'u1',
    })
  })
})

describe('cambiosDeDesmarcar', () => {
  it('vuelve a pendiente sin tocar la fecha prevista ni la marca de postventa', () => {
    const cambios = cambiosDeDesmarcar()
    expect(cambios).toEqual({ fecha_completado: null, no_aplica: false, completado_por: null })
    expect(cambios).not.toHaveProperty('fecha_prevista')
    expect(cambios).not.toHaveProperty('postventa_generada_at')
  })
})

describe('cambiosDeFechaPrevista', () => {
  it('manda solo la fecha prevista, también para borrarla', () => {
    expect(cambiosDeFechaPrevista('2026-12-10')).toEqual({ fecha_prevista: '2026-12-10' })
    expect(cambiosDeFechaPrevista(null)).toEqual({ fecha_prevista: null })
  })
})

describe('mensajeDeErrorTramite', () => {
  it('un rechazo de la RLS (42501) lleva el mensaje de la ficha de operación', () => {
    expect(mensajeDeErrorTramite({ code: '42501', message: 'x' })).toBe(MENSAJE_SIN_PERMISO_TRAMITE)
  })

  it('reconoce el rechazo por el texto aunque no venga el código', () => {
    expect(
      mensajeDeErrorTramite({
        message: 'new row violates row-level security policy for table "operacion_tramite_pasos"',
      }),
    ).toBe(MENSAJE_SIN_PERMISO_TRAMITE)
  })

  it('el mensaje de permiso es el de actualizarEstadoOperacion', () => {
    expect(MENSAJE_SIN_PERMISO_TRAMITE).toBe('No tenés permiso para editar esta operación.')
  })

  it('el resto pasa por el intérprete y no muestra el texto crudo', () => {
    const mensaje = mensajeDeErrorTramite({ code: 'XX000', message: 'relation foo is broken' })
    expect(mensaje).not.toContain('foo')
    expect(mensaje.length).toBeGreaterThan(0)
  })
})

describe('mensajeDeErrorPostventa', () => {
  it('un rechazo de la RLS dice que no hay permiso, sin negar que la escritura quedó marcada', () => {
    const mensaje = mensajeDeErrorPostventa({ code: '42501', message: 'x' })
    expect(mensaje).toBe(MENSAJE_POSTVENTA_SIN_PERMISO)
    expect(mensaje).toContain('La escritura quedó marcada')
  })

  it('cualquier otro error explica cómo reintentar y no muestra el texto crudo', () => {
    const mensaje = mensajeDeErrorPostventa({ code: '23503', message: 'violates foreign key tareas_x' })
    expect(mensaje).toBe(MENSAJE_POSTVENTA_FALLIDA)
    expect(mensaje).not.toContain('tareas_x')
    expect(mensaje).toContain('reintentar')
  })
})
