import { describe, expect, it } from 'vitest'
import {
  MAX_DESCRIPCION,
  SEPARADOR_CONSULTAS,
  armarConsulta,
  avisosDeDescripcion,
  componerDescripcion,
  largo,
} from './descripcionConsultas'

const dia = (d: number, m = 3) => new Date(2026, m - 1, d)

describe('armarConsulta', () => {
  it('fecha y origen, mensaje y datos extra, en ese orden', () => {
    const c = armarConsulta({
      fecha: dia(15),
      origenOriginal: 'ZonaProp',
      mensaje: 'Busco 2 ambientes',
      extras: [
        { encabezado: 'Dirección', valor: 'Calle Falsa 100' },
        { encabezado: 'Precio', valor: '85000' },
      ],
    })
    expect(c?.texto).toBe(
      'Consulta del 15/03/2026 · ZonaProp\nMensaje: Busco 2 ambientes\nDirección: Calle Falsa 100\nPrecio: 85000',
    )
    expect(c?.fecha).toEqual(dia(15))
  })

  it('sin fecha se omite la fecha; sin origen, solo la fecha', () => {
    expect(armarConsulta({ fecha: null, origenOriginal: 'Century 21', mensaje: 'Hola', extras: [] })?.texto).toBe(
      'Consulta · Century 21\nMensaje: Hola',
    )
    expect(armarConsulta({ fecha: dia(1), origenOriginal: null, mensaje: 'Hola', extras: [] })?.texto).toBe(
      'Consulta del 01/03/2026\nMensaje: Hola',
    )
  })

  it('si lo único que hay es el mensaje, va tal cual y sin rótulo', () => {
    expect(armarConsulta({ fecha: null, origenOriginal: null, mensaje: 'Busca 2 ambientes', extras: [] })?.texto).toBe(
      'Busca 2 ambientes',
    )
  })

  it('el mensaje se rotula si hay datos extra aunque no haya fecha ni origen', () => {
    const c = armarConsulta({
      fecha: null,
      origenOriginal: null,
      mensaje: 'Hola',
      extras: [{ encabezado: 'Barrio', valor: 'Centro' }],
    })
    expect(c?.texto).toBe('Mensaje: Hola\nBarrio: Centro')
  })

  it('sin nada que guardar es null', () => {
    expect(armarConsulta({ fecha: null, origenOriginal: null, mensaje: null, extras: [] })).toBeNull()
  })
})

describe('componerDescripcion', () => {
  const c = (texto: string, fecha: Date | null) => ({ texto, fecha })

  it('ordena por fecha ascendente y separa con ---', () => {
    const r = componerDescripcion([c('tercera', dia(20)), c('primera', dia(1)), c('segunda', dia(10))])
    expect(r.texto).toBe(['primera', 'segunda', 'tercera'].join(SEPARADOR_CONSULTAS))
    expect(r.texto).toBe('primera\n---\nsegunda\n---\ntercera')
    expect(r).toMatchObject({ omitidas: 0, recortada: false })
  })

  it('las que no tienen fecha van al final, en el orden del archivo', () => {
    const r = componerDescripcion([c('sin A', null), c('con fecha', dia(5)), c('sin B', null)])
    expect(r.texto).toBe('con fecha\n---\nsin A\n---\nsin B')
  })

  it('sin consultas no hay descripción', () => {
    expect(componerDescripcion([])).toEqual({ texto: null, omitidas: 0, recortada: false })
  })

  it('si no entran todas, descarta las más antiguas y deja las recientes completas', () => {
    const grande = (letra: string) => letra.repeat(900)
    const r = componerDescripcion([c(grande('a'), dia(1)), c(grande('b'), dia(2)), c(grande('c'), dia(3))])
    expect(r.omitidas).toBe(1)
    expect(r.recortada).toBe(false)
    expect(r.texto).toBe(`${grande('b')}\n---\n${grande('c')}`)
    expect(largo(r.texto ?? '')).toBeLessThanOrEqual(MAX_DESCRIPCION)
  })

  it('si ni la más reciente entra sola, la corta al final', () => {
    const r = componerDescripcion([c('vieja', dia(1)), c('x'.repeat(2500), dia(2))])
    expect(r.omitidas).toBe(1)
    expect(r.recortada).toBe(true)
    expect(largo(r.texto ?? '')).toBe(MAX_DESCRIPCION)
  })

  it('cuenta caracteres y no unidades de UTF-16', () => {
    const r = componerDescripcion([c('😀'.repeat(2001), null)])
    expect(Array.from(r.texto ?? '')).toHaveLength(MAX_DESCRIPCION)
    expect(r.recortada).toBe(true)
  })
})

describe('avisosDeDescripcion', () => {
  it('avisa lo que se dejó afuera y lo que se cortó', () => {
    expect(avisosDeDescripcion({ texto: 'x', omitidas: 0, recortada: false })).toEqual([])
    expect(avisosDeDescripcion({ texto: 'x', omitidas: 1, recortada: false })).toEqual([
      '1 consulta más antigua quedó afuera del detalle: no entraban en 2000 caracteres.',
    ])
    expect(avisosDeDescripcion({ texto: 'x', omitidas: 3, recortada: true })).toEqual([
      '3 consultas más antiguas quedaron afuera del detalle: no entraban en 2000 caracteres.',
      'La descripción es muy larga: se guardan los primeros 2000 caracteres.',
    ])
  })
})

describe('componerDescripcion: propiedad repetida', () => {
  const dia = (d: number) => new Date(2026, 3, d)
  const consulta = (base: string, propiedad: string[], d: number) => ({
    fecha: dia(d),
    texto: [base, ...propiedad].join('\n'),
    propiedad,
  })

  it('reemplaza las líneas idénticas a las de la consulta anterior', () => {
    const r = componerDescripcion([
      consulta('Consulta A', ['Dirección: Calle 1'], 1),
      consulta('Consulta B', ['Dirección: Calle 1'], 2),
    ])
    expect(r.texto).toBe('Consulta A\nDirección: Calle 1\n---\nConsulta B\nMisma propiedad que la consulta anterior')
  })

  it('si difieren en el orden o en el valor de una línea, va completo', () => {
    const r = componerDescripcion([
      consulta('A', ['x: 1', 'y: 2'], 1),
      consulta('B', ['y: 2', 'x: 1'], 2),
      consulta('C', ['y: 2', 'x: 9'], 3),
    ])
    expect(r.texto).not.toContain('Misma propiedad')
  })

  it('una consulta sin líneas de propiedad no lleva la referencia', () => {
    const r = componerDescripcion([
      { fecha: dia(1), texto: 'A', propiedad: [] },
      { fecha: dia(2), texto: 'B', propiedad: [] },
    ])
    expect(r.texto).toBe('A\n---\nB')
  })

  it('al descartar las más antiguas por el tope, la primera que queda lleva la propiedad completa', () => {
    const prop = ['Propiedad: ' + 'p'.repeat(400)]
    // Sin descartar: A (1900) + B y C compactadas. Con el tope no entran las tres.
    const r = componerDescripcion([
      consulta('a'.repeat(1500), prop, 1),
      consulta('b'.repeat(50), prop, 2),
      consulta('c'.repeat(600), prop, 3),
    ])
    expect(r.omitidas).toBe(1)
    // B pasó a ser la primera: lleva el bloque entero. C, en cambio, lo referencia.
    expect(r.texto).toBe(
      [`${'b'.repeat(50)}\n${prop[0]}`, `${'c'.repeat(600)}\nMisma propiedad que la consulta anterior`].join('\n---\n'),
    )
    expect(largo(r.texto ?? '')).toBeLessThanOrEqual(MAX_DESCRIPCION)
  })

  it('compactar libera lugar: entran consultas que sin compactar no entrarían', () => {
    const prop = ['Propiedad: ' + 'p'.repeat(800)]
    const r = componerDescripcion([
      consulta('A', prop, 1),
      consulta('B', prop, 2),
      consulta('C', prop, 3),
    ])
    // Completas serían ~2450 caracteres; compactadas, ~900.
    expect(r.omitidas).toBe(0)
    expect(largo(r.texto ?? '')).toBeLessThan(1000)
  })
})
