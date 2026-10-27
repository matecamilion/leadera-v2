import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FilaConDuplicado } from '../importarLeads/duplicadosEnArchivo'
import type { FilaNormalizada } from '../importarLeads/normalizarFilas'

const { rpc, invoke } = vi.hoisted(() => ({ rpc: vi.fn(), invoke: vi.fn() }))

vi.mock('../supabase', () => ({
  supabase: { rpc, functions: { invoke } },
}))

import {
  TAMANO_LOTE,
  armarPayload,
  armarPedidoDeVerificacion,
  clasificarFilas,
  importarLeads,
  verificarDuplicados,
  type FilaParaImportar,
} from './importarLeads'

/** Filas mínimas para la RPC, numeradas desde `desde`. */
function filasParaImportar(cantidad: number, desde = 2): FilaParaImportar[] {
  return Array.from({ length: cantidad }, (_, i) => ({ fila: desde + i, nombre: `Lead ${desde + i}` }))
}

/** Respuesta de la RPC para un lote: `decidir` elige el resultado de cada fila. */
function respuestaDeLote(
  lote: FilaParaImportar[],
  decidir: (indice: number) => 'OK' | 'EMAIL_DUPLICADO' | 'LIMITE_ALCANZADO' | 'ERROR' = () => 'OK',
) {
  const resultados = lote.map((f, i) => ({ fila: f.fila, resultado: decidir(i) }))
  return {
    data: { insertados: resultados.filter((r) => r.resultado === 'OK').length, resultados },
    error: null,
  }
}

beforeEach(() => {
  rpc.mockReset()
  invoke.mockReset()
})

describe('importarLeads: lotes', () => {
  it('450 filas son 3 llamadas de 200, 200 y 50, en orden', async () => {
    rpc.mockImplementation((_nombre: string, { p_filas }: { p_filas: FilaParaImportar[] }) =>
      Promise.resolve(respuestaDeLote(p_filas)),
    )
    const progreso = vi.fn()

    const r = await importarLeads(filasParaImportar(450), { onProgreso: progreso })

    expect(TAMANO_LOTE).toBe(200)
    expect(rpc).toHaveBeenCalledTimes(3)
    expect(rpc.mock.calls.map(([nombre]) => nombre)).toEqual(Array(3).fill('importar_leads'))
    expect(rpc.mock.calls.map(([, args]) => args.p_filas.length)).toEqual([200, 200, 50])
    expect(rpc.mock.calls[0][1].p_filas[0].fila).toBe(2)
    expect(rpc.mock.calls[2][1].p_filas[0].fila).toBe(402)

    expect(r.insertados).toBe(450)
    expect(r.resultados).toHaveLength(450)
    expect(r.corte).toBeNull()
    expect(progreso.mock.calls).toEqual([
      [200, 450],
      [400, 450],
      [450, 450],
    ])
  })

  it('sin filas no llama a la base', async () => {
    const r = await importarLeads([])
    expect(rpc).not.toHaveBeenCalled()
    expect(r).toEqual({ insertados: 0, resultados: [], corte: null })
  })

  it('los resultados por fila se conservan (duplicados y errores incluidos)', async () => {
    rpc.mockResolvedValueOnce({
      data: {
        insertados: 1,
        resultados: [
          { fila: 2, resultado: 'OK' },
          { fila: 3, resultado: 'EMAIL_DUPLICADO' },
          { fila: 4, resultado: 'ERROR', mensaje: 'Falta el nombre.' },
        ],
      },
      error: null,
    })

    const r = await importarLeads(filasParaImportar(3))

    expect(r.insertados).toBe(1)
    expect(r.resultados).toEqual([
      { fila: 2, resultado: 'OK' },
      { fila: 3, resultado: 'EMAIL_DUPLICADO' },
      { fila: 4, resultado: 'ERROR', mensaje: 'Falta el nombre.' },
    ])
  })
})

describe('importarLeads: tope del plan', () => {
  it('corta tras el lote que informa LIMITE_ALCANZADO y marca el resto sin llamar', async () => {
    rpc
      .mockImplementationOnce((_n: string, { p_filas }: { p_filas: FilaParaImportar[] }) =>
        Promise.resolve(respuestaDeLote(p_filas)),
      )
      // Segundo lote: entran 30 y el resto del lote queda en el tope.
      .mockImplementationOnce((_n: string, { p_filas }: { p_filas: FilaParaImportar[] }) =>
        Promise.resolve(respuestaDeLote(p_filas, (i) => (i < 30 ? 'OK' : 'LIMITE_ALCANZADO'))),
      )
    const progreso = vi.fn()

    const r = await importarLeads(filasParaImportar(450), { onProgreso: progreso })

    expect(rpc).toHaveBeenCalledTimes(2)
    expect(r.corte).toBeNull()
    expect(r.insertados).toBe(230)
    expect(r.resultados).toHaveLength(450)

    const limite = r.resultados.filter((x) => x.resultado === 'LIMITE_ALCANZADO')
    expect(limite).toHaveLength(170 + 50)
    // Las del tercer lote (filas 402 a 451) las marcó el cliente.
    expect(r.resultados.slice(400)).toEqual(
      Array.from({ length: 50 }, (_, i) => ({ fila: 402 + i, resultado: 'LIMITE_ALCANZADO' })),
    )
    expect(progreso.mock.calls.at(-1)).toEqual([450, 450])
  })
})

describe('importarLeads: error de la llamada', () => {
  it('error de red en el segundo lote: devuelve lo acumulado y el corte, sin lanzar', async () => {
    rpc
      .mockImplementationOnce((_n: string, { p_filas }: { p_filas: FilaParaImportar[] }) =>
        Promise.resolve(respuestaDeLote(p_filas)),
      )
      .mockResolvedValueOnce({ data: null, error: { message: 'TypeError: Failed to fetch' } })

    const r = await importarLeads(filasParaImportar(450))

    expect(rpc).toHaveBeenCalledTimes(2)
    expect(r.insertados).toBe(200)
    expect(r.resultados).toHaveLength(200)
    expect(r.corte).not.toBeNull()
    expect(r.corte?.mensaje).toMatch(/interrumpió/)
    // El lote que falló (202 a 401) y el siguiente (402 a 451).
    expect(r.corte?.filasSinProcesar).toHaveLength(250)
    expect(r.corte?.filasSinProcesar[0]).toBe(202)
    expect(r.corte?.filasSinProcesar.at(-1)).toBe(451)
  })

  it('una excepción de la llamada también es un corte', async () => {
    rpc.mockRejectedValueOnce(new Error('boom'))

    const r = await importarLeads(filasParaImportar(5))

    expect(r.insertados).toBe(0)
    expect(r.corte?.filasSinProcesar).toEqual([2, 3, 4, 5, 6])
  })

  it('un error de sesión de la RPC (P0001) muestra su mensaje', async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: { code: 'P0001', message: 'Tu usuario está desactivado.' },
    })

    const r = await importarLeads(filasParaImportar(3))

    expect(r.corte?.mensaje).toContain('Tu usuario está desactivado.')
    expect(r.corte?.filasSinProcesar).toHaveLength(3)
  })

  it('una respuesta que no tiene la forma del contrato es un corte', async () => {
    rpc.mockResolvedValueOnce({ data: { insertados: 1 }, error: null })

    const r = await importarLeads(filasParaImportar(3))

    expect(r.corte?.mensaje).toContain('respuesta inesperada')
  })

  it('una fila que la RPC no devolvió se informa como error, no como OK', async () => {
    rpc.mockResolvedValueOnce({
      data: { insertados: 1, resultados: [{ fila: 2, resultado: 'OK' }] },
      error: null,
    })

    const r = await importarLeads(filasParaImportar(2))

    expect(r.insertados).toBe(1)
    expect(r.resultados[1]).toMatchObject({ fila: 3, resultado: 'ERROR' })
  })
})

// ---------------------------------------------------------------------------

function normalizada(n: number, cambios: Partial<FilaNormalizada> = {}): FilaNormalizada {
  return {
    fila: n,
    nombre: `Lead ${n}`,
    apellido: null,
    telefono: null,
    telefonoNorm: null,
    telefonoDudoso: false,
    email: null,
    estado: null,
    origen: 'IMPORTACION',
    fechaIngreso: null,
    descripcion: null,
    errores: [],
    avisos: [],
    ...cambios,
  }
}

describe('armarPayload', () => {
  it('usa el teléfono tal cual lo tipeó el agente, no el normalizado', () => {
    const [p] = armarPayload([
      normalizada(2, { telefono: '223 555-0101', telefonoNorm: '5492235550101' }),
    ])
    expect(p.telefono).toBe('223 555-0101')
    expect(JSON.stringify(p)).not.toContain('5492235550101')
  })

  it('arma todos los campos y la fecha en ISO', () => {
    const fecha = new Date(Date.UTC(2026, 2, 5, 13, 30))
    const [p] = armarPayload([
      normalizada(7, {
        nombre: 'Ana',
        apellido: 'Gómez',
        telefono: '114 555-0105',
        email: 'ana@ejemplo.com',
        descripcion: 'Busca 2 ambientes',
        estado: 'TIBIO',
        fechaIngreso: fecha,
      }),
    ])
    expect(p).toEqual({
      fila: 7,
      nombre: 'Ana',
      apellido: 'Gómez',
      telefono: '114 555-0105',
      email: 'ana@ejemplo.com',
      descripcion_inicial: 'Busca 2 ambientes',
      estado: 'TIBIO',
      fecha_ingreso: '2026-03-05T13:30:00.000Z',
    })
  })

  it('los campos vacíos se omiten, la fecha incluida', () => {
    const [p] = armarPayload([normalizada(2)])
    expect(p).toEqual({ fila: 2, nombre: 'Lead 2' })
    expect('fecha_ingreso' in p).toBe(false)
  })

  it('nunca incluye agente_id, asignado_a ni inmobiliaria_id', () => {
    // Aunque la fila de entrada trajera esas claves por error, no pasan.
    const sucia = {
      ...normalizada(2, { telefono: '2235550101', email: 'a@b.co', estado: 'FRIO' }),
      agente_id: 'x',
      asignado_a: 'y',
      inmobiliaria_id: 'z',
    }
    const json = JSON.stringify(armarPayload([sucia]))
    expect(json).not.toMatch(/agente_id|asignado_a|inmobiliaria_id/)
  })

  it('no modifica ni filtra las filas', () => {
    const filas = [normalizada(2), normalizada(3, { errores: ['Falta el nombre.'] })]
    expect(armarPayload(filas)).toHaveLength(2)
  })
})

describe('armarPedidoDeVerificacion', () => {
  it('manda solo fila, teléfono y email', () => {
    const pedido = armarPedidoDeVerificacion([
      normalizada(2, { nombre: 'Ana', telefono: '2235550101', email: 'a@b.co', descripcion: 'x' }),
    ])
    expect(pedido).toEqual([{ fila: 2, telefono: '2235550101', email: 'a@b.co' }])
  })
})

describe('verificarDuplicados', () => {
  it('devuelve un mapa fila -> tipo de duplicado', async () => {
    invoke.mockResolvedValueOnce({
      data: {
        resultados: [
          { fila: 2, duplicado: 'telefono' },
          { fila: 3, duplicado: 'email' },
          { fila: 4, duplicado: null },
        ],
      },
      error: null,
    })

    const mapa = await verificarDuplicados([
      { fila: 2, telefono: '2235550101', email: null },
      { fila: 3, telefono: null, email: 'a@b.co' },
      { fila: 4, telefono: null, email: null },
    ])

    expect(invoke).toHaveBeenCalledWith('verificar-duplicados-importacion', {
      body: {
        filas: [
          { fila: 2, telefono: '2235550101', email: null },
          { fila: 3, telefono: null, email: 'a@b.co' },
          { fila: 4, telefono: null, email: null },
        ],
      },
    })
    expect([...mapa]).toEqual([
      [2, 'telefono'],
      [3, 'email'],
      [4, null],
    ])
  })

  it('sin filas no llama a la función', async () => {
    const mapa = await verificarDuplicados([])
    expect(invoke).not.toHaveBeenCalled()
    expect(mapa.size).toBe(0)
  })

  it('traduce el error de la función con el mensaje que devolvió', async () => {
    invoke.mockResolvedValueOnce({
      data: null,
      error: { context: new Response(JSON.stringify({ error: 'Tu usuario está desactivado' }), { status: 403 }) },
    })

    await expect(verificarDuplicados([{ fila: 2, telefono: null, email: 'a@b.co' }])).rejects.toThrow(
      'Tu usuario está desactivado',
    )
  })

  it('sin body propio usa el mensaje de la pantalla, no el de supabase-js', async () => {
    invoke.mockResolvedValueOnce({
      data: null,
      error: { message: 'Edge Function returned a non-2xx status code' },
    })

    await expect(verificarDuplicados([{ fila: 2, telefono: null, email: 'a@b.co' }])).rejects.toThrow(
      'No se pudo verificar si los leads ya existen.',
    )
  })

  it('una respuesta sin resultados es un error', async () => {
    invoke.mockResolvedValueOnce({ data: {}, error: null })
    await expect(verificarDuplicados([{ fila: 2, telefono: null, email: 'a@b.co' }])).rejects.toThrow()
  })
})

describe('clasificarFilas', () => {
  const sinDuplicado: FilaConDuplicado['duplicadoEnArchivo'] = null
  const conDup = (n: number, cambios: Partial<FilaConDuplicado> = {}): FilaConDuplicado => ({
    ...normalizada(n),
    duplicadoEnArchivo: sinDuplicado,
    ...cambios,
  })

  it('reparte cada fila en su categoría', () => {
    const filas = [
      conDup(2), // a importar
      conDup(3), // a importar
      conDup(4, { duplicadoEnArchivo: { duplicaA: 2, por: 'TELEFONO' } }), // en el archivo
      conDup(5), // en la base por teléfono
      conDup(6), // en la base por email
      conDup(7, { errores: ['Falta el nombre.'], nombre: '' }), // con error
    ]
    const base = new Map<number, 'telefono' | 'email' | null>([
      [2, null],
      [3, null],
      [5, 'telefono'],
      [6, 'email'],
    ])

    const c = clasificarFilas(filas, base)

    expect(c.aImportar.map((f) => f.fila)).toEqual([2, 3])
    expect(c.duplicadasEnArchivo.map((f) => f.fila)).toEqual([4])
    expect(c.duplicadasEnBase.porTelefono.map((f) => f.fila)).toEqual([5])
    expect(c.duplicadasEnBase.porEmail.map((f) => f.fila)).toEqual([6])
    expect(c.conError.map((f) => f.fila)).toEqual([7])
    expect(c.conteos).toEqual({
      total: 6,
      aImportar: 2,
      duplicadasEnArchivo: 1,
      duplicadasEnBasePorTelefono: 1,
      duplicadasEnBasePorEmail: 1,
      conError: 1,
    })
  })

  it('el error pesa más que el duplicado, y el del archivo más que el de la base', () => {
    const filas = [
      conDup(2, { errores: ['x'], duplicadoEnArchivo: { duplicaA: 9, por: 'EMAIL' } }),
      conDup(3, { duplicadoEnArchivo: { duplicaA: 9, por: 'EMAIL' } }),
    ]
    const c = clasificarFilas(filas, new Map([[2, 'telefono'], [3, 'telefono']]))
    expect(c.conError.map((f) => f.fila)).toEqual([2])
    expect(c.duplicadasEnArchivo.map((f) => f.fila)).toEqual([3])
    expect(c.duplicadasEnBase.porTelefono).toEqual([])
  })

  it('una fila que la función no evaluó se importa', () => {
    const c = clasificarFilas([conDup(2)], new Map())
    expect(c.aImportar).toHaveLength(1)
  })

  it('cada fila cae en una sola categoría: los conteos suman el total', () => {
    const filas = Array.from({ length: 10 }, (_, i) => conDup(i + 2))
    const base = new Map<number, 'telefono' | 'email' | null>([
      [3, 'telefono'],
      [5, 'email'],
    ])
    const { conteos } = clasificarFilas(filas, base)
    expect(
      conteos.aImportar +
        conteos.duplicadasEnArchivo +
        conteos.duplicadasEnBasePorTelefono +
        conteos.duplicadasEnBasePorEmail +
        conteos.conError,
    ).toBe(conteos.total)
  })

  it('sin filas devuelve todo en cero', () => {
    const c = clasificarFilas([], new Map())
    expect(c.conteos.total).toBe(0)
    expect(c.aImportar).toEqual([])
  })
})
