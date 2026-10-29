/**
 * Qué datos conserva un lead fusionado (origen, estado) y cómo se arma su detalle
 * cuando varias consultas son por la misma propiedad. Todo inventado.
 */
import { describe, expect, it } from 'vitest'
import { marcarDuplicadosEnArchivo } from './duplicadosEnArchivo'
import type { FilaCruda } from './leerArchivo'
import type { MapeoColumnas } from './mapeoColumnas'
import { normalizarFilas } from './normalizarFilas'

const ENCABEZADOS = ['Nombre', 'Teléfono', 'Email', 'Estado', 'Fecha', 'Origen', 'Mensaje', 'Dirección', 'Precio']
const MAPEO: MapeoColumnas = {
  nombre: 0,
  telefono: 1,
  email: 2,
  estado: 3,
  fechaIngreso: 4,
  origen: 5,
  descripcion: 6,
  detalle: [7, 8],
}

interface Datos {
  estado?: string
  fecha?: string
  origen?: string
  mensaje?: string
  direccion?: string
  precio?: string
}

/** Todas las filas son la misma persona (mismo teléfono). */
function persona(...consultas: Datos[]) {
  const crudas: FilaCruda[] = consultas.map((d, i) => ({
    numeroFilaOriginal: i + 2,
    celdas: {
      0: 'Ana Gil',
      1: '011 5555-0123',
      2: null,
      3: d.estado ?? null,
      4: d.fecha ?? null,
      5: d.origen ?? null,
      6: d.mensaje ?? null,
      7: d.direccion ?? null,
      8: d.precio ?? null,
    },
  }))
  return marcarDuplicadosEnArchivo(normalizarFilas(crudas, MAPEO, ENCABEZADOS))
}

describe('origen del lead fusionado', () => {
  it('sale de la consulta más antigua aunque venga última en el archivo', () => {
    const [lead] = persona(
      { fecha: '20/04/2026', origen: 'Argenprop' },
      { fecha: '10/04/2026', origen: 'ZonaProp' },
    )
    expect(lead.origen).toBe('ZONAPROP')
  })

  it('si la más antigua no trae origen, es el de la más antigua que sí lo trae', () => {
    const [lead] = persona(
      { fecha: '05/04/2026' },
      { fecha: '20/04/2026', origen: 'ZonaProp' },
      { fecha: '10/04/2026', origen: 'Mercado Libre' },
    )
    expect(lead.origen).toBe('MERCADO_LIBRE')
  })

  it('a igual fecha gana la primera del archivo', () => {
    const [lead] = persona(
      { fecha: '10/04/2026', origen: 'Argenprop' },
      { fecha: '10/04/2026', origen: 'ZonaProp' },
    )
    expect(lead.origen).toBe('ARGENPROP')
  })

  it('sin fechas gana la primera fila del archivo que tenga origen', () => {
    const [lead] = persona({ origen: 'Argenprop' }, { origen: 'ZonaProp' })
    expect(lead.origen).toBe('ARGENPROP')
    expect(persona({}, { origen: 'ZonaProp' })[0].origen).toBe('ZONAPROP')
  })

  it('una fecha conocida va antes que una desconocida', () => {
    const [lead] = persona({ origen: 'Argenprop' }, { fecha: '10/04/2026', origen: 'ZonaProp' })
    expect(lead.origen).toBe('ZONAPROP')
  })

  it('si ninguna fila trae origen no se manda', () => {
    expect(persona({ fecha: '10/04/2026' }, { fecha: '11/04/2026' })[0].origen).toBeNull()
  })

  it('la fecha de ingreso sigue siendo la más antigua', () => {
    const [lead] = persona({ fecha: '20/04/2026' }, { fecha: '10/04/2026' })
    expect(lead.fechaIngreso).toEqual(new Date(2026, 3, 10))
  })
})

describe('estado del lead fusionado', () => {
  it('sale de la consulta más reciente aunque venga primera en el archivo', () => {
    const [lead] = persona(
      { fecha: '20/04/2026', estado: 'tibio' },
      { fecha: '10/04/2026', estado: 'caliente' },
    )
    expect(lead.estado).toBe('TIBIO')
  })

  it('si la más reciente no trae estado, es el de la más reciente que sí lo trae', () => {
    const [lead] = persona(
      { fecha: '10/04/2026', estado: 'caliente' },
      { fecha: '15/04/2026', estado: 'frio' },
      { fecha: '20/04/2026' },
    )
    expect(lead.estado).toBe('FRIO')
  })

  it('con empate de fecha gana la primera del archivo', () => {
    const [lead] = persona(
      { fecha: '10/04/2026', estado: 'frio' },
      { fecha: '10/04/2026', estado: 'caliente' },
    )
    expect(lead.estado).toBe('FRIO')
  })

  it('sin fechas gana la primera fila del archivo que tenga estado', () => {
    expect(persona({ estado: 'tibio' }, { estado: 'caliente' })[0].estado).toBe('TIBIO')
    expect(persona({}, { estado: 'caliente' })[0].estado).toBe('CALIENTE')
  })

  it('una fecha conocida pesa más que una desconocida', () => {
    const [lead] = persona({ estado: 'caliente' }, { fecha: '05/04/2026', estado: 'frio' })
    expect(lead.estado).toBe('FRIO')
  })

  it('si ninguna fila trae estado queda sin estado', () => {
    expect(persona({ fecha: '10/04/2026' }, { fecha: '11/04/2026' })[0].estado).toBeNull()
  })

  it('el nombre, el teléfono y el email siguen saliendo de la primera fila', () => {
    const crudas: FilaCruda[] = [
      { numeroFilaOriginal: 2, celdas: { 0: 'Ana Gil', 1: '011 5555-0123', 2: null, 4: '20/04/2026' } },
      { numeroFilaOriginal: 3, celdas: { 0: 'A. Gil', 1: '011 5555-0123', 2: 'ana@ejemplo.com', 4: '10/04/2026' } },
    ]
    const [lead] = marcarDuplicadosEnArchivo(normalizarFilas(crudas, MAPEO, ENCABEZADOS))
    expect(lead).toMatchObject({ nombre: 'Ana Gil', telefono: '011 5555-0123', email: 'ana@ejemplo.com' })
  })
})

describe('propiedad repetida en el detalle', () => {
  const MISMA = 'Misma propiedad que la consulta anterior'

  it('un bloque idéntico al anterior no se repite; la primera consulta lleva el bloque completo', () => {
    const [lead] = persona(
      { fecha: '01/04/2026', direccion: 'Calle 1', precio: '100' },
      { fecha: '02/04/2026', direccion: 'Calle 1', precio: '100' },
    )
    expect(lead.descripcion).toBe(
      ['Consulta del 01/04/2026\nDirección: Calle 1\nPrecio: 100', `Consulta del 02/04/2026\n${MISMA}`].join('\n---\n'),
    )
  })

  it('si difiere aunque sea en una línea, va el bloque completo', () => {
    const [lead] = persona(
      { fecha: '01/04/2026', direccion: 'Calle 1', precio: '100' },
      { fecha: '02/04/2026', direccion: 'Calle 1', precio: '999' },
    )
    expect(lead.descripcion).toBe(
      [
        'Consulta del 01/04/2026\nDirección: Calle 1\nPrecio: 100',
        'Consulta del 02/04/2026\nDirección: Calle 1\nPrecio: 999',
      ].join('\n---\n'),
    )
  })

  it('se compara con la consulta anterior ya ordenada por fecha, y se encadena', () => {
    // En el archivo vienen desordenadas: por fecha son A, A, B, B.
    const [lead] = persona(
      { fecha: '04/04/2026', direccion: 'Calle 2', precio: '200' },
      { fecha: '01/04/2026', direccion: 'Calle 1', precio: '100' },
      { fecha: '03/04/2026', direccion: 'Calle 2', precio: '200' },
      { fecha: '02/04/2026', direccion: 'Calle 1', precio: '100' },
    )
    expect(lead.descripcion).toBe(
      [
        'Consulta del 01/04/2026\nDirección: Calle 1\nPrecio: 100',
        `Consulta del 02/04/2026\n${MISMA}`,
        'Consulta del 03/04/2026\nDirección: Calle 2\nPrecio: 200',
        `Consulta del 04/04/2026\n${MISMA}`,
      ].join('\n---\n'),
    )
  })

  it('el mensaje de la consulta se conserva y la referencia va después', () => {
    const [lead] = persona(
      { fecha: '01/04/2026', direccion: 'Calle 1', precio: '100' },
      { fecha: '02/04/2026', direccion: 'Calle 1', precio: '100', mensaje: 'Y el patio?' },
    )
    expect(lead.descripcion).toContain(`Consulta del 02/04/2026\nMensaje: Y el patio?\n${MISMA}`)
  })

  it('si la anterior no tenía propiedad, la siguiente lleva la suya completa', () => {
    const [lead] = persona(
      { fecha: '01/04/2026', mensaje: 'Hola' },
      { fecha: '02/04/2026', direccion: 'Calle 1', precio: '100' },
    )
    expect(lead.descripcion).not.toContain(MISMA)
    expect(lead.descripcion).toContain('Dirección: Calle 1')
  })

  it('una persona con una sola consulta no lleva la referencia', () => {
    const [lead] = persona({ fecha: '01/04/2026', direccion: 'Calle 1', precio: '100' })
    expect(lead.descripcion).toBe('Consulta del 01/04/2026\nDirección: Calle 1\nPrecio: 100')
  })
})

describe('mensaje con texto fijo de portal', () => {
  const FRASE =
    '¡Luego de contactarlo, pide que te califiquen! ¡Envía el siguiente link y tu buena atención se reflejará en tus avisos! https://www.zonaprop.com.ar/panel/feedback/55?utm_source=integracion&utm_medium=link'

  it('el detalle no lleva el texto fijo y conserva "Pregunta: "', () => {
    const [lead] = persona({ fecha: '01/04/2026', mensaje: `Pregunta: ¿Sigue disponible? ${FRASE}` })
    expect(lead.descripcion).toBe('Consulta del 01/04/2026\nMensaje: Pregunta: ¿Sigue disponible?')
    expect(lead.descripcion).not.toContain('utm_')
  })

  it('si el mensaje queda vacío se omite la línea "Mensaje:"', () => {
    const [lead] = persona({ fecha: '01/04/2026', direccion: 'Calle 1', mensaje: `Pregunta: ${FRASE}` })
    expect(lead.descripcion).toBe('Consulta del 01/04/2026\nDirección: Calle 1')
    expect(lead.descripcion).not.toContain('Mensaje:')
  })
})
