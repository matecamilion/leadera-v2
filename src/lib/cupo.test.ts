import { describe, expect, it } from 'vitest'
import {
  evaluarCupo,
  type MiembroCupo,
  type TopesCupo,
} from '../../supabase/functions/_shared/cupo.ts'

const BAUTISTA = 'bautista'

const PLAN_SOLO: TopesCupo = { limiteUsuarios: 3, maxAgentes: 1, maxAsistentesPorAgente: 2 }

const bautista: MiembroCupo = { rol: 'DUENO', asiste_a: null, activo: true }
const manuela: MiembroCupo = { rol: 'ASISTENTE', asiste_a: BAUTISTA, activo: true }
const leandro = (activo: boolean): MiembroCupo => ({
  rol: 'ASISTENTE',
  asiste_a: BAUTISTA,
  activo,
})

const nuevoAsistente = { rol: 'ASISTENTE', asisteA: BAUTISTA } as const

describe('evaluarCupo: los inactivos no ocupan lugar', () => {
  it('con Leandro inactivo, entra un asistente más del dueño', () => {
    const r = evaluarCupo([bautista, leandro(false), manuela], PLAN_SOLO, 3, nuevoAsistente)
    expect(r).toMatchObject({ ok: true, usados: 2, limite: 3 })
  })

  it('con los tres activos, otro asistente se rechaza por el tope de asistentes', () => {
    const r = evaluarCupo([bautista, leandro(true), manuela], PLAN_SOLO, 3, nuevoAsistente)
    expect(r).toMatchObject({ ok: false, usados: 3, motivo: 'TOPE_ASISTENTES', tope: 2 })
  })

  it('reactivar a Leandro cuando ya hay un tercer activo se rechaza', () => {
    // Leandro sigue inactivo en la lista: no cuenta, y se pregunta si entra
    // uno más con su rol y su asiste_a. Ya hay tres activos.
    const otro: MiembroCupo = { rol: 'ASISTENTE', asiste_a: BAUTISTA, activo: true }
    const r = evaluarCupo([bautista, manuela, otro, leandro(false)], PLAN_SOLO, 3, nuevoAsistente)
    expect(r.ok).toBe(false)
    expect(r.motivo).toBe('TOPE_ASISTENTES')
  })

  it('reactivar a Leandro con lugar libre se permite', () => {
    const r = evaluarCupo([bautista, manuela, leandro(false)], PLAN_SOLO, 3, nuevoAsistente)
    expect(r.ok).toBe(true)
  })

  it('el techo total también se cuenta sólo entre activos', () => {
    const plan: TopesCupo = { limiteUsuarios: 3, maxAgentes: null, maxAsistentesPorAgente: null }
    const lleno = [bautista, manuela, leandro(true)]
    expect(evaluarCupo(lleno, plan, 3, nuevoAsistente)).toMatchObject({
      ok: false,
      motivo: 'TECHO_TOTAL',
      tope: 3,
    })
    const conInactivo = [bautista, manuela, leandro(false)]
    expect(evaluarCupo(conInactivo, plan, 3, nuevoAsistente).ok).toBe(true)
  })

  it('un AGENTE inactivo no cuenta para max_agentes', () => {
    const plan: TopesCupo = { limiteUsuarios: 15, maxAgentes: 2, maxAsistentesPorAgente: 2 }
    const agenteInactivo: MiembroCupo = { rol: 'AGENTE', asiste_a: null, activo: false }
    const agenteActivo: MiembroCupo = { rol: 'AGENTE', asiste_a: null, activo: true }

    expect(evaluarCupo([bautista, agenteInactivo], plan, 15, { rol: 'AGENTE' }).ok).toBe(true)
    expect(evaluarCupo([bautista, agenteActivo], plan, 15, { rol: 'AGENTE' })).toMatchObject({
      ok: false,
      motivo: 'TOPE_AGENTES',
      tope: 2,
    })
  })

  it('un asistente sin agente se rechaza aunque el plan no tenga topes', () => {
    const sinTopes: TopesCupo = { limiteUsuarios: null, maxAgentes: null, maxAsistentesPorAgente: null }
    const r = evaluarCupo([bautista], sinTopes, null, { rol: 'ASISTENTE', asisteA: null })
    expect(r).toMatchObject({ ok: false, motivo: 'SIN_AGENTE' })
  })

  it('sin plan se usa el límite de la inmobiliaria sobre los activos', () => {
    expect(evaluarCupo([bautista, leandro(false), manuela], null, 3, nuevoAsistente).ok).toBe(true)
    expect(evaluarCupo([bautista, leandro(true), manuela], null, 3, nuevoAsistente)).toMatchObject({
      ok: false,
      motivo: 'TECHO_TOTAL',
    })
  })
})
