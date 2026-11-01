/**
 * La puerta HTTP: un JWT anónimo o inválido nunca llega a la importación.
 *
 *   deno test --allow-env supabase/functions/google-calendar-import-ahora/
 */
import { assert, assertEquals } from 'jsr:@std/assert@1'
import type { PerfilCalendario } from '../_shared/equipoCalendario.ts'
import { crearHandler, type DepsHandler } from './handler.ts'

const agente: PerfilCalendario = {
  id: 'agente-1',
  rol: 'AGENTE',
  activo: true,
  asiste_a: null,
  inmobiliaria_id: 'inmo-1',
}

interface Espias {
  importadas: number
  perfilesLeidos: number
  cuentasLeidas: number
}

function armar(usuarioDeToken: DepsHandler['usuarioDeToken'], perfil: PerfilCalendario | null = agente) {
  const espias: Espias = { importadas: 0, perfilesLeidos: 0, cuentasLeidas: 0 }
  const handler = crearHandler({
    usuarioDeToken,
    leerPerfil: () => {
      espias.perfilesLeidos++
      return Promise.resolve(perfil)
    },
    leerCuenta: () => {
      espias.cuentasLeidas++
      return Promise.resolve({
        id: 'f',
        agente_id: 'agente-1',
        access_token: 'a',
        refresh_token: 'r',
        token_expiry: null,
        google_calendar_id: 'primary',
        sync_token: null,
        importacion_activa: true,
        importacion_fallos_seguidos: 0,
        importacion_ultima_at: null,
        conectado: true,
      })
    },
    importar: () => {
      espias.importadas++
      return Promise.resolve({
        agente_id: 'agente-1',
        modo: 'completo' as const,
        leidos: 0,
        visitas: 0,
        tareas: 0,
        tareas_posible_visita: 0,
        salteados: {},
        resultado: 'ok' as const,
      })
    },
    ahora: () => Date.now(),
  })
  return { handler, espias }
}

function pedido(headers: Record<string, string> = {}, metodo = 'POST'): Request {
  return new Request('http://x/google-calendar-import-ahora', {
    method: metodo,
    headers,
    body: metodo === 'POST' ? '{}' : undefined,
  })
}

async function mudo<T>(fn: () => Promise<T>): Promise<T> {
  const log = console.log
  const warn = console.warn
  const err = console.error
  console.log = console.warn = console.error = () => {}
  try {
    return await fn()
  } finally {
    console.log = log
    console.warn = warn
    console.error = err
  }
}

const NADA = { importadas: 0, perfilesLeidos: 0, cuentasLeidas: 0 }

Deno.test('sin Authorization: 401 y no se toca nada', async () => {
  const { handler, espias } = armar(() => Promise.resolve({ id: 'agente-1' }))
  const r = await handler(pedido())
  assertEquals(r.status, 401)
  assertEquals(espias, NADA)
})

Deno.test('JWT anónimo o inválido (getUser no devuelve usuario): 401 y nunca importa', async () => {
  for (const token of ['anon-key-jwt', 'basura', 'vencido']) {
    const { handler, espias } = armar(() => Promise.resolve(null))
    const r = await handler(pedido({ Authorization: `Bearer ${token}` }))
    assertEquals(r.status, 401, token)
    assertEquals(espias, NADA, token)
  }
})

Deno.test('si getUser falla, es un error genérico y nunca importa', async () => {
  const { handler, espias } = armar(() => Promise.reject(new Error('detalle interno')))
  const r = await mudo(() => handler(pedido({ Authorization: 'Bearer x' })))
  assertEquals(r.status, 500)
  assertEquals(espias.importadas, 0)
  assert(!(await r.text()).includes('detalle interno'))
})

Deno.test('asistente inválido: 403 sin llamar a Google', async () => {
  const sinAgente: PerfilCalendario = { ...agente, id: 'asist-1', rol: 'ASISTENTE', asiste_a: null }
  const { handler, espias } = armar(() => Promise.resolve({ id: 'asist-1' }), sinAgente)
  const r = await mudo(() => handler(pedido({ Authorization: 'Bearer ok' })))
  assertEquals(r.status, 403)
  assertEquals(espias.importadas, 0)
  assertEquals(espias.cuentasLeidas, 0)
})

Deno.test('usuario válido: importa, y el body no cambia la cuenta', async () => {
  const { handler, espias } = armar(() => Promise.resolve({ id: 'agente-1' }))
  const req = new Request('http://x/', {
    method: 'POST',
    headers: { Authorization: 'Bearer ok' },
    body: JSON.stringify({ agente_id: 'otro-agente' }),
  })
  const r = await mudo(() => handler(req))
  assertEquals(r.status, 200)
  assertEquals(espias.importadas, 1)
})

Deno.test('método distinto de POST: 405', async () => {
  const { handler, espias } = armar(() => Promise.resolve({ id: 'agente-1' }))
  const r = await handler(pedido({ Authorization: 'Bearer ok' }, 'GET'))
  assertEquals(r.status, 405)
  assertEquals(espias.importadas, 0)
})
