/**
 * El caso de una exportación de un CRM inmobiliario: la misma persona consulta
 * varias propiedades, hay emails en la columna Nombre y datos de la propiedad en
 * columnas sueltas. Todo inventado: nombres, teléfonos, emails y propiedades.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resumirResultado } from '../../components/leads/importar/resumenResultado'
import { prepararRevision } from '../../components/leads/importar/revisar'

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('../supabase', () => ({ supabase: { functions: { invoke } } }))

import { marcarDuplicadosEnArchivo } from './duplicadosEnArchivo'
import type { ArchivoLeido, FilaCruda } from './leerArchivo'
import { sugerirMapeo } from './mapeoColumnas'
import { normalizarFilas } from './normalizarFilas'

const ENCABEZADOS = [
  'Nombre',
  'Teléfono',
  'Email',
  'Estado',
  'Fecha de creación',
  'Mensaje',
  'Origen',
  'Asesor',
  'ID propiedad',
  'Propiedad',
  'Dirección',
  'Barrio / zona',
  'Tipo de propiedad',
  'Operación',
  'Moneda',
  'Precio',
  'Respondido el',
  'Tiempo de respuesta',
  'Cliente vinculado',
  'UTM fuente',
  'UTM medio',
  'UTM campaña',
  'URL de origen',
  'ID lead',
]

function cruda(numero: number, valores: Record<string, string | null>): FilaCruda {
  const celdas: Record<number, string | null> = {}
  ENCABEZADOS.forEach((encabezado, i) => {
    celdas[i] = valores[encabezado] ?? null
  })
  return { numeroFilaOriginal: numero, celdas }
}

const { mapeo: MAPEO } = sugerirMapeo(ENCABEZADOS)

function procesar(filas: FilaCruda[]) {
  return marcarDuplicadosEnArchivo(normalizarFilas(filas, MAPEO, ENCABEZADOS))
}

// Una persona que consultó cuatro veces: con teléfono en tres filas y con el
// mismo email en dos. Las filas no vienen en orden de fecha.
const CAMILA = [
  cruda(2, {
    Nombre: 'Camila Rey',
    Teléfono: '02234246323',
    Email: 'camila.rey@ejemplo.com',
    Estado: 'inactivo',
    'Fecha de creación': '15/03/2026 10:30',
    Mensaje: 'Quiero más info',
    Origen: 'ZonaProp',
    Asesor: 'Asesor Uno',
    'ID propiedad': 'P-100',
    Propiedad: 'Depto 2 amb',
    Dirección: 'Calle Falsa 100',
    'Barrio / zona': 'Centro',
    'Tipo de propiedad': 'Departamento',
    Moneda: 'USD',
    Precio: '85000',
    'UTM fuente': 'zp',
    'ID lead': 'L-2',
  }),
  cruda(3, {
    Nombre: 'Camila Rey',
    Teléfono: '+54 223 424-6323',
    Estado: 'tibio',
    'Fecha de creación': '10/03/2026 09:00',
    Mensaje: 'Y por esta otra?',
    Origen: 'Argenprop',
    'ID propiedad': 'P-200',
    Dirección: 'Av. Siempreviva 200',
    Moneda: 'USD',
    Precio: '120000',
    'ID lead': 'L-3',
  }),
  cruda(4, {
    Nombre: 'camila rey',
    Email: 'CAMILA.REY@ejemplo.com',
    'Fecha de creación': '20/03/2026 18:00',
    Origen: 'WhatsApp (C21)',
    Propiedad: 'Casa 3 amb',
    'ID lead': 'L-4',
  }),
  cruda(5, {
    Nombre: 'Camila Rey',
    Teléfono: '2234246323',
    'Fecha de creación': '01/03/2026',
    Mensaje: 'Primera consulta',
    Origen: 'Century 21',
    'ID propiedad': 'P-050',
    'ID lead': 'L-5',
  }),
]

describe('mapeo de las columnas del archivo', () => {
  it('detecta los campos, incluidas "Fecha de creación" y "Origen"', () => {
    expect(MAPEO).toMatchObject({
      nombre: 0,
      telefono: 1,
      email: 2,
      estado: 3,
      fechaIngreso: 4,
      descripcion: 5,
      origen: 6,
    })
  })

  it('preselecciona para el detalle las columnas de la propiedad, "Barrio / zona" incluida', () => {
    // ID propiedad, Propiedad, Dirección, Barrio / zona, Tipo de propiedad, Moneda, Precio.
    expect(MAPEO.detalle).toEqual([8, 9, 10, 11, 12, 14, 15])
  })

  it('nunca preselecciona UTM, "Cliente vinculado", "Tiempo de respuesta", "ID lead" ni "URL de origen"', () => {
    const detalle = MAPEO.detalle ?? []
    for (const encabezado of [
      'Asesor',
      'Operación',
      'Respondido el',
      'Tiempo de respuesta',
      'Cliente vinculado',
      'UTM fuente',
      'UTM medio',
      'UTM campaña',
      'URL de origen',
      'ID lead',
    ]) {
      expect(detalle).not.toContain(ENCABEZADOS.indexOf(encabezado))
    }
  })

  it('"Fecha de creación" y "Fecha de alta" son la fecha de ingreso', () => {
    expect(sugerirMapeo(['Nombre', 'Fecha de creación']).mapeo.fechaIngreso).toBe(1)
    expect(sugerirMapeo(['Nombre', 'Fecha de alta']).mapeo.fechaIngreso).toBe(1)
  })
})

describe('una persona con cuatro consultas', () => {
  const filas = procesar(CAMILA)
  const [camila, ...repetidas] = filas

  it('queda un solo lead, con las otras filas marcadas como fusionadas en la primera', () => {
    expect(camila.duplicadoEnArchivo).toBeNull()
    expect(camila.consultasFusionadas).toBe(3)
    expect(repetidas.map((f) => f.duplicadoEnArchivo)).toEqual([
      { duplicaA: 2, por: 'TELEFONO' },
      { duplicaA: 2, por: 'EMAIL' },
      { duplicaA: 2, por: 'TELEFONO' },
    ])
    expect(repetidas.every((f) => f.consultasFusionadas === 0)).toBe(true)
  })

  it('los datos personales son los de la primera fila', () => {
    expect(camila).toMatchObject({
      nombre: 'Camila Rey',
      telefono: '02234246323',
      email: 'camila.rey@ejemplo.com',
    })
  })

  it('el origen es el de la consulta más antigua (01/03, "Century 21") y no el de la primera fila (ZonaProp)', () => {
    expect(camila.origen).toBe('OTRO')
  })

  it('el estado es el de la consulta más reciente que tiene estado (15/03, "inactivo")', () => {
    // La del 20/03 no trae estado; la del 10/03 es "tibio" y es más vieja.
    expect(camila.estado).toBe('INACTIVO')
  })

  it('el detalle junta las cuatro consultas por fecha ascendente, separadas por ---', () => {
    expect(camila.descripcion).toBe(
      [
        'Consulta del 01/03/2026 · Century 21\nMensaje: Primera consulta\nID propiedad: P-050',
        'Consulta del 10/03/2026 · Argenprop\nMensaje: Y por esta otra?\nID propiedad: P-200\nDirección: Av. Siempreviva 200\nMoneda: USD\nPrecio: 120000',
        'Consulta del 15/03/2026 · ZonaProp\nMensaje: Quiero más info\nID propiedad: P-100\nPropiedad: Depto 2 amb\nDirección: Calle Falsa 100\nBarrio / zona: Centro\nTipo de propiedad: Departamento\nMoneda: USD\nPrecio: 85000',
        'Consulta del 20/03/2026 · WhatsApp (C21)\nPropiedad: Casa 3 amb',
      ].join('\n---\n'),
    )
  })

  it('no se cuelan las columnas que no son del detalle', () => {
    expect(camila.descripcion).not.toMatch(/Asesor|UTM|L-2|zp/)
  })

  it('la fecha de ingreso es la más antigua', () => {
    expect(camila.fechaIngreso).toEqual(new Date(2026, 2, 1))
  })

  it('avisa la fusión, con las filas que se juntaron', () => {
    expect(camila.avisos).toContain('Se fusionaron 3 consultas repetidas de la misma persona (filas 3, 4, 5).')
  })

  it('una sola repetida se avisa en singular', () => {
    const [primera] = procesar(CAMILA.slice(0, 2))
    expect(primera.avisos).toContain('Se fusionaron 1 consulta repetida de la misma persona (filas 3).')
  })
})

describe('fusión con y sin teléfono', () => {
  const ana = (numero: number, valores: Record<string, string | null>) =>
    cruda(numero, { Nombre: 'Ana Gil', 'Fecha de creación': `0${numero}/04/2026`, ...valores })

  it('si la primera no tiene teléfono lo toma de otra fila de la misma persona', () => {
    const [primera, segunda, tercera] = procesar([
      ana(2, { Email: 'ana.gil@ejemplo.com' }),
      ana(3, { Email: 'ANA.GIL@ejemplo.com' }),
      ana(4, { Email: 'ana.gil@ejemplo.com', Teléfono: '011 5555-0123' }),
    ])
    expect(primera).toMatchObject({
      telefono: '011 5555-0123',
      telefonoNorm: '5491155550123',
      telefonoDudoso: false,
      email: 'ana.gil@ejemplo.com',
      consultasFusionadas: 2,
    })
    expect(segunda.duplicadoEnArchivo).toEqual({ duplicaA: 2, por: 'EMAIL' })
    expect(tercera.duplicadoEnArchivo).toEqual({ duplicaA: 2, por: 'EMAIL' })
  })

  it('si la primera no tiene email lo completa con el de otra', () => {
    const [primera] = procesar([
      ana(2, { Teléfono: '011 5555-0123' }),
      ana(3, { Teléfono: '+54 9 11 5555-0123', Email: 'ana.gil@ejemplo.com' }),
    ])
    expect(primera.email).toBe('ana.gil@ejemplo.com')
    expect(primera.telefono).toBe('011 5555-0123')
  })

  it('si ninguna fila tiene teléfono, el lead queda sin teléfono', () => {
    const [primera, ...otras] = procesar([
      ana(2, { Email: 'ana.gil@ejemplo.com' }),
      ana(3, { Email: 'ana.gil@ejemplo.com' }),
    ])
    expect(primera).toMatchObject({ telefono: null, telefonoNorm: null, consultasFusionadas: 1 })
    expect(otras[0].duplicadoEnArchivo).toEqual({ duplicaA: 2, por: 'EMAIL' })
  })

  it('una tercera fila que solo comparte el email que la primera ganó también se fusiona', () => {
    const filas = procesar([
      ana(2, { Teléfono: '011 5555-0123' }),
      ana(3, { Teléfono: '011 5555-0123', Email: 'ana.gil@ejemplo.com' }),
      ana(4, { Email: 'ana.gil@ejemplo.com' }),
    ])
    expect(filas[2].duplicadoEnArchivo).toEqual({ duplicaA: 2, por: 'EMAIL' })
    expect(filas[0].consultasFusionadas).toBe(2)
  })

  it('personas distintas no se mezclan', () => {
    const filas = procesar([
      ana(2, { Teléfono: '011 5555-0123' }),
      cruda(3, { Nombre: 'Otro', Teléfono: '011 5555-0199', 'Fecha de creación': '03/04/2026' }),
    ])
    expect(filas.map((f) => f.duplicadoEnArchivo)).toEqual([null, null])
    expect(filas[0].descripcion).not.toContain('---')
  })

  it('las filas con error no se fusionan con nadie', () => {
    const filas = procesar([
      cruda(2, { Nombre: null, Teléfono: '011 5555-0123' }),
      ana(3, { Teléfono: '011 5555-0123' }),
    ])
    expect(filas[0].errores).toHaveLength(1)
    expect(filas.map((f) => f.duplicadoEnArchivo)).toEqual([null, null])
  })
})

describe('el origen del archivo', () => {
  const origenDe = (valor: string | null) =>
    procesar([cruda(2, { Nombre: 'Ana Gil', 'Fecha de creación': '05/04/2026', Origen: valor })])[0]

  it('se traduce al enum y el nombre original queda en el detalle', () => {
    const f = origenDe('Mercado Libre')
    expect(f.origen).toBe('MERCADO_LIBRE')
    expect(f.descripcion).toBe('Consulta del 05/04/2026 · Mercado Libre')
  })

  it('"Century 21" es OTRO y conserva su nombre', () => {
    const f = origenDe('Century 21')
    expect(f.origen).toBe('OTRO')
    expect(f.descripcion).toContain('Century 21')
  })

  it('un valor desconocido o vedado es OTRO', () => {
    expect(origenDe('Cartel').origen).toBe('OTRO')
    expect(origenDe('MANUAL').origen).toBe('OTRO')
    expect(origenDe('REFERIDO').origen).toBe('OTRO')
  })

  it('una celda de origen vacía no manda origen', () => {
    const f = origenDe(null)
    expect(f.origen).toBeNull()
    expect(f.descripcion).toBe('Consulta del 05/04/2026')
  })

  it('sin columna de origen mapeada no se manda origen', () => {
    const sinOrigen = { ...MAPEO }
    delete sinOrigen.origen
    const [f] = normalizarFilas(
      [cruda(2, { Nombre: 'Ana Gil', Origen: 'ZonaProp', Mensaje: 'Hola' })],
      sinOrigen,
      ENCABEZADOS,
    )
    expect(f.origen).toBeNull()
    // Sin fecha, origen ni datos extra, el mensaje va tal cual.
    expect(f.descripcion).toBe('Hola')
  })
})

describe('un email en la columna Nombre', () => {
  const nombreDe = (nombre: string, email: string | null = null) =>
    normalizarFilas([cruda(2, { Nombre: nombre, Email: email })], MAPEO, ENCABEZADOS)[0]

  it('sin columna de email: nombre desde antes de la @ y el email pasa a su campo', () => {
    const f = nombreDe('sofia_ramos-diaz@Ejemplo.com')
    expect(f.nombre).toBe('Sofia Ramos Diaz')
    expect(f.email).toBe('sofia_ramos-diaz@ejemplo.com')
    expect(f.errores).toEqual([])
    expect(f.avisos).toContain(
      'El nombre era un email: se usó "Sofia Ramos Diaz" como nombre y el email se guardó en su campo.',
    )
  })

  it('con otro email en su columna, ese manda y el del nombre solo da el nombre', () => {
    const f = nombreDe('tomas.gil@ejemplo.com', 'otro@ejemplo.com')
    expect(f.nombre).toBe('Tomas Gil')
    expect(f.email).toBe('otro@ejemplo.com')
    expect(f.avisos).toContain('El nombre era un email: se usó "Tomas Gil" como nombre.')
  })

  it('con el mismo email en su columna queda uno solo', () => {
    const f = nombreDe('ana.diaz@ejemplo.com', 'ana.diaz@ejemplo.com')
    expect(f.nombre).toBe('Ana Diaz')
    expect(f.email).toBe('ana.diaz@ejemplo.com')
  })

  it('el email que vino en el nombre sirve para detectar repetidas', () => {
    const filas = procesar([
      cruda(2, { Nombre: 'sofia.ramos@ejemplo.com' }),
      cruda(3, { Nombre: 'Sofía Ramos', Email: 'sofia.ramos@ejemplo.com' }),
    ])
    expect(filas[1].duplicadoEnArchivo).toEqual({ duplicaA: 2, por: 'EMAIL' })
  })

  it('un nombre normal no cambia ni avisa', () => {
    const f = nombreDe('Ana Gil')
    expect(f.nombre).toBe('Ana Gil')
    expect(f.avisos.some((a) => a.includes('era un email'))).toBe(false)
  })
})

describe('el tope de 2000 caracteres', () => {
  const larga = (numero: number, dia: string, letra: string) =>
    cruda(numero, {
      Nombre: 'Ana Gil',
      Teléfono: '011 5555-0123',
      'Fecha de creación': `${dia}/04/2026`,
      Mensaje: letra.repeat(900),
    })

  it('si las consultas no entran, quedan las más recientes completas y se avisa', () => {
    const [f] = procesar([larga(2, '01', 'a'), larga(3, '02', 'b'), larga(4, '03', 'c')])
    expect(Array.from(f.descripcion ?? '').length).toBeLessThanOrEqual(2000)
    expect(f.descripcion).not.toContain('a'.repeat(10))
    expect(f.descripcion).toContain('b'.repeat(900))
    expect(f.descripcion).toContain('c'.repeat(900))
    expect(f.avisos).toContain('1 consulta más antigua quedó afuera del detalle: no entraban en 2000 caracteres.')
  })

  it('una consulta sola que no entra se corta al final y se avisa', () => {
    const [f] = normalizarFilas(
      [cruda(2, { Nombre: 'Ana Gil', Mensaje: 'z'.repeat(2500), 'Fecha de creación': '01/04/2026' })],
      MAPEO,
      ENCABEZADOS,
    )
    expect(Array.from(f.descripcion ?? '')).toHaveLength(2000)
    expect(f.avisos).toContain('La descripción es muy larga: se guardan los primeros 2000 caracteres.')
  })

  it('al fusionar, el aviso de una fila sola no queda desactualizado', () => {
    const [f] = procesar([
      cruda(2, { Nombre: 'Ana Gil', Teléfono: '011 5555-0123', Mensaje: 'y'.repeat(2500) }),
      cruda(3, { Nombre: 'Ana Gil', Teléfono: '011 5555-0123', Mensaje: 'corto' }),
    ])
    // La más reciente entra sola (sin fechas, la última del archivo); la larga queda afuera.
    expect(f.descripcion).toBe('corto')
    expect(f.avisos.filter((a) => a.includes('muy larga'))).toEqual([])
    expect(f.avisos).toContain('1 consulta más antigua quedó afuera del detalle: no entraban en 2000 caracteres.')
  })
})

describe('prepararRevision con consultas repetidas', () => {
  beforeEach(() => invoke.mockReset())

  const archivo: ArchivoLeido = {
    hoja: null,
    encabezados: ENCABEZADOS,
    filas: [...CAMILA, cruda(6, { Nombre: 'Luis Paz', Teléfono: '011 5555-0199', 'Fecha de creación': '02/04/2026' })],
  }

  it('a la función le llegan las filas ya fusionadas, con el teléfono y el email de la persona', async () => {
    invoke.mockResolvedValueOnce({
      data: { resultados: [], cupo: { limite: null, usados: 0 } },
      error: null,
    })

    const r = await prepararRevision(archivo, MAPEO)

    const { filas } = invoke.mock.calls[0][1].body
    expect(filas).toEqual([
      { fila: 2, telefono: '02234246323', email: 'camila.rey@ejemplo.com' },
      { fila: 6, telefono: '011 5555-0199', email: null },
    ])
    expect(r.clasificacion.aImportar.map((f) => f.fila)).toEqual([2, 6])
    expect(r.clasificacion.duplicadasEnArchivo.map((f) => f.fila)).toEqual([3, 4, 5])
  })

  it('el resumen cuenta las consultas fusionadas aparte de los duplicados contra la base', async () => {
    invoke.mockResolvedValueOnce({
      data: {
        resultados: [
          { fila: 2, duplicado: null },
          { fila: 6, duplicado: 'telefono' },
        ],
        cupo: { limite: null, usados: 0 },
      },
      error: null,
    })
    const revision = await prepararRevision(archivo, MAPEO)

    const r = resumirResultado(revision, {
      insertados: 1,
      resultados: [{ fila: 2, resultado: 'OK' }],
      corte: null,
    })

    expect(r.importados).toBe(1)
    expect(r.consultasFusionadas).toBe(3)
    expect(r.omitidosPorDuplicado).toBe(1)
    expect(r.importados + r.consultasFusionadas + r.omitidosPorDuplicado + r.conError + r.fueraPorLimite).toBe(
      archivo.filas.length,
    )
  })
})
