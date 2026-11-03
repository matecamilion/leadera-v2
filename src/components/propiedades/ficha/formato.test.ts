import { describe, expect, it } from 'vitest'
import { datosParaFicha, type OrigenFicha } from './datos'
import { ACENTO_RESPALDO, resolverAcento } from './diseno'
import {
  datosClave,
  enFilas,
  filasGaleria,
  partirDescripcion,
  precioFicha,
  repartirDatos,
  repartirFotos,
} from './formato'

const VACIA: OrigenFicha = {
  direccion: 'Calle 1',
  zona: null,
  tipo: 'CASA',
  precio: null,
  moneda: 'USD',
  ambientes: null,
  banos: null,
  cocheras: null,
  metros_cubiertos: null,
  metros_cuadrados: null,
  disposicion: null,
  expensas: null,
  descripcion: null,
  fotos_urls: [],
}

describe('datosClave', () => {
  it('una propiedad casi vacía no muestra ninguna celda', () => {
    expect(datosClave(datosParaFicha(VACIA, null))).toEqual([])
  })

  it('muestra solo lo que tiene valor, en orden, sin guiones', () => {
    const datos = datosClave(
      datosParaFicha({ ...VACIA, ambientes: 3, metros_cuadrados: 120, expensas: 85000 }, null),
    )
    expect(datos).toEqual([
      { etiqueta: 'Ambientes', valor: '3' },
      { etiqueta: 'Superficie total', valor: '120 m²' },
      { etiqueta: 'Expensas', valor: '$ 85.000 /mes' },
    ])
    expect(datos.some((d) => d.valor.includes('—'))).toBe(false)
  })

  it('un cero no informa y se omite', () => {
    expect(datosClave(datosParaFicha({ ...VACIA, cocheras: 0, banos: 0 }, null))).toEqual([])
  })

  it('no repite tipo ni zona', () => {
    const etiquetas = datosClave(datosParaFicha({ ...VACIA, zona: 'Centro', ambientes: 2 }, null)).map(
      (d) => d.etiqueta,
    )
    expect(etiquetas).not.toContain('Tipo')
    expect(etiquetas).not.toContain('Zona')
  })
})

describe('enFilas', () => {
  it('envuelve de a cuatro', () => {
    expect(enFilas([1, 2, 3, 4, 5, 6, 7], 4)).toEqual([[1, 2, 3, 4], [5, 6, 7]])
  })
})

describe('precioFicha', () => {
  it('sin precio devuelve null; sin moneda, solo la cifra', () => {
    expect(precioFicha(null, 'USD')).toBeNull()
    expect(precioFicha(0, 'USD')).toBeNull()
    expect(precioFicha(120000, 'USD')).toEqual({ moneda: 'USD', cifra: '120.000' })
    expect(precioFicha(120000, '  ')).toEqual({ moneda: '', cifra: '120.000' })
  })
})

describe('resolverAcento', () => {
  it('sin estilo guardado usa el verde de respaldo', () => {
    expect(resolverAcento(null)).toBe(ACENTO_RESPALDO)
    expect(resolverAcento('no es json')).toBe(ACENTO_RESPALDO)
  })
})

describe('repartirDatos: la fila de datos clave sin huérfanas', () => {
  const lista = (n: number) => Array.from({ length: n }, (_, i) => i)
  const anchos = (n: number) => repartirDatos(lista(n)).map((f) => f.length)

  it('sin datos no hay filas', () => expect(anchos(0)).toEqual([]))
  it('1 dato: una fila', () => expect(anchos(1)).toEqual([1]))
  it('3 datos: una fila', () => expect(anchos(3)).toEqual([3]))
  it('5 datos: todavía una fila', () => expect(anchos(5)).toEqual([5]))
  it('6 datos: 3 + 3', () => expect(anchos(6)).toEqual([3, 3]))
  it('7 datos: 4 + 3', () => expect(anchos(7)).toEqual([4, 3]))

  it('conserva el orden y no pierde ni repite datos', () => {
    expect(repartirDatos(lista(7)).flat()).toEqual(lista(7))
  })

  it('nunca deja una fila con un solo dato si hay más de uno', () => {
    for (let n = 2; n <= 7; n++) {
      for (const fila of repartirDatos(lista(n))) expect(fila.length).toBeGreaterThan(1)
    }
  })
})

describe('repartirFotos: portada, tira y galería', () => {
  const fotos = (n: number) => Array.from({ length: n }, (_, i) => `f${i + 1}`)
  const cuentas = (n: number) => {
    const r = repartirFotos(fotos(n))
    return [r.portada ? 1 : 0, r.tira.length, r.galeria.length]
  }

  it('0 fotos: nada', () => expect(cuentas(0)).toEqual([0, 0, 0]))
  it('1 foto: solo portada', () => expect(cuentas(1)).toEqual([1, 0, 0]))
  it('2 fotos: portada y tira de 1', () => expect(cuentas(2)).toEqual([1, 1, 0]))
  it('3 fotos: tira de 2', () => expect(cuentas(3)).toEqual([1, 2, 0]))
  it('4 fotos: tira de 3, sin galería', () => expect(cuentas(4)).toEqual([1, 3, 0]))
  it('7 fotos: tira de 3 y galería de 3', () => expect(cuentas(7)).toEqual([1, 3, 3]))
  it('12 fotos: tope de 9 (1 + 3 + 5)', () => expect(cuentas(12)).toEqual([1, 3, 5]))

  it('la tira toma las fotos 2 a 4 y la galería arranca en la 5', () => {
    const r = repartirFotos(fotos(12))
    expect(r.portada).toBe('f1')
    expect(r.tira).toEqual(['f2', 'f3', 'f4'])
    expect(r.galeria).toEqual(['f5', 'f6', 'f7', 'f8', 'f9'])
  })
})

describe('filasGaleria', () => {
  it('par: filas de dos', () => expect(filasGaleria([1, 2, 3, 4]).map((f) => f.length)).toEqual([2, 2]))
  it('impar: la última queda sola (se dibuja a ancho completo)', () => {
    expect(filasGaleria([1, 2, 3]).map((f) => f.length)).toEqual([2, 1])
    expect(filasGaleria([1]).map((f) => f.length)).toEqual([1])
  })
  it('sin fotos no hay filas', () => expect(filasGaleria([])).toEqual([]))
})

describe('partirDescripcion', () => {
  it('una descripción corta va entera con el título', () => {
    expect(partirDescripcion('  Breve descripción.  ')).toEqual({ inicio: 'Breve descripción.', resto: null })
  })

  it('una larga se parte en una oración y no pierde ni repite texto', () => {
    const texto = 'Luminoso departamento al frente, con balcón corrido y vista abierta. '.repeat(40)
    const { inicio, resto } = partirDescripcion(texto)
    expect(inicio.endsWith('.')).toBe(true)
    expect(inicio.length).toBeGreaterThanOrEqual(140)
    expect(inicio.length).toBeLessThanOrEqual(320)
    expect(`${inicio} ${resto}`).toBe(texto.trim())
  })

  it('sin puntos a tiempo corta en un espacio, nunca en medio de una palabra', () => {
    const texto = 'palabra '.repeat(200)
    const { inicio, resto } = partirDescripcion(texto)
    expect(inicio.endsWith('palabra')).toBe(true)
    expect(`${inicio} ${resto}`).toBe(texto.trim())
  })

  it('una palabra interminable no rompe la función', () => {
    const { inicio, resto } = partirDescripcion('x'.repeat(1000))
    expect(inicio.length + (resto?.length ?? 0)).toBe(1000)
  })
})
