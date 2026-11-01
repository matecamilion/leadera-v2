/**
 * Tests de logica.ts: el orden de las operaciones y los caminos de editar y
 * borrar, con dobles de todo lo que toca la red o la base.
 *
 *   deno test --allow-env supabase/functions/google-calendar-sync/logica_test.ts
 */
import { assert, assertEquals, assertNotEquals } from 'jsr:@std/assert@1'
import type { AgenteCalendario, PerfilCalendario } from '../_shared/equipoCalendario.ts'
import {
  type DepsSync,
  type Entrada,
  type EventoGoogle,
  type FilaToken,
  type GoogleApi,
  type Registro,
  type ResultadoEditar,
  type ResultadoObtener,
  type Salida,
  ejecutarSync,
} from './logica.ts'

const INMO = 'inmo-1'

const AGENTE: AgenteCalendario = { id: 'agente-1', rol: 'AGENTE', activo: true, inmobiliaria_id: INMO }
const ASISTENTE: PerfilCalendario = {
  id: 'asist-1',
  rol: 'ASISTENTE',
  activo: true,
  asiste_a: 'agente-1',
  inmobiliaria_id: INMO,
}
const AGENTE_PERFIL: PerfilCalendario = {
  id: 'agente-1',
  rol: 'AGENTE',
  activo: true,
  asiste_a: null,
  inmobiliaria_id: INMO,
}

const TOKEN: FilaToken = {
  id: 'tok-1',
  access_token: 'acceso',
  refresh_token: 'refresh',
  token_expiry: null,
  google_calendar_id: null,
  conectado: true,
}

const REGISTRO: Registro = {
  tipo: 'tarea',
  titulo: 'Llamar a Pérez',
  descripcion: 'detalle',
  fecha: '2026-11-05',
  hora: '10:00:00',
  estadoVisible: null,
  google_event_id: 'ev-viejo',
}

const MARCA = { origen: 'leadera' }

interface Config {
  usuario?: PerfilCalendario | null
  agente?: AgenteCalendario | null
  token?: FilaToken | null
  acceso?: string | null
  registro?: Registro | null
  editar?: ResultadoEditar
  obtener?: ResultadoObtener
  crear?: string | null
  borrar?: boolean
}

/** Dobles que anotan cada llamada, en orden, para poder afirmar sobre el orden. */
function armar(config: Config = {}) {
  const llamadas: string[] = []
  const eventosCreados: EventoGoogle[] = []
  const eventosEditados: EventoGoogle[] = []
  const guardados: { id: string; eventId: string }[] = []
  const contextos: { inmobiliariaId: string; equipoIds: string[] }[] = []
  const tokensPedidos: string[] = []
  const logs: string[] = []

  const google: GoogleApi = {
    crear: (_cal, evento) => {
      llamadas.push('google.crear')
      eventosCreados.push(evento)
      return Promise.resolve('crear' in config ? config.crear! : 'ev-nuevo')
    },
    editar: (_cal, _id, evento) => {
      llamadas.push('google.editar')
      eventosEditados.push(evento)
      return Promise.resolve(config.editar ?? { estado: 'ok', id: 'ev-viejo' })
    },
    obtener: () => {
      llamadas.push('google.obtener')
      return Promise.resolve(config.obtener ?? { estado: 'ok', cancelado: false, marcado: true })
    },
    borrar: () => {
      llamadas.push('google.borrar')
      return Promise.resolve(config.borrar ?? true)
    },
  }

  const deps: DepsSync = {
    log: (m) => logs.push(m),
    leerPerfiles: () => {
      llamadas.push('leerPerfiles')
      return Promise.resolve({
        usuario: 'usuario' in config ? config.usuario! : ASISTENTE,
        agente: 'agente' in config ? config.agente! : AGENTE,
      })
    },
    leerAsistentesIds: () => {
      llamadas.push('leerAsistentesIds')
      return Promise.resolve(['asist-1', 'asist-2'])
    },
    leerToken: (dueno) => {
      llamadas.push('leerToken')
      tokensPedidos.push(dueno)
      return Promise.resolve('token' in config ? config.token! : TOKEN)
    },
    asegurarAccessToken: () => {
      llamadas.push('asegurarAccessToken')
      return Promise.resolve('acceso' in config ? config.acceso! : 'acceso-vigente')
    },
    leerRegistro: (_tipo, _id, contexto) => {
      llamadas.push('leerRegistro')
      contextos.push(contexto)
      return Promise.resolve('registro' in config ? config.registro! : REGISTRO)
    },
    guardarEventId: (_tipo, id, eventId) => {
      llamadas.push('guardarEventId')
      guardados.push({ id, eventId })
      return Promise.resolve()
    },
    google,
  }

  return { deps, llamadas, eventosCreados, eventosEditados, guardados, contextos, tokensPedidos, logs }
}

const EDITAR: Entrada = { tipo: 'tarea', accion: 'editar', registro_id: 'reg-1' }
const CREAR: Entrada = { tipo: 'tarea', accion: 'crear', registro_id: 'reg-1' }
const BORRAR: Entrada = {
  tipo: 'tarea',
  accion: 'borrar',
  registro_id: 'reg-1',
  google_event_id: 'ev-1',
}

function esError(salida: Salida, status: number, code: string) {
  assertEquals(salida.tipo, 'error')
  if (salida.tipo === 'error') {
    assertEquals(salida.status, status)
    assertEquals(salida.code, code)
  }
}

// ---------------------------------------------------------------------------
// Orden: un usuario inválido no llega a Google ni a google_calendar_tokens
// ---------------------------------------------------------------------------

const INVALIDOS: [string, Config][] = [
  ['asistente inactivo', { usuario: { ...ASISTENTE, activo: false } }],
  ['asistente sin asiste_a', { usuario: { ...ASISTENTE, asiste_a: null }, agente: null }],
  ['agente inactivo', { agente: { ...AGENTE, activo: false } }],
  ['agente inexistente', { agente: null }],
  ['agente de otra inmobiliaria', { agente: { ...AGENTE, inmobiliaria_id: 'inmo-2' } }],
  ['usuario sin perfil', { usuario: null, agente: null }],
]

for (const [nombre, config] of INVALIDOS) {
  for (const entrada of [CREAR, EDITAR, BORRAR]) {
    Deno.test(`403 sin tocar tokens ni Google: ${nombre} (${entrada.accion})`, async () => {
      const t = armar(config)
      const salida = await ejecutarSync(t.deps, ASISTENTE.id, entrada)

      esError(salida, 403, 'SIN_PERMISO')
      // Lo único que pasó fue leer el perfil: ni el equipo, ni el token, ni Google.
      assertEquals(t.llamadas, ['leerPerfiles'])
      assertEquals(t.logs.length, 1)
    })
  }
}

// ---------------------------------------------------------------------------
// Asistente válido: usa el token y el equipo del agente
// ---------------------------------------------------------------------------

Deno.test('asistente válido: busca el token del AGENTE y lee el registro con su equipo', async () => {
  const t = armar()
  const salida = await ejecutarSync(t.deps, ASISTENTE.id, EDITAR)

  assertEquals(salida.tipo, 'json')
  assertEquals(t.tokensPedidos, ['agente-1'])
  assertEquals(t.contextos, [
    { inmobiliariaId: INMO, equipoIds: ['agente-1', 'asist-1', 'asist-2'] },
  ])
  // La autorización va primero, el token después, Google al final.
  assertEquals(t.llamadas.slice(0, 3), ['leerPerfiles', 'leerToken', 'asegurarAccessToken'])
})

Deno.test('agente: opera su propio calendario y lee el equipo completo', async () => {
  const t = armar({ usuario: AGENTE_PERFIL, agente: null })
  await ejecutarSync(t.deps, AGENTE.id, EDITAR)

  assertEquals(t.tokensPedidos, ['agente-1'])
  assertEquals(t.contextos[0].equipoIds, ['agente-1', 'asist-1', 'asist-2'])
})

Deno.test('not_connected: el asistente recibe la indicación de que lo resuelve el agente', async () => {
  const t = armar({ token: null })
  const salida = await ejecutarSync(t.deps, ASISTENTE.id, EDITAR)

  assertEquals(salida, {
    tipo: 'json',
    status: 200,
    cuerpo: { synced: false, reason: 'not_connected', lo_resuelve_el_agente: true },
  })
  assert(!t.llamadas.some((l) => l.startsWith('google.')))
})

Deno.test('not_connected: el agente no recibe esa indicación', async () => {
  const t = armar({ usuario: AGENTE_PERFIL, agente: null, token: null })
  const salida = await ejecutarSync(t.deps, AGENTE.id, EDITAR)

  assertEquals(salida, {
    tipo: 'json',
    status: 200,
    cuerpo: { synced: false, reason: 'not_connected' },
  })
})

Deno.test('reauth_required: el asistente recibe la indicación de que lo resuelve el agente', async () => {
  const t = armar({ acceso: null })
  const salida = await ejecutarSync(t.deps, ASISTENTE.id, EDITAR)

  assertEquals(salida, {
    tipo: 'json',
    status: 200,
    cuerpo: { synced: false, reason: 'reauth_required', lo_resuelve_el_agente: true },
  })
})

Deno.test('desconectado en la fila del agente: tampoco se llama a Google', async () => {
  const t = armar({ token: { ...TOKEN, conectado: false } })
  const salida = await ejecutarSync(t.deps, ASISTENTE.id, EDITAR)

  assertEquals(salida.tipo, 'json')
  assert(!t.llamadas.includes('asegurarAccessToken'))
})

Deno.test('registro de otro equipo u otra inmobiliaria: 404 y no se llama a Google', async () => {
  const t = armar({ registro: null })
  const salida = await ejecutarSync(t.deps, ASISTENTE.id, EDITAR)

  esError(salida, 404, 'REGISTRO_NO_ENCONTRADO')
  assert(!t.llamadas.some((l) => l.startsWith('google.')))
})

// ---------------------------------------------------------------------------
// Crear y editar
// ---------------------------------------------------------------------------

Deno.test('crear: crea el evento y guarda el id', async () => {
  const t = armar({ registro: { ...REGISTRO, google_event_id: null } })
  const salida = await ejecutarSync(t.deps, ASISTENTE.id, CREAR)

  assertEquals(salida.tipo === 'json' && salida.cuerpo, { synced: true, google_event_id: 'ev-nuevo' })
  assertEquals(t.guardados, [{ id: 'reg-1', eventId: 'ev-nuevo' }])
})

Deno.test('editar una fila que nunca se sincronizó se trata como alta', async () => {
  const t = armar({ registro: { ...REGISTRO, google_event_id: null } })
  await ejecutarSync(t.deps, ASISTENTE.id, EDITAR)

  assert(t.llamadas.includes('google.crear'))
  assert(!t.llamadas.includes('google.editar'))
})

Deno.test('editar OK con el mismo id: no reescribe google_event_id', async () => {
  const t = armar({ editar: { estado: 'ok', id: 'ev-viejo' } })
  const salida = await ejecutarSync(t.deps, ASISTENTE.id, EDITAR)

  assertEquals(salida.tipo === 'json' && salida.cuerpo, { synced: true, google_event_id: 'ev-viejo' })
  assertEquals(t.guardados, [])
})

Deno.test('editar con evento inexistente (404/410): recrea con el mismo contenido y la marca', async () => {
  // 404 y 410 llegan acá ya traducidos a `no_existe` (ver googleApi_test.ts).
  const t = armar({ editar: { estado: 'no_existe' } })
  const salida = await ejecutarSync(t.deps, ASISTENTE.id, EDITAR)

  assertEquals(salida.tipo === 'json' && salida.cuerpo, { synced: true, google_event_id: 'ev-nuevo' })
  assertEquals(t.guardados, [{ id: 'reg-1', eventId: 'ev-nuevo' }])

  // Lo recreado es EXACTAMENTE lo que se intentó editar, marca incluida: así el
  // import no lo reimporta.
  assertEquals(t.eventosCreados.length, 1)
  assertEquals(t.eventosCreados[0], t.eventosEditados[0])
  assertEquals(t.eventosCreados[0].extendedProperties.private, MARCA)
  assertEquals(t.eventosCreados[0].summary, 'Llamar a Pérez')

  // Y queda registrado quién lo disparó, sin tokens.
  assert(t.logs.some((l) => l.includes('asist-1') && l.includes('ASISTENTE')))
})

Deno.test('editar con otro error: NO recrea y responde 502', async () => {
  const t = armar({ editar: { estado: 'error' } })
  const salida = await ejecutarSync(t.deps, ASISTENTE.id, EDITAR)

  esError(salida, 502, 'GOOGLE_API_ERROR')
  assert(!t.llamadas.includes('google.crear'))
  assertEquals(t.guardados, [])
})

Deno.test('recrear que también falla: 502 y no se guarda nada', async () => {
  const t = armar({ editar: { estado: 'no_existe' }, crear: null })
  const salida = await ejecutarSync(t.deps, ASISTENTE.id, EDITAR)

  esError(salida, 502, 'GOOGLE_API_ERROR')
  assertEquals(t.guardados, [])
})

Deno.test('la marca de origen va en el evento de un alta normal', async () => {
  const t = armar({ registro: { ...REGISTRO, google_event_id: null } })
  await ejecutarSync(t.deps, ASISTENTE.id, CREAR)

  assertEquals(t.eventosCreados[0].extendedProperties.private, MARCA)
})

// ---------------------------------------------------------------------------
// Borrar
// ---------------------------------------------------------------------------

Deno.test('borrar: el evento ya no existe en Google (404/410) cuenta como borrado', async () => {
  const t = armar({ obtener: { estado: 'no_existe' } })
  const salida = await ejecutarSync(t.deps, ASISTENTE.id, BORRAR)

  assertEquals(salida.tipo === 'json' && salida.cuerpo, { synced: true, google_event_id: null })
  assert(!t.llamadas.includes('google.borrar'))
})

Deno.test('borrar: un evento ya cancelado en Google cuenta como borrado', async () => {
  const t = armar({ obtener: { estado: 'ok', cancelado: true, marcado: false } })
  const salida = await ejecutarSync(t.deps, ASISTENTE.id, BORRAR)

  assertEquals(salida.tipo === 'json' && salida.cuerpo, { synced: true, google_event_id: null })
  assert(!t.llamadas.includes('google.borrar'))
})

Deno.test('borrar: sin la marca de LeadEra es 403 y NO se borra', async () => {
  const t = armar({ obtener: { estado: 'ok', cancelado: false, marcado: false } })
  const salida = await ejecutarSync(t.deps, ASISTENTE.id, BORRAR)

  esError(salida, 403, 'SIN_PERMISO')
  assert(!t.llamadas.includes('google.borrar'))
  assert(t.logs.some((l) => l.includes('asist-1')))
})

Deno.test('borrar: con la marca, lo borra', async () => {
  const t = armar({ obtener: { estado: 'ok', cancelado: false, marcado: true } })
  const salida = await ejecutarSync(t.deps, ASISTENTE.id, BORRAR)

  assertEquals(salida.tipo === 'json' && salida.cuerpo, { synced: true, google_event_id: null })
  assertEquals(t.llamadas.slice(-2), ['google.obtener', 'google.borrar'])
})

Deno.test('borrar: si Google falla al leer el evento, 502 y no se borra', async () => {
  const t = armar({ obtener: { estado: 'error' } })
  const salida = await ejecutarSync(t.deps, ASISTENTE.id, BORRAR)

  esError(salida, 502, 'GOOGLE_API_ERROR')
  assert(!t.llamadas.includes('google.borrar'))
})

Deno.test('borrar: si Google rechaza el DELETE, 502', async () => {
  const t = armar({ borrar: false })
  const salida = await ejecutarSync(t.deps, ASISTENTE.id, BORRAR)

  esError(salida, 502, 'GOOGLE_API_ERROR')
})

Deno.test('borrar sin google_event_id: no hay nada que borrar y no se llama a Google', async () => {
  const t = armar()
  const salida = await ejecutarSync(t.deps, ASISTENTE.id, { ...BORRAR, google_event_id: null })

  assertEquals(salida.tipo === 'json' && salida.cuerpo, { synced: false, reason: 'sin_evento' })
  assert(!t.llamadas.some((l) => l.startsWith('google.')))
})

Deno.test('borrar no necesita leer el registro (la fila ya no existe)', async () => {
  const t = armar()
  await ejecutarSync(t.deps, ASISTENTE.id, BORRAR)

  assert(!t.llamadas.includes('leerRegistro'))
  assertNotEquals(t.llamadas.indexOf('leerPerfiles'), -1)
})
