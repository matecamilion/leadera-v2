/**
 * Tests de perfiles.ts: la lectura de perfil/agente en dos consultas simples.
 *
 *   deno test --allow-env supabase/functions/google-calendar-sync/perfiles_test.ts
 */
import { assert, assertEquals, assertRejects } from 'jsr:@std/assert@1'
import type { PerfilCalendario } from '../_shared/equipoCalendario.ts'
import { type DepsSync, ejecutarSync } from './logica.ts'
import { type ConsultaPerfil, ErrorLecturaPerfil, leerPerfilesDe } from './perfiles.ts'

const INMO = 'inmo-1'

const agente: PerfilCalendario = { id: 'agente-1', rol: 'AGENTE', activo: true, asiste_a: null, inmobiliaria_id: INMO }
const dueno: PerfilCalendario = { ...agente, id: 'dueno-1', rol: 'DUENO' }
const asistente: PerfilCalendario = { ...agente, id: 'asist-1', rol: 'ASISTENTE', asiste_a: 'agente-1' }

/**
 * Una consulta simulada con la forma de `.eq('id', id).maybeSingle()`: la fila
 * como OBJETO (no una lista) o null si no existe.
 */
function tabla(filas: PerfilCalendario[]): { consultar: ConsultaPerfil; ids: string[] } {
  const ids: string[] = []
  return {
    ids,
    consultar: (id) => {
      ids.push(id)
      return Promise.resolve({ data: filas.find((f) => f.id === id) ?? null, error: null })
    },
  }
}

/** Deps que cortan en `leerToken` (null = no conectado): si llegan ahí, el usuario ya se autorizó. */
function depsHastaToken(consultar: ConsultaPerfil): { deps: DepsSync; tokensLeidos: string[] } {
  const tokensLeidos: string[] = []
  const deps = {
    leerPerfiles: (userId: string) => leerPerfilesDe(consultar, userId),
    leerToken: (dueno: string) => {
      tokensLeidos.push(dueno)
      return Promise.resolve(null)
    },
    log: () => {},
  } as unknown as DepsSync
  return { deps, tokensLeidos }
}

const ENTRADA = { tipo: 'visita', accion: 'crear', registro_id: 'v-1' } as const

// --- forma de los datos ------------------------------------------------------

Deno.test('un AGENTE sin asiste_a se autoriza: una sola consulta y el agente es null', async () => {
  const t = tabla([agente])
  assertEquals(await leerPerfilesDe(t.consultar, 'agente-1'), { usuario: agente, agente: null })
  assertEquals(t.ids, ['agente-1'])

  const { deps, tokensLeidos } = depsHastaToken(t.consultar)
  const salida = await ejecutarSync(deps, 'agente-1', ENTRADA)
  // Autorizado: llegó a leer el token de su propio calendario.
  assertEquals(tokensLeidos, ['agente-1'])
  assertEquals(salida, { tipo: 'json', status: 200, cuerpo: { synced: false, reason: 'not_connected' } })
})

Deno.test('un DUENO sin asiste_a se autoriza sobre su propio calendario', async () => {
  const t = tabla([dueno])
  const { deps, tokensLeidos } = depsHastaToken(t.consultar)
  const salida = await ejecutarSync(deps, 'dueno-1', ENTRADA)
  assertEquals(tokensLeidos, ['dueno-1'])
  assertEquals(salida.tipo, 'json')
})

Deno.test('un ASISTENTE válido: dos consultas por id y el calendario es el de su agente', async () => {
  const t = tabla([asistente, agente])
  const { usuario, agente: elAgente } = await leerPerfilesDe(t.consultar, 'asist-1')
  assertEquals(t.ids, ['asist-1', 'agente-1'])
  assertEquals(usuario, asistente)
  assertEquals(elAgente, agente)

  const { deps, tokensLeidos } = depsHastaToken(t.consultar)
  const salida = await ejecutarSync(deps, 'asist-1', ENTRADA)
  assertEquals(tokensLeidos, ['agente-1'])
  assertEquals(salida, {
    tipo: 'json',
    status: 200,
    cuerpo: { synced: false, reason: 'not_connected', lo_resuelve_el_agente: true },
  })
})

// --- rechazos por permiso: 403, no 500 ------------------------------------------

Deno.test('rechazos por permiso son 403 y no llegan al token', async () => {
  const casos: [string, PerfilCalendario[], string][] = [
    ['sin perfil', [], 'nadie'],
    ['asistente sin asiste_a', [{ ...asistente, asiste_a: null }], 'asist-1'],
    ['agente inexistente', [asistente], 'asist-1'],
    ['asistente inactivo', [{ ...asistente, activo: false }, agente], 'asist-1'],
  ]
  for (const [nombre, filas, quien] of casos) {
    const t = tabla(filas)
    const { deps, tokensLeidos } = depsHastaToken(t.consultar)
    const salida = await ejecutarSync(deps, quien, ENTRADA)
    assertEquals(salida.tipo === 'error' && salida.status, 403, nombre)
    assertEquals(tokensLeidos, [], nombre)
  }
})

Deno.test('un asistente sin asiste_a no dispara la segunda consulta', async () => {
  const t = tabla([{ ...asistente, asiste_a: null }])
  await leerPerfilesDe(t.consultar, 'asist-1')
  assertEquals(t.ids, ['asist-1'])
})

// --- errores de base: nunca se confunden con un rechazo ---------------------------

Deno.test('un error de base al leer el perfil lanza ErrorLecturaPerfil con el mensaje y el código', async () => {
  const consultar: ConsultaPerfil = () =>
    Promise.resolve({ data: null, error: { code: 'PGRST301', message: 'JWT expired' } })
  const err = await assertRejects(() => leerPerfilesDe(consultar, 'agente-1'), ErrorLecturaPerfil)
  assert(err.message.includes('perfil del usuario'))
  assert(err.message.includes('PGRST301'))
  assert(err.message.includes('JWT expired'))
})

Deno.test('un error de base al leer el perfil del agente también lanza, no da 403', async () => {
  const consultar: ConsultaPerfil = (id) =>
    id === 'asist-1'
      ? Promise.resolve({ data: asistente, error: null })
      : Promise.resolve({ data: null, error: { message: 'connection reset' } })
  const err = await assertRejects(() => leerPerfilesDe(consultar, 'asist-1'), ErrorLecturaPerfil)
  assert(err.message.includes('perfil del agente'))
})

Deno.test('ejecutarSync deja pasar el error de base: no lo convierte en un 403', async () => {
  const consultar: ConsultaPerfil = () => Promise.resolve({ data: null, error: { message: 'timeout' } })
  const { deps, tokensLeidos } = depsHastaToken(consultar)
  await assertRejects(() => ejecutarSync(deps, 'agente-1', ENTRADA), ErrorLecturaPerfil)
  assertEquals(tokensLeidos, [])
})

Deno.test('una lista en lugar de una fila es un error, no un "sin perfil"', async () => {
  const consultar: ConsultaPerfil = () => Promise.resolve({ data: [agente], error: null })
  await assertRejects(() => leerPerfilesDe(consultar, 'agente-1'), ErrorLecturaPerfil)
})
