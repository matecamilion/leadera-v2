/**
 * "Respondido el": cuándo respondió el agente a un contacto en otro sistema. Se
 * importa como fecha de primer y último contacto real. Todo inventado.
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('../supabase', () => ({ supabase: { rpc: vi.fn(), functions: { invoke: vi.fn() } } }))

import { armarPayload } from '../api/importarLeads'
import { marcarDuplicadosEnArchivo } from './duplicadosEnArchivo'
import type { FilaCruda } from './leerArchivo'
import { sugerirMapeo, type MapeoColumnas } from './mapeoColumnas'
import { normalizarFilas } from './normalizarFilas'

const MAPEO: MapeoColumnas = { nombre: 0, telefono: 1, fechaIngreso: 2, respondidoEl: 3 }
const ENCABEZADOS = ['Nombre', 'Teléfono', 'Fecha de creación', 'Respondido el']

const crudas = (...filas: [string | null, string | null][]): FilaCruda[] =>
  filas.map(([creacion, respondido], i) => ({
    numeroFilaOriginal: i + 2,
    celdas: { 0: 'Ana Gil', 1: '011 5555-0123', 2: creacion, 3: respondido },
  }))

const unaFila = (creacion: string | null, respondido: string | null, mapeo: MapeoColumnas = MAPEO) =>
  normalizarFilas(crudas([creacion, respondido]), mapeo, ENCABEZADOS)[0]

const persona = (...filas: [string | null, string | null][]) =>
  marcarDuplicadosEnArchivo(normalizarFilas(crudas(...filas), MAPEO, ENCABEZADOS))

describe('autodetección de "Respondido el"', () => {
  it('"Respondido el", "Fecha de respuesta" y "Respondido" son la fecha de respuesta', () => {
    expect(sugerirMapeo(['Nombre', 'Respondido el']).mapeo.respondidoEl).toBe(1)
    expect(sugerirMapeo(['Nombre', 'Fecha de respuesta']).mapeo.respondidoEl).toBe(1)
    expect(sugerirMapeo(['Nombre', 'Respondido']).mapeo.respondidoEl).toBe(1)
    expect(sugerirMapeo(['Nombre', 'RESPONDIDO EL']).mapeo.respondidoEl).toBe(1)
  })

  it('"Tiempo de respuesta" es una duración: no se confunde con la fecha', () => {
    const { mapeo, sinMapear } = sugerirMapeo(['Nombre', 'Fecha de creación', 'Respondido el', 'Tiempo de respuesta'])
    expect(mapeo.respondidoEl).toBe(2)
    expect(sinMapear).toEqual([3])
    expect(sugerirMapeo(['Nombre', 'Tiempo de respuesta']).mapeo.respondidoEl).toBeUndefined()
  })

  it('no le saca la columna a la fecha de creación ni se la lleva ella', () => {
    const { mapeo } = sugerirMapeo(['Nombre', 'Fecha de creación', 'Respondido el'])
    expect(mapeo).toMatchObject({ fechaIngreso: 1, respondidoEl: 2 })
  })
})

describe('una fila con "Respondido el"', () => {
  it('se parsea como la fecha de creación: dd/mm/aaaa con hora', () => {
    const f = unaFila('05/03/2026 10:00', '05/03/2026 10:14')
    expect(f.primerContacto).toEqual(new Date(2026, 2, 5, 10, 14))
    expect(f.ultimoContacto).toEqual(new Date(2026, 2, 5, 10, 14))
    expect(f.errores).toEqual([])
    expect(f.avisos.some((a) => a.includes('Respondido el'))).toBe(false)
  })

  it('acepta aaaa-mm-dd y la misma convención de hora que la creación: 14 minutos son 14 minutos', () => {
    const f = unaFila('2026-03-05 10:00', '2026-03-05 10:14')
    const diferencia = f.primerContacto!.getTime() - f.fechaIngreso!.getTime()
    expect(diferencia).toBe(14 * 60_000)
    expect(new Date(f.primerContacto!.toISOString()).getTime() - new Date(f.fechaIngreso!.toISOString()).getTime()).toBe(
      14 * 60_000,
    )
  })

  it('un serial de Excel también sirve', () => {
    // 46086,5 = 05/03/2026 12:00.
    const f = unaFila(null, '46086.5')
    expect(f.primerContacto).toEqual(new Date(2026, 2, 5, 12, 0))
  })

  it('anterior a la fecha de creación: se ignora, con aviso, y no se manda', () => {
    const f = unaFila('05/03/2026 10:00', '05/03/2026 09:00')
    expect(f.primerContacto).toBeNull()
    expect(f.ultimoContacto).toBeNull()
    expect(f.avisos).toContain('Respondido el anterior a la fecha de creación; se ignora.')
  })

  it('igual a la fecha de creación sirve', () => {
    const f = unaFila('05/03/2026 10:00', '05/03/2026 10:00')
    expect(f.primerContacto).toEqual(new Date(2026, 2, 5, 10, 0))
  })

  it('sin fecha de creación se manda igual', () => {
    const f = unaFila(null, '01/01/2020 09:00')
    expect(f.primerContacto).toEqual(new Date(2020, 0, 1, 9, 0))
    expect(f.avisos.some((a) => a.includes('anterior'))).toBe(false)
  })

  it('con una fecha de creación ilegible tampoco se compara', () => {
    const f = unaFila('mañana', '01/01/2020 09:00')
    expect(f.primerContacto).toEqual(new Date(2020, 0, 1, 9, 0))
  })

  it('una fecha ilegible se ignora con aviso', () => {
    const f = unaFila('05/03/2026', 'ayer')
    expect(f.primerContacto).toBeNull()
    expect(f.avisos).toContain('No entendimos "Respondido el" ("ayer"): se ignora.')
  })

  it('una fecha futura se ignora con aviso', () => {
    const f = unaFila(null, '01/01/2099')
    expect(f.primerContacto).toBeNull()
    expect(f.avisos).toContain('Respondido el es una fecha futura: se ignora.')
  })

  it('sin la celda no hay contacto ni aviso', () => {
    const f = unaFila('05/03/2026', null)
    expect(f.primerContacto).toBeNull()
    expect(f.ultimoContacto).toBeNull()
    expect(f.avisos.some((a) => a.includes('Respondido el'))).toBe(false)
  })

  it('sin la columna mapeada el comportamiento es el de siempre', () => {
    const sinColumna: MapeoColumnas = { nombre: 0, telefono: 1, fechaIngreso: 2 }
    const f = unaFila('05/03/2026 10:00', '05/03/2026 10:14', sinColumna)
    expect(f.primerContacto).toBeNull()
    expect(f.ultimoContacto).toBeNull()
    expect(f.avisos.some((a) => a.includes('Respondido el'))).toBe(false)
  })
})

describe('fusión de consultas con respuestas', () => {
  it('el primer contacto es la respuesta más antigua y el último la más reciente', () => {
    const [lead] = persona(
      ['10/03/2026 09:00', '10/03/2026 12:00'],
      ['04/03/2026 09:00', '05/03/2026 08:00'],
      ['18/03/2026 09:00', '20/03/2026 09:00'],
    )
    expect(lead.primerContacto).toEqual(new Date(2026, 2, 5, 8, 0))
    expect(lead.ultimoContacto).toEqual(new Date(2026, 2, 20, 9, 0))
    expect(lead.consultasFusionadas).toBe(2)
  })

  it('si solo una consulta tiene respuesta, las dos fechas son esa', () => {
    const [lead] = persona(['10/03/2026 09:00', null], ['11/03/2026 09:00', '12/03/2026 10:30'], ['13/03/2026 09:00', null])
    expect(lead.primerContacto).toEqual(new Date(2026, 2, 12, 10, 30))
    expect(lead.ultimoContacto).toEqual(new Date(2026, 2, 12, 10, 30))
  })

  it('si ninguna tiene respuesta no se manda nada', () => {
    const [lead] = persona(['10/03/2026 09:00', null], ['11/03/2026 09:00', null])
    expect(lead.primerContacto).toBeNull()
    expect(lead.ultimoContacto).toBeNull()
  })

  it('una respuesta descartada de una fila no cuenta para la fusión', () => {
    const [lead] = persona(
      ['10/03/2026 09:00', '01/03/2026 09:00'], // anterior a su creación: se ignora
      ['11/03/2026 09:00', '12/03/2026 10:30'],
    )
    expect(lead.primerContacto).toEqual(new Date(2026, 2, 12, 10, 30))
    expect(lead.ultimoContacto).toEqual(new Date(2026, 2, 12, 10, 30))
  })
})

describe('payload a la RPC', () => {
  it('manda las dos fechas en ISO, con la misma convención que fecha_ingreso', () => {
    const [lead] = persona(['05/03/2026 10:00', '05/03/2026 10:14'])
    const [p] = armarPayload([lead])
    expect(p.fecha_ingreso).toBe(new Date(2026, 2, 5, 10, 0).toISOString())
    expect(p.fecha_primer_contacto_real).toBe(new Date(2026, 2, 5, 10, 14).toISOString())
    expect(p.fecha_ultimo_contacto_real).toBe(new Date(2026, 2, 5, 10, 14).toISOString())
  })

  it('de una persona fusionada manda el primero y el último', () => {
    const [lead] = persona(
      ['10/03/2026 09:00', '10/03/2026 12:00'],
      ['04/03/2026 09:00', '05/03/2026 08:00'],
    )
    const [p] = armarPayload([lead])
    expect(p.fecha_primer_contacto_real).toBe(new Date(2026, 2, 5, 8, 0).toISOString())
    expect(p.fecha_ultimo_contacto_real).toBe(new Date(2026, 2, 10, 12, 0).toISOString())
  })

  it('sin respuesta no manda las claves', () => {
    const [p] = armarPayload(persona(['05/03/2026 10:00', null]))
    expect('fecha_primer_contacto_real' in p).toBe(false)
    expect('fecha_ultimo_contacto_real' in p).toBe(false)
  })

  it('una respuesta anterior a la creación no se manda', () => {
    const [p] = armarPayload(persona(['05/03/2026 10:00', '05/03/2026 09:00']))
    expect('fecha_primer_contacto_real' in p).toBe(false)
    expect('fecha_ultimo_contacto_real' in p).toBe(false)
  })

  it('sin la columna mapeada el payload es el de siempre', () => {
    const sin = normalizarFilas(crudas(['05/03/2026 10:00', '05/03/2026 10:14']), { nombre: 0, telefono: 1, fechaIngreso: 2 })
    const [p] = armarPayload(marcarDuplicadosEnArchivo(sin))
    expect(Object.keys(p).sort()).toEqual(['descripcion_inicial', 'fecha_ingreso', 'fila', 'nombre', 'telefono'])
  })
})
