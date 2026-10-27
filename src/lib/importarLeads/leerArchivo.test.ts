import { describe, expect, it, vi } from 'vitest'
import {
  ErrorArchivoImportacion,
  MAX_FILAS_ARCHIVO,
  decodificarCsv,
  detectarDelimitador,
  leerBytes,
  valorDeCelda,
} from './leerArchivo'

// La primera prueba de .xlsx paga el costo de cargar exceljs (varios segundos).
vi.setConfig({ testTimeout: 30_000 })

/** Bytes de un texto en Windows-1252 (para lo que hace falta acá, igual a latin1). */
function bytes1252(texto: string): ArrayBuffer {
  const salida = new Uint8Array(texto.length)
  for (let i = 0; i < texto.length; i++) salida[i] = texto.charCodeAt(i)
  return salida.buffer
}

function bytesUtf8(texto: string): ArrayBuffer {
  const codificado = new TextEncoder().encode(texto)
  return codificado.buffer.slice(
    codificado.byteOffset,
    codificado.byteOffset + codificado.byteLength,
  ) as ArrayBuffer
}

async function xlsx(
  armar: (hoja: import('exceljs').Worksheet, libro: import('exceljs').Workbook) => void,
): Promise<ArrayBuffer> {
  const ExcelJS = await import('exceljs')
  const libro = new ExcelJS.Workbook()
  armar(libro.addWorksheet('Leads'), libro)
  const buffer = await libro.xlsx.writeBuffer()
  const vista = new Uint8Array(buffer as ArrayBuffer)
  return vista.buffer.slice(vista.byteOffset, vista.byteOffset + vista.byteLength) as ArrayBuffer
}

describe('valorDeCelda', () => {
  it('trimmea texto y devuelve null para vacío', () => {
    expect(valorDeCelda('  hola ')).toBe('hola')
    expect(valorDeCelda('   ')).toBeNull()
    expect(valorDeCelda(null)).toBeNull()
    expect(valorDeCelda(undefined)).toBeNull()
  })

  it('un número entero grande sale sin decimales ni notación científica', () => {
    expect(valorDeCelda(2235550101)).toBe('2235550101')
    expect(valorDeCelda(5492235550101)).toBe('5492235550101')
    expect(valorDeCelda(1.5)).toBe('1.5')
  })

  it('hipervínculo: toma el texto; sin texto, el mailto sin prefijo', () => {
    expect(valorDeCelda({ text: 'ana@ejemplo.com', hyperlink: 'mailto:ana@ejemplo.com' })).toBe(
      'ana@ejemplo.com',
    )
    expect(valorDeCelda({ text: '', hyperlink: 'mailto:ana@ejemplo.com' })).toBe('ana@ejemplo.com')
  })

  it('richText: junta los tramos', () => {
    expect(valorDeCelda({ richText: [{ text: 'Ana ' }, { text: 'Pérez' }] })).toBe('Ana Pérez')
  })

  it('fórmula: usa el resultado, también si es objeto', () => {
    expect(valorDeCelda({ formula: 'A1&B1', result: 'Ana Pérez' })).toBe('Ana Pérez')
    expect(valorDeCelda({ formula: 'A1', result: 42 })).toBe('42')
    expect(valorDeCelda({ formula: 'X', result: { error: '#N/A' } })).toBeNull()
    expect(valorDeCelda({ formula: 'X' })).toBeNull()
  })

  it('un error de celda es null', () => {
    expect(valorDeCelda({ error: '#REF!' })).toBeNull()
  })

  it('una fecha sale como dd/mm/aaaa leyendo los componentes UTC', () => {
    expect(valorDeCelda(new Date(Date.UTC(2026, 2, 5)))).toBe('05/03/2026')
    expect(valorDeCelda(new Date(Date.UTC(2026, 2, 5, 14, 30)))).toBe('05/03/2026 14:30')
  })
})

describe('detectarDelimitador', () => {
  it('coma, punto y coma y tab', () => {
    expect(detectarDelimitador('a,b,c\n1,2,3')).toBe(',')
    expect(detectarDelimitador('a;b;c\n1;2;3')).toBe(';')
    expect(detectarDelimitador('a\tb\tc\n1\t2\t3')).toBe('\t')
  })

  it('ignora los separadores entre comillas', () => {
    expect(detectarDelimitador('"a,b,c";d;e\n1;2;3')).toBe(';')
  })

  it('sin separadores cae en coma', () => {
    expect(detectarDelimitador('nombre\nAna')).toBe(',')
  })
})

describe('decodificarCsv', () => {
  it('UTF-8 con BOM', () => {
    expect(decodificarCsv(bytesUtf8('﻿Nombre,Teléfono'))).toBe('Nombre,Teléfono')
  })

  it('Windows-1252 cuando no es UTF-8 válido', () => {
    expect(decodificarCsv(bytes1252('Teléfono;Año;María'))).toBe('Teléfono;Año;María')
  })
})

describe('leerBytes: CSV', () => {
  it('lee un CSV con ";" y tildes en Windows-1252', async () => {
    const csv =
      'Nombre;Teléfono;Observaciones\r\nMaría;223 555-0101;Quiere un 2 ambientes\r\nJosé;;Vive en Güemes\r\n'
    const r = await leerBytes('leads.csv', bytes1252(csv))

    expect(r.hoja).toBeNull()
    expect(r.encabezados).toEqual(['Nombre', 'Teléfono', 'Observaciones'])
    expect(r.filas).toHaveLength(2)
    expect(r.filas[0]).toEqual({
      numeroFilaOriginal: 2,
      celdas: { 0: 'María', 1: '223 555-0101', 2: 'Quiere un 2 ambientes' },
    })
    expect(r.filas[1].celdas).toEqual({ 0: 'José', 1: null, 2: 'Vive en Güemes' })
  })

  it('lee UTF-8 con comillas y saltos de línea dentro de un campo', async () => {
    const csv = 'Nombre,Notas\n"Ana","Dijo ""hola"",\nvolver a llamar"\nLuis,ok\n'
    const r = await leerBytes('x.CSV', bytesUtf8(csv))

    expect(r.filas[0].celdas[1]).toBe('Dijo "hola",\nvolver a llamar')
    // El segundo lead es el registro 3, aunque esté en la línea 4.
    expect(r.filas[1].numeroFilaOriginal).toBe(3)
  })

  it('con tabuladores', async () => {
    const r = await leerBytes('x.csv', bytesUtf8('Nombre\tTel\nAna\t2235550101'))
    expect(r.encabezados).toEqual(['Nombre', 'Tel'])
    expect(r.filas[0].celdas[1]).toBe('2235550101')
  })

  it('ignora filas totalmente vacías y conserva el número original', async () => {
    const r = await leerBytes('x.csv', bytesUtf8('Nombre,Tel\n\n,\nAna,1\n'))
    expect(r.filas.map((f) => f.numeroFilaOriginal)).toEqual([4])
  })

  it('el encabezado es la primera fila no vacía', async () => {
    const r = await leerBytes('x.csv', bytesUtf8('\n\nNombre,Tel\nAna,1'))
    expect(r.encabezados).toEqual(['Nombre', 'Tel'])
  })

  it('un dato más a la derecha del encabezado agrega una columna sin nombre', async () => {
    const r = await leerBytes('x.csv', bytesUtf8('Nombre\nAna,extra'))
    expect(r.encabezados).toEqual(['Nombre', ''])
    expect(r.filas[0].celdas[1]).toBe('extra')
  })
})

describe('leerBytes: XLSX', () => {
  it('lee la hoja, los encabezados y celdas de distintos tipos', async () => {
    const datos = await xlsx((hoja) => {
      hoja.addRow(['Nombre', 'Teléfono', 'Email', 'Fecha', 'Notas'])
      hoja.addRow([
        'Ana Gómez',
        2235550101,
        { text: 'ana@ejemplo.com', hyperlink: 'mailto:ana@ejemplo.com' },
        new Date(Date.UTC(2026, 2, 5, 9, 15)),
        { richText: [{ text: 'Busca ' }, { text: 'depto' }] },
      ])
      hoja.addRow(['Luis', { formula: 'A1&"x"', result: '223 555-0102' }, null, null, null])
    })

    const r = await leerBytes('leads.xlsx', datos)

    expect(r.hoja).toBe('Leads')
    expect(r.encabezados).toEqual(['Nombre', 'Teléfono', 'Email', 'Fecha', 'Notas'])
    expect(r.filas[0].celdas).toEqual({
      0: 'Ana Gómez',
      1: '2235550101',
      2: 'ana@ejemplo.com',
      3: '05/03/2026 09:15',
      4: 'Busca depto',
    })
    expect(r.filas[1].celdas[1]).toBe('223 555-0102')
    expect(r.filas[1].celdas[2]).toBeNull()
  })

  it('usa la primera hoja que tiene datos y salta las vacías', async () => {
    const datos = await xlsx((_hoja, libro) => {
      const segunda = libro.addWorksheet('Datos')
      segunda.addRow(['Nombre'])
      segunda.addRow(['Ana'])
    })
    // La primera hoja ("Leads") quedó sin filas.
    const r = await leerBytes('x.xlsx', datos)
    expect(r.hoja).toBe('Datos')
  })

  it('conserva el número de fila original aunque haya huecos', async () => {
    const datos = await xlsx((hoja) => {
      hoja.addRow(['Nombre'])
      hoja.addRow([null])
      hoja.addRow(['Ana'])
    })
    const r = await leerBytes('x.xlsx', datos)
    expect(r.filas.map((f) => f.numeroFilaOriginal)).toEqual([3])
  })
})

describe('leerBytes: límites y errores', () => {
  it('rechaza un formato que no es xlsx ni csv', async () => {
    await expect(leerBytes('x.pdf', bytesUtf8('a'))).rejects.toThrow(ErrorArchivoImportacion)
    await expect(leerBytes('x.xls', bytesUtf8('a'))).rejects.toThrow(/\.xlsx/)
  })

  it('rechaza un archivo vacío o de más de 5 MB', async () => {
    await expect(leerBytes('x.csv', new ArrayBuffer(0))).rejects.toThrow(/vacío/)
    await expect(leerBytes('x.csv', new ArrayBuffer(5 * 1024 * 1024 + 1))).rejects.toThrow(/5 MB/)
  })

  it('rechaza más de 2.000 filas de datos, pero acepta exactamente 2.000', async () => {
    const filas = (n: number) =>
      'Nombre\n' + Array.from({ length: n }, (_, i) => `Lead ${i}`).join('\n')

    const justo = await leerBytes('x.csv', bytesUtf8(filas(MAX_FILAS_ARCHIVO)))
    expect(justo.filas).toHaveLength(MAX_FILAS_ARCHIVO)

    await expect(leerBytes('x.csv', bytesUtf8(filas(MAX_FILAS_ARCHIVO + 1)))).rejects.toThrow(
      /máximo es 2\.000/,
    )
  })

  it('solo encabezados o sin datos', async () => {
    await expect(leerBytes('x.csv', bytesUtf8('Nombre,Tel'))).rejects.toThrow(/encabezados/)
    await expect(leerBytes('x.csv', bytesUtf8('\n\n'))).rejects.toThrow(/no tiene datos/)
  })

  it('un .xlsx corrupto da un error legible', async () => {
    await expect(leerBytes('x.xlsx', bytesUtf8('no soy un zip'))).rejects.toThrow(/No pudimos abrir/)
  })
})
