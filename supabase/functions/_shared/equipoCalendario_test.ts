/**
 * Tests de equipoCalendario.ts.
 *
 *   deno test --allow-env supabase/functions/_shared/equipoCalendario_test.ts
 */
import { assertEquals } from 'jsr:@std/assert@1'
import {
  type AgenteCalendario,
  armarEquipoIds,
  type PerfilCalendario,
  perteneceAlEquipo,
  resolverDuenoCalendario,
} from './equipoCalendario.ts'

const INMO = 'inmo-1'

const agente: AgenteCalendario = { id: 'agente-1', rol: 'AGENTE', activo: true, inmobiliaria_id: INMO }
const asistente: PerfilCalendario = {
  id: 'asist-1',
  rol: 'ASISTENTE',
  activo: true,
  asiste_a: 'agente-1',
  inmobiliaria_id: INMO,
}

Deno.test('un asistente válido opera el calendario de su agente', () => {
  assertEquals(resolverDuenoCalendario(asistente, agente), {
    ok: true,
    duenoCalendario: 'agente-1',
  })
})

Deno.test('un agente opera su propio calendario, aunque no tenga agente asociado', () => {
  const comoAgente: PerfilCalendario = { ...asistente, id: 'agente-1', rol: 'AGENTE', asiste_a: null }
  assertEquals(resolverDuenoCalendario(comoAgente, null), { ok: true, duenoCalendario: 'agente-1' })
})

Deno.test('un dueño que hace de agente opera su propio calendario', () => {
  const dueno: PerfilCalendario = { ...asistente, id: 'dueno-1', rol: 'DUENO', asiste_a: null }
  assertEquals(resolverDuenoCalendario(dueno, null), { ok: true, duenoCalendario: 'dueno-1' })
})

Deno.test('403: asistente inactivo', () => {
  assertEquals(resolverDuenoCalendario({ ...asistente, activo: false }, agente), {
    ok: false,
    motivo: 'asistente_inactivo',
  })
})

Deno.test('403: asistente sin asiste_a', () => {
  assertEquals(resolverDuenoCalendario({ ...asistente, asiste_a: null }, null), {
    ok: false,
    motivo: 'asistente_sin_agente',
  })
  // Aunque venga un agente "colgado", sin asiste_a no se opera nada.
  assertEquals(resolverDuenoCalendario({ ...asistente, asiste_a: null }, agente), {
    ok: false,
    motivo: 'asistente_sin_agente',
  })
})

Deno.test('403: el agente no existe', () => {
  assertEquals(resolverDuenoCalendario(asistente, null), {
    ok: false,
    motivo: 'agente_inexistente',
  })
})

Deno.test('403: el agente que vino no es al que asiste', () => {
  assertEquals(resolverDuenoCalendario(asistente, { ...agente, id: 'otro-agente' }), {
    ok: false,
    motivo: 'agente_inexistente',
  })
})

Deno.test('403: agente inactivo', () => {
  assertEquals(resolverDuenoCalendario(asistente, { ...agente, activo: false }), {
    ok: false,
    motivo: 'agente_inactivo',
  })
})

Deno.test('403: agente de otra inmobiliaria', () => {
  assertEquals(resolverDuenoCalendario(asistente, { ...agente, inmobiliaria_id: 'inmo-2' }), {
    ok: false,
    motivo: 'otra_inmobiliaria',
  })
})

Deno.test('403: el "agente" es a su vez un asistente', () => {
  assertEquals(resolverDuenoCalendario(asistente, { ...agente, rol: 'ASISTENTE' }), {
    ok: false,
    motivo: 'agente_es_asistente',
  })
})

Deno.test('403: sin perfil', () => {
  assertEquals(resolverDuenoCalendario(null, null), { ok: false, motivo: 'perfil_inexistente' })
})

Deno.test('armarEquipoIds: el dueño primero y sin repetidos', () => {
  assertEquals(armarEquipoIds('agente-1', ['asist-1', 'asist-2', 'asist-1', 'agente-1']), [
    'agente-1',
    'asist-1',
    'asist-2',
  ])
  assertEquals(armarEquipoIds('agente-1', []), ['agente-1'])
})

Deno.test('perteneceAlEquipo: la creó o la tiene asignada alguien del equipo', () => {
  const equipo = ['agente-1', 'asist-1', 'asist-2']
  assertEquals(perteneceAlEquipo({ creado_por: 'asist-1', asignado_a: 'agente-1' }, equipo), true)
  assertEquals(perteneceAlEquipo({ creado_por: 'otro', asignado_a: 'asist-2' }, equipo), true)
  assertEquals(perteneceAlEquipo({ creado_por: 'agente-1', asignado_a: 'otro' }, equipo), true)
  assertEquals(perteneceAlEquipo({ creado_por: 'otro', asignado_a: 'otro-2' }, equipo), false)
})
