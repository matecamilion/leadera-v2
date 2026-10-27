import { describe, expect, it } from 'vitest'
import type { FilaCruda } from './leerArchivo'
import type { MapeoColumnas } from './mapeoColumnas'
import {
  ORIGEN_IMPORTACION,
  normalizarFilas,
  parsearEstado,
  parsearFecha,
  partirNombreCompleto,
} from './normalizarFilas'

/** Una fila cuyas celdas son los valores dados, por orden de columna. */
function cruda(valores: (string | null)[], numero = 2): FilaCruda {
  return { numeroFilaOriginal: numero, celdas: Object.fromEntries(valores.map((v, i) => [i, v])) }
}

const MAPEO: MapeoColumnas = {
  nombre: 0,
  apellido: 1,
  telefono: 2,
  email: 3,
  estado: 4,
  fechaIngreso: 5,
  descripcion: 6,
}

function unaFila(valores: (string | null)[], mapeo: MapeoColumnas = MAPEO) {
  return normalizarFilas([cruda(valores)], mapeo)[0]
}

describe('teléfono (números inventados)', () => {
  // Salidas verificadas contra `normalizarTelefonoAR` en el Paso 0.
  const casos: [string, string, boolean][] = [
    ['223 555-0101', '5492235550101', false],
    ['2235550102', '5492235550102', false],
    ['+54 9 223 555-0103', '5492235550103', false],
    ['114 555-0105', '5491145550105', false],
    ['0223 15 555-0106', '5492235550106', false],
    ['9 11 5550-0104', '5491155500104', false],
    // Dudosos: la normalización no llega a 13 dígitos con forma de celular AR.
    ['223 555-012', '549223555012', true],
    ['13105550107', '54913105550107', true],
    ['+1 310 555 0108', '54913105550108', true],
  ]

  it.each(casos)('%s -> %s (dudoso: %s)', (entrada, norm, dudoso) => {
    const f = unaFila(['Ana', null, entrada, null, null, null, null])
    expect(f.telefono).toBe(entrada)
    expect(f.telefonoNorm).toBe(norm)
    expect(f.telefonoDudoso).toBe(dudoso)
    expect(f.avisos.some((a) => a.includes('no parece un celular'))).toBe(dudoso)
  })

  it('un teléfono confiable no deja aviso', () => {
    const f = unaFila(['Ana', null, '223 555-0101', null, null, null, null])
    expect(f.avisos).toEqual([])
  })

  it('sin teléfono: null y no es dudoso', () => {
    const f = unaFila(['Ana', null, null, 'ana@ejemplo.com', null, null, null])
    expect(f.telefono).toBeNull()
    expect(f.telefonoNorm).toBeNull()
    expect(f.telefonoDudoso).toBe(false)
  })

  it('texto sin dígitos se ignora con aviso', () => {
    const f = unaFila(['Ana', null, 'no tiene', null, null, null, null])
    expect(f.telefono).toBeNull()
    expect(f.avisos).toContain('El teléfono no tiene números: se ignora.')
  })
})

describe('nombre', () => {
  const completo: MapeoColumnas = { nombreCompleto: 0 }
  const nombreDe = (texto: string) => {
    const f = unaFila([texto], completo)
    return [f.nombre, f.apellido]
  }

  it('una palabra: solo nombre', () => {
    expect(nombreDe('Ana')).toEqual(['Ana', null])
  })

  it('dos palabras', () => {
    expect(nombreDe('Ana Gómez')).toEqual(['Ana', 'Gómez'])
  })

  it('cuatro palabras: la primera es el nombre, el resto el apellido', () => {
    expect(nombreDe('María del Carmen Pérez')).toEqual(['María', 'del Carmen Pérez'])
  })

  it('colapsa espacios repetidos', () => {
    expect(partirNombreCompleto('  Ana   Gómez ')).toEqual({ nombre: 'Ana', apellido: 'Gómez' })
  })

  it('columnas nombre y apellido separadas', () => {
    const f = unaFila(['Ana', 'Gómez'], { nombre: 0, apellido: 1 })
    expect([f.nombre, f.apellido]).toEqual(['Ana', 'Gómez'])
  })

  it('si hay nombre suelto, no se parte el nombre completo', () => {
    const f = unaFila(['Ana', 'Ana Gómez'], { nombre: 0, nombreCompleto: 1 })
    expect([f.nombre, f.apellido]).toEqual(['Ana', null])
  })

  it('si el nombre suelto está vacío, se usa el completo', () => {
    const f = unaFila([null, 'Ana Gómez'], { nombre: 0, nombreCompleto: 1 })
    expect([f.nombre, f.apellido]).toEqual(['Ana', 'Gómez'])
  })

  it('sin nombre es un error bloqueante', () => {
    const f = unaFila([null, null, '2235550101'])
    expect(f.errores).toEqual(['Falta el nombre.'])
  })

  it('sin columna de nombre mapeada, la fila falla', () => {
    const f = unaFila(['x'], { telefono: 0 })
    expect(f.errores).toEqual(['Falta el nombre.'])
  })
})

describe('email', () => {
  const emailDe = (valor: string | null) => unaFila(['Ana', null, null, valor, null, null, null])

  it('vacío: null y sin aviso por el email', () => {
    expect(emailDe(null).email).toBeNull()
    expect(emailDe(null).avisos.some((a) => a.includes('formato'))).toBe(false)
  })

  it('mayúsculas y espacios se normalizan', () => {
    expect(emailDe('  Ana.Gomez@Ejemplo.COM ').email).toBe('ana.gomez@ejemplo.com')
  })

  it('inválido: null con aviso y la fila sigue válida', () => {
    const f = emailDe('ana@')
    expect(f.email).toBeNull()
    expect(f.errores).toEqual([])
    expect(f.avisos).toContain('El email no tiene un formato válido: se ignora.')
  })

  it('nunca devuelve string vacío', () => {
    for (const v of [null, '', '   ', 'x', 'a b@c.com']) {
      expect(emailDe(v).email === '').toBe(false)
    }
  })

  it('saca el prefijo mailto:', () => {
    expect(emailDe('mailto:Ana@Ejemplo.com').email).toBe('ana@ejemplo.com')
  })
})

describe('sin forma de detectar duplicados', () => {
  const AVISO = 'Sin teléfono ni email válidos: no hay forma de detectar duplicados.'

  it('sin teléfono ni email: válida, con aviso', () => {
    const f = unaFila(['Ana', null, null, null, null, null, null])
    expect(f.errores).toEqual([])
    expect(f.avisos).toContain(AVISO)
  })

  it('con email válido no avisa', () => {
    expect(unaFila(['Ana', null, null, 'a@b.co', null, null, null]).avisos).not.toContain(AVISO)
  })

  it('con solo un teléfono dudoso y sin email, avisa', () => {
    expect(unaFila(['Ana', null, '+1 310 555 0108', null, null, null, null]).avisos).toContain(AVISO)
  })
})

describe('estado', () => {
  it.each([
    ['caliente', 'CALIENTE'],
    ['CALIENTE', 'CALIENTE'],
    ['Tibio', 'TIBIO'],
    ['frío', 'FRIO'],
    ['Frio', 'FRIO'],
    ['FRÍO', 'FRIO'],
    ['ganado', 'GANADO'],
    ['Inactivo', 'INACTIVO'],
    [' tibio ', 'TIBIO'],
  ])('%s -> %s', (texto, esperado) => {
    expect(parsearEstado(texto)).toBe(esperado)
  })

  it('lo que no se reconoce es null con aviso', () => {
    expect(parsearEstado('medio medio')).toBeNull()
    expect(parsearEstado(null)).toBeNull()

    const f = unaFila(['Ana', null, null, null, 'quizás', null, null])
    expect(f.estado).toBeNull()
    expect(f.avisos.some((a) => a.includes('quizás'))).toBe(true)
  })
})

describe('fechaIngreso', () => {
  it('dd/mm/aaaa', () => {
    expect(parsearFecha('05/03/2026')).toEqual(new Date(2026, 2, 5))
    expect(parsearFecha('5/3/2026')).toEqual(new Date(2026, 2, 5))
  })

  it('dd/mm/aaaa con hora', () => {
    expect(parsearFecha('05/03/2026 14:30')).toEqual(new Date(2026, 2, 5, 14, 30))
    expect(parsearFecha('05/03/2026 14:30:15')).toEqual(new Date(2026, 2, 5, 14, 30, 15))
  })

  it('número serial de Excel, como número o como texto', () => {
    // 46086 = 05/03/2026; .5 = mediodía.
    expect(parsearFecha(46086)).toEqual(new Date(2026, 2, 5))
    expect(parsearFecha('46086.5')).toEqual(new Date(2026, 2, 5, 12, 0))
  })

  it('un Date se respeta', () => {
    const fecha = new Date(2026, 2, 5, 9, 0)
    expect(parsearFecha(fecha)).toBe(fecha)
  })

  it('aaaa-mm-dd', () => {
    expect(parsearFecha('2026-03-05')).toEqual(new Date(2026, 2, 5))
  })

  it('lo que no se entiende, o no existe, es null', () => {
    expect(parsearFecha('ayer')).toBeNull()
    expect(parsearFecha('31/02/2026')).toBeNull()
    expect(parsearFecha('05/13/2026')).toBeNull()
    expect(parsearFecha('05/03/2026 25:00')).toBeNull()
    expect(parsearFecha('3')).toBeNull()
    expect(parsearFecha(null)).toBeNull()
    expect(parsearFecha(new Date('x'))).toBeNull()
  })

  it('en la fila: una fecha ilegible deja aviso y null', () => {
    const f = unaFila(['Ana', null, null, null, null, 'mañana', null])
    expect(f.fechaIngreso).toBeNull()
    expect(f.avisos.some((a) => a.includes('mañana'))).toBe(true)
  })
})

describe('fila completa', () => {
  it('arma todos los campos y fija el origen', () => {
    const f = unaFila([
      'Ana',
      'Gómez',
      '223 555-0101',
      'ANA@Ejemplo.com',
      'Tibio',
      '05/03/2026',
      '  Busca 2 ambientes ',
    ])
    expect(f).toEqual({
      fila: 2,
      nombre: 'Ana',
      apellido: 'Gómez',
      telefono: '223 555-0101',
      telefonoNorm: '5492235550101',
      telefonoDudoso: false,
      email: 'ana@ejemplo.com',
      estado: 'TIBIO',
      origen: ORIGEN_IMPORTACION,
      fechaIngreso: new Date(2026, 2, 5),
      descripcion: 'Busca 2 ambientes',
      errores: [],
      avisos: [],
    })
  })

  it('conserva el número de fila original de cada una', () => {
    const r = normalizarFilas([cruda(['Ana'], 5), cruda(['Luis'], 9)], { nombre: 0 })
    expect(r.map((f) => f.fila)).toEqual([5, 9])
  })
})
