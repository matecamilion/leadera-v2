import { describe, expect, it, vi } from 'vitest'

vi.mock('./supabase', () => ({ supabase: {} }))

import {
  MENSAJE_FORMATO_NO_COMPATIBLE,
  mensajeDeLote,
  motivoLegible,
  planearLote,
  textoFaltanFotos,
  type ResultadoLote,
} from './fotosLote'

const lote = (parcial: Partial<ResultadoLote>): ResultadoLote => ({
  subidas: 0,
  total: 0,
  descartadas: 0,
  fallos: [],
  cortadoPorPermiso: false,
  ...parcial,
})

describe('planearLote', () => {
  it('entra todo lo que cabe', () => {
    expect(planearLote(['a', 'b', 'c'], 0)).toEqual({ aSubir: ['a', 'b', 'c'], descartadas: 0 })
  })

  it('el cupo es lo que queda hasta 10', () => {
    expect(planearLote(['a', 'b', 'c'], 8)).toEqual({ aSubir: ['a', 'b'], descartadas: 1 })
  })

  it('descarta las que sobran y conserva el orden de las primeras', () => {
    const archivos = ['1', '2', '3', '4', '5']
    expect(planearLote(archivos, 7)).toEqual({ aSubir: ['1', '2', '3'], descartadas: 2 })
  })

  it('con el cupo en 0 no entra nada', () => {
    expect(planearLote(['a', 'b'], 10)).toEqual({ aSubir: [], descartadas: 2 })
  })

  it('con más fotos que el tope no da cupo negativo', () => {
    expect(planearLote(['a'], 12)).toEqual({ aSubir: [], descartadas: 1 })
  })
})

describe('textoFaltanFotos', () => {
  it('singular y plural', () => {
    expect(textoFaltanFotos(1)).toBe('Subí 1 foto más para crear el flyer')
    expect(textoFaltanFotos(2)).toBe('Subí 2 fotos más para crear el flyer')
    expect(textoFaltanFotos(3)).toBe('Subí 3 fotos más para crear el flyer')
  })
})

describe('motivoLegible', () => {
  it('"No pudimos leer…" se muestra como formato no compatible', () => {
    expect(motivoLegible('No pudimos leer "casa.heic". Probá con otra foto.')).toBe(
      MENSAJE_FORMATO_NO_COMPATIBLE,
    )
  })

  it('"no es una imagen" también', () => {
    expect(motivoLegible('El archivo "casa.heic" no es una imagen.')).toBe(
      MENSAJE_FORMATO_NO_COMPATIBLE,
    )
  })

  it('el texto es el pedido', () => {
    expect(MENSAJE_FORMATO_NO_COMPATIBLE).toBe(
      'Formato no compatible: probá con una foto JPG o PNG',
    )
  })

  it('el resto de los motivos queda como vino', () => {
    expect(motivoLegible('No se pudo subir la foto: timeout')).toBe(
      'No se pudo subir la foto: timeout',
    )
    expect(motivoLegible('"x.jpg" supera el máximo de 25 MB.')).toBe(
      '"x.jpg" supera el máximo de 25 MB.',
    )
  })
})

describe('mensajeDeLote', () => {
  it('sin fallas ni descartes no hay nada que decir', () => {
    expect(mensajeDeLote(lote({ subidas: 3, total: 3 }))).toBeNull()
  })

  it('con descartes: avisa cuántas subieron y el máximo', () => {
    expect(mensajeDeLote(lote({ subidas: 2, total: 2, descartadas: 3 }))).toEqual({
      tipo: 'aviso',
      texto: 'Se subieron 2; el máximo es 10 fotos por propiedad',
    })
  })

  it('con una falla: cuántas de cuántas y el motivo', () => {
    const m = mensajeDeLote(
      lote({
        subidas: 2,
        total: 3,
        fallos: [{ archivo: 'a.jpg', motivo: 'No se pudo subir la foto: red caída' }],
      }),
    )
    expect(m).toEqual({
      tipo: 'error',
      texto: 'Se subieron 2 de 3. Falló: No se pudo subir la foto: red caída',
    })
  })

  it('con formato ilegible usa el texto amigable', () => {
    const m = mensajeDeLote(
      lote({
        subidas: 1,
        total: 2,
        fallos: [{ archivo: 'a.heic', motivo: 'No pudimos leer "a.heic". Probá con otra foto.' }],
      }),
    )
    expect(m?.texto).toBe(`Se subieron 1 de 2. Falló: ${MENSAJE_FORMATO_NO_COMPATIBLE}`)
  })

  it('no repite un mismo motivo y junta los distintos', () => {
    const m = mensajeDeLote(
      lote({
        subidas: 0,
        total: 3,
        fallos: [
          { archivo: 'a', motivo: 'El archivo "a" no es una imagen.' },
          { archivo: 'b', motivo: 'El archivo "b" no es una imagen.' },
          { archivo: 'c', motivo: 'No se pudo subir la foto: timeout' },
        ],
      }),
    )
    expect(m?.texto).toBe(
      `Se subieron 0 de 3. Falló: ${MENSAJE_FORMATO_NO_COMPATIBLE}; No se pudo subir la foto: timeout`,
    )
  })

  it('si se cortó por permiso lo dice', () => {
    const m = mensajeDeLote(
      lote({
        subidas: 0,
        total: 3,
        cortadoPorPermiso: true,
        fallos: [{ archivo: 'a', motivo: 'No tenés permiso para editar esta propiedad.' }],
      }),
    )
    expect(m?.tipo).toBe('error')
    expect(m?.texto).toContain('Se detuvo la carga')
  })

  it('con fallas y descartes avisa de las dos cosas', () => {
    const m = mensajeDeLote(
      lote({
        subidas: 1,
        total: 2,
        descartadas: 2,
        fallos: [{ archivo: 'a', motivo: 'No se pudo subir la foto: x' }],
      }),
    )
    expect(m?.tipo).toBe('error')
    expect(m?.texto).toContain('el máximo es 10 fotos por propiedad')
  })
})
