import { describe, expect, it } from 'vitest'
import {
  MARGEN_CONFLICTO_VISITAS_MIN,
  buscarConflictoVisita,
  describirVisita,
  tituloConflictoVisita,
  type VisitaParaConflicto,
} from './conflictoVisitas'

const DIA = '2026-11-10'

function visita(extra: Partial<VisitaParaConflicto> = {}): VisitaParaConflicto {
  return { id: 'v1', fecha: DIA, hora: '10:00:00', estado: 'AGENDADA', asignado_a: 'ana', ...extra }
}

const nueva = (hora: string | null | undefined, extra: object = {}) => ({
  fecha: DIA,
  hora,
  asignadoA: 'ana',
  ...extra,
})

describe('margen', () => {
  it('es de 30 minutos', () => {
    expect(MARGEN_CONFLICTO_VISITAS_MIN).toBe(30)
  })
})

describe('buscarConflictoVisita — distancia', () => {
  const existentes = [visita()]

  it('la misma hora exacta es conflicto', () => {
    expect(buscarConflictoVisita(nueva('10:00'), existentes)).toBe(existentes[0])
  })

  it('29 minutos después y antes conflictan', () => {
    expect(buscarConflictoVisita(nueva('10:29'), existentes)).toBe(existentes[0])
    expect(buscarConflictoVisita(nueva('09:31'), existentes)).toBe(existentes[0])
  })

  it('30 minutos justos, hacia los dos lados, no conflictan', () => {
    expect(buscarConflictoVisita(nueva('10:30'), existentes)).toBeNull()
    expect(buscarConflictoVisita(nueva('09:30'), existentes)).toBeNull()
  })

  it('mezcla HH:MM con HH:MM:SS y no cuenta los segundos', () => {
    expect(buscarConflictoVisita(nueva('10:15:45'), [visita({ hora: '10:00' })])).not.toBeNull()
    expect(buscarConflictoVisita(nueva('10:30:00'), [visita({ hora: '10:00:59' })])).toBeNull()
  })
})

describe('buscarConflictoVisita — qué cuenta', () => {
  it('otro día no conflicta', () => {
    expect(buscarConflictoVisita(nueva('10:00'), [visita({ fecha: '2026-11-11' })])).toBeNull()
  })

  it('otra persona asignada no conflicta (el agente y su asistente comparten hora)', () => {
    expect(buscarConflictoVisita(nueva('10:00'), [visita({ asignado_a: 'beto' })])).toBeNull()
  })

  it('REALIZADA y CANCELADA se ignoran', () => {
    expect(buscarConflictoVisita(nueva('10:00'), [visita({ estado: 'REALIZADA' })])).toBeNull()
    expect(buscarConflictoVisita(nueva('10:00'), [visita({ estado: 'CANCELADA' })])).toBeNull()
  })

  it('una visita existente sin hora no conflicta', () => {
    expect(buscarConflictoVisita(nueva('10:00'), [visita({ hora: null })])).toBeNull()
  })

  it('una visita nueva sin hora no conflicta con nada', () => {
    expect(buscarConflictoVisita(nueva(null), [visita()])).toBeNull()
    expect(buscarConflictoVisita(nueva(''), [visita()])).toBeNull()
    expect(buscarConflictoVisita(nueva(undefined), [visita()])).toBeNull()
  })

  it('al editar, la visita no choca consigo misma', () => {
    expect(buscarConflictoVisita(nueva('10:00', { excluirId: 'v1' }), [visita()])).toBeNull()
  })

  it('al editar, sí choca con otra distinta', () => {
    const otra = visita({ id: 'v2', hora: '10:10' })
    expect(buscarConflictoVisita(nueva('10:00', { excluirId: 'v1' }), [visita(), otra])).toBe(otra)
  })

  it('sin visitas no hay conflicto', () => {
    expect(buscarConflictoVisita(nueva('10:00'), [])).toBeNull()
  })
})

describe('buscarConflictoVisita — varias', () => {
  it('devuelve la más cercana a la hora nueva', () => {
    const lejos = visita({ id: 'lejos', hora: '10:00' })
    const cerca = visita({ id: 'cerca', hora: '10:20' })
    expect(buscarConflictoVisita(nueva('10:25'), [lejos, cerca])).toBe(cerca)
    expect(buscarConflictoVisita(nueva('10:25'), [cerca, lejos])).toBe(cerca)
  })

  it('ante igual cercanía, la más temprana', () => {
    const antes = visita({ id: 'antes', hora: '09:50' })
    const despues = visita({ id: 'despues', hora: '10:10' })
    expect(buscarConflictoVisita(nueva('10:00'), [despues, antes])).toBe(antes)
  })

  it('ignora las que no cuentan aunque estén más cerca', () => {
    const cancelada = visita({ id: 'c', hora: '10:00', estado: 'CANCELADA' })
    const valida = visita({ id: 'v', hora: '10:25' })
    expect(buscarConflictoVisita(nueva('10:00'), [cancelada, valida])).toBe(valida)
  })
})

describe('textos', () => {
  const base = {
    hora: '10:15:00',
    titulo_externo: null,
    propiedad: { direccion: 'Güemes 2450' },
    lead: { nombre: 'Ana', apellido: 'Pérez' },
  }

  it('describe la visita con hora, lugar y lead', () => {
    expect(describirVisita(base)).toBe('10:15 · Güemes 2450 · con Ana Pérez')
  })

  it('una externa muestra su título y sin lead no nombra a nadie', () => {
    expect(
      describirVisita({ ...base, propiedad: null, titulo_externo: 'Alvear 3355', lead: null }),
    ).toBe('10:15 · Alvear 3355')
  })

  it('apellido vacío no deja un espacio de más', () => {
    expect(describirVisita({ ...base, lead: { nombre: 'Ana', apellido: null } })).toBe(
      '10:15 · Güemes 2450 · con Ana',
    )
  })

  it('el título es "Se superpone…" cuando agenda la propia persona', () => {
    expect(tituloConflictoVisita({ esUnoMismo: true })).toBe('Se superpone con otra visita')
  })

  it('nombra a la persona asignada cuando agenda otro', () => {
    expect(tituloConflictoVisita({ esUnoMismo: false, nombre: 'Beto Gómez' })).toBe(
      'Beto Gómez ya tiene una visita cerca',
    )
  })

  it('sin el nombre a mano, "La persona asignada"', () => {
    expect(tituloConflictoVisita({ esUnoMismo: false })).toBe('La persona asignada ya tiene una visita cerca')
    expect(tituloConflictoVisita({ esUnoMismo: false, nombre: '  ' })).toMatch(/^La persona asignada/)
  })
})
