import { describe, expect, it } from 'vitest'
import {
  armarEquipoCalendario,
  asignadoDeAlta,
  claveDeEquipo,
  esDelEquipo,
} from './equipoCalendario'

const AGENTE = 'agente-1'
const ASISTENTE_A = 'asistente-a'
const ASISTENTE_B = 'asistente-b'

describe('armarEquipoCalendario', () => {
  it('para un agente o dueño con asistentes: él primero y luego sus asistentes', () => {
    const equipo = armarEquipoCalendario({ id: AGENTE, asiste_a: null }, [ASISTENTE_A, ASISTENTE_B])
    expect(equipo.duenoCalendario).toBe(AGENTE)
    expect(equipo.equipoIds).toEqual([AGENTE, ASISTENTE_A, ASISTENTE_B])
  })

  it('para un asistente: el dueño del calendario es su agente y el equipo es el mismo', () => {
    const equipo = armarEquipoCalendario({ id: ASISTENTE_A, asiste_a: AGENTE }, [
      ASISTENTE_A,
      ASISTENTE_B,
    ])
    expect(equipo.duenoCalendario).toBe(AGENTE)
    expect(new Set(equipo.equipoIds)).toEqual(new Set([AGENTE, ASISTENTE_A, ASISTENTE_B]))
  })

  it('un dueño o agente sin asistentes queda solo: comportamiento de antes', () => {
    const equipo = armarEquipoCalendario({ id: AGENTE, asiste_a: null }, [])
    expect(equipo.equipoIds).toEqual([AGENTE])
  })

  it('no repite ids', () => {
    const equipo = armarEquipoCalendario({ id: AGENTE, asiste_a: null }, [AGENTE, ASISTENTE_A, ASISTENTE_A])
    expect(equipo.equipoIds).toEqual([AGENTE, ASISTENTE_A])
  })

  it('si la lectura del equipo viene recortada, igual incluye al usuario y a su agente', () => {
    const equipo = armarEquipoCalendario({ id: ASISTENTE_B, asiste_a: AGENTE }, [])
    expect(new Set(equipo.equipoIds)).toEqual(new Set([AGENTE, ASISTENTE_B]))
  })
})

describe('asignadoDeAlta', () => {
  it('un asistente queda atribuido a su agente, ignorando lo que pidió', () => {
    const asistente = { id: ASISTENTE_A, asiste_a: AGENTE, rol: 'ASISTENTE' as const }
    expect(asignadoDeAlta(asistente, ASISTENTE_B)).toBe(AGENTE)
    expect(asignadoDeAlta(asistente)).toBe(AGENTE)
  })

  it('un agente o dueño respeta la elección y, sin ella, es para sí', () => {
    const agente = { id: AGENTE, asiste_a: null, rol: 'AGENTE' as const }
    const dueno = { id: AGENTE, asiste_a: null, rol: 'DUENO' as const }
    expect(asignadoDeAlta(agente, 'otro')).toBe('otro')
    expect(asignadoDeAlta(agente)).toBe(AGENTE)
    expect(asignadoDeAlta(dueno, null)).toBe(AGENTE)
  })
})

describe('esDelEquipo', () => {
  const equipoIds = [AGENTE, ASISTENTE_A, ASISTENTE_B]

  it('lo creó un asistente y está asignado al agente', () => {
    expect(esDelEquipo({ creado_por: ASISTENTE_A, asignado_a: AGENTE }, equipoIds)).toBe(true)
  })

  it('lo creó alguien de afuera pero está asignado a alguien del equipo', () => {
    expect(esDelEquipo({ creado_por: 'otro', asignado_a: ASISTENTE_B }, equipoIds)).toBe(true)
  })

  it('lo creó alguien del equipo y está asignado a un tercero', () => {
    expect(esDelEquipo({ creado_por: AGENTE, asignado_a: 'otro' }, equipoIds)).toBe(true)
  })

  it('es de otro equipo', () => {
    expect(esDelEquipo({ creado_por: 'otro', asignado_a: 'otro-2' }, equipoIds)).toBe(false)
  })
})

describe('claveDeEquipo', () => {
  it('no depende del orden de los ids', () => {
    const a = { duenoCalendario: AGENTE, equipoIds: [AGENTE, ASISTENTE_A, ASISTENTE_B] }
    const b = { duenoCalendario: AGENTE, equipoIds: [ASISTENTE_B, AGENTE, ASISTENTE_A] }
    expect(claveDeEquipo(a)).toBe(claveDeEquipo(b))
  })

  it('cambia cuando entra un asistente', () => {
    const antes = { duenoCalendario: AGENTE, equipoIds: [AGENTE] }
    const despues = { duenoCalendario: AGENTE, equipoIds: [AGENTE, ASISTENTE_A] }
    expect(claveDeEquipo(antes)).not.toBe(claveDeEquipo(despues))
  })
})
