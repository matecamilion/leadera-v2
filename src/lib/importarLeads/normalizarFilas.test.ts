import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FilaCruda } from './leerArchivo'
import type { MapeoColumnas } from './mapeoColumnas'
import {
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
    // 13 dígitos, pero el área no puede empezar con 9.
    ['9 223 555-010', '5499223555010', true],
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
  it('arma todos los campos (sin columna de origen no se manda origen)', () => {
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
      origen: null,
      fechaIngreso: new Date(2026, 2, 5),
      primerContacto: null,
      ultimoContacto: null,
      // Con fecha, el detalle lleva la línea de la consulta y rotula el mensaje.
      descripcion: 'Consulta del 05/03/2026\nMensaje: Busca 2 ambientes',
      consulta: {
        fecha: new Date(2026, 2, 5),
        texto: 'Consulta del 05/03/2026\nMensaje: Busca 2 ambientes',
        propiedad: [],
      },
      avisosDescripcion: [],
      errores: [],
      avisos: [],
    })
  })

  it('conserva el número de fila original de cada una', () => {
    const r = normalizarFilas([cruda(['Ana'], 5), cruda(['Luis'], 9)], { nombre: 0 })
    expect(r.map((f) => f.fila)).toEqual([5, 9])
  })
})

describe('fecha de ingreso futura', () => {
  const AVISO = 'La fecha de ingreso es futura: se usa la de hoy.'

  // Hora fija para que "hoy", "ayer" y "en 2 días" no dependan de cuándo corre el test.
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 5, 15, 12, 0))
  })
  afterEach(() => vi.useRealTimers())

  /** dd/mm/aaaa de hoy + `dias`. */
  const enDias = (dias: number) => {
    const d = new Date(2026, 5, 15 + dias)
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
  }
  const fechaDe = (texto: string) => unaFila(['Ana', null, null, null, null, texto, null])

  it('ayer y hoy se respetan, sin aviso', () => {
    for (const dias of [-1, 0]) {
      const f = fechaDe(enDias(dias))
      expect(f.fechaIngreso).toEqual(new Date(2026, 5, 15 + dias))
      expect(f.avisos).not.toContain(AVISO)
    }
  })

  it('mañana a la medianoche todavía entra (dentro del margen de un día)', () => {
    expect(fechaDe(enDias(1)).fechaIngreso).toEqual(new Date(2026, 5, 16))
  })

  it('dentro de 2 días es futura: queda null con aviso', () => {
    const f = fechaDe(enDias(2))
    expect(f.fechaIngreso).toBeNull()
    expect(f.avisos).toContain(AVISO)
    expect(f.errores).toEqual([])
  })

  it('dentro de un año también', () => {
    const f = fechaDe('15/06/2027')
    expect(f.fechaIngreso).toBeNull()
    expect(f.avisos).toContain(AVISO)
  })

  it('con hora: pasado el margen de 24 h es futura, antes no', () => {
    // Ahora es 15/06 12:00: el margen llega hasta el 16/06 12:00.
    expect(fechaDe('16/06/2026 11:59').fechaIngreso).not.toBeNull()
    expect(fechaDe('16/06/2026 12:01').fechaIngreso).toBeNull()
  })

  it('una fecha ilegible sigue dando su aviso de siempre, no el de futura', () => {
    const f = fechaDe('mañana')
    expect(f.avisos.some((a) => a.includes('No entendimos la fecha'))).toBe(true)
    expect(f.avisos).not.toContain(AVISO)
  })
})

describe('largos máximos', () => {
  const con = (campo: 'nombre' | 'apellido' | 'telefono' | 'email' | 'descripcion', valor: string) => {
    const base: (string | null)[] = ['Ana', null, null, null, null, null, null]
    const posicion = { nombre: 0, apellido: 1, telefono: 2, email: 3, descripcion: 6 }[campo]
    base[posicion] = valor
    return unaFila(base)
  }

  describe('descripción (se recorta)', () => {
    it('de 2000 caracteres se deja tal cual', () => {
      const f = con('descripcion', 'd'.repeat(2000))
      expect(f.descripcion).toHaveLength(2000)
      expect(f.avisos.some((a) => a.includes('muy larga'))).toBe(false)
      expect(f.errores).toEqual([])
    })

    it('de 2001 se recorta a 2000 y avisa', () => {
      const f = con('descripcion', 'd'.repeat(2001))
      expect(f.descripcion).toHaveLength(2000)
      expect(f.avisos).toContain('La descripción es muy larga: se guardan los primeros 2000 caracteres.')
      expect(f.errores).toEqual([])
    })

    it('se recorta por caracteres, no por unidades UTF-16 (un emoji cuenta 1)', () => {
      const f = con('descripcion', '😀'.repeat(2001))
      expect(Array.from(f.descripcion ?? '')).toHaveLength(2000)
    })

    it('el recorte no deja espacios al final', () => {
      const f = con('descripcion', 'a'.repeat(1999) + ' ' + 'b'.repeat(10))
      expect(f.descripcion).toBe('a'.repeat(1999))
    })
  })

  describe('nombre (error si se pasa)', () => {
    it('de 100 caracteres entra', () => {
      const f = con('nombre', 'N'.repeat(100))
      expect(f.nombre).toHaveLength(100)
      expect(f.errores).toEqual([])
    })

    it('de 101 es error bloqueante y no se recorta', () => {
      const f = con('nombre', 'N'.repeat(101))
      expect(f.nombre).toHaveLength(101)
      expect(f.errores).toEqual(['El nombre supera los 100 caracteres.'])
    })
  })

  describe('apellido', () => {
    it('de 100 entra y de 101 es error', () => {
      expect(con('apellido', 'A'.repeat(100)).errores).toEqual([])

      const f = con('apellido', 'A'.repeat(101))
      expect(f.apellido).toHaveLength(101)
      expect(f.errores).toEqual(['El apellido supera los 100 caracteres.'])
    })

    it('el apellido que sale de partir un nombre completo también cuenta', () => {
      const f = unaFila(['Ana ' + 'P'.repeat(101)], { nombreCompleto: 0 })
      expect(f.errores).toEqual(['El apellido supera los 100 caracteres.'])
    })
  })

  describe('teléfono', () => {
    it('de 50 caracteres entra y de 51 es error', () => {
      const de = (n: number) => '2235550101' + ' '.repeat(n - 11) + '1'
      expect(de(50)).toHaveLength(50)
      expect(con('telefono', de(50)).errores).toEqual([])

      const f = con('telefono', de(51))
      expect(f.telefono).toHaveLength(51)
      expect(f.errores).toEqual(['El teléfono supera los 50 caracteres.'])
    })
  })

  describe('email', () => {
    // Un email válido de exactamente `n` caracteres: local + "@ejemplo.com" (12).
    const emailDe = (n: number) => 'a'.repeat(n - 12) + '@ejemplo.com'

    it('de 254 caracteres entra', () => {
      const f = con('email', emailDe(254))
      expect(f.email).toHaveLength(254)
      expect(f.errores).toEqual([])
    })

    it('de 255 es error bloqueante y no se recorta', () => {
      const f = con('email', emailDe(255))
      expect(f.email).toHaveLength(255)
      expect(f.errores).toEqual(['El email supera los 254 caracteres.'])
    })

    it('un email largo pero inválido sigue siendo solo un aviso', () => {
      const f = con('email', 'a'.repeat(300))
      expect(f.email).toBeNull()
      expect(f.errores).toEqual([])
    })
  })

  it('varios problemas a la vez dan un mensaje por campo', () => {
    const f = unaFila(['N'.repeat(101), 'A'.repeat(101), '2235550101', 'a@b.co', null, null, null])
    expect(f.errores).toEqual([
      'El nombre supera los 100 caracteres.',
      'El apellido supera los 100 caracteres.',
    ])
  })
})
