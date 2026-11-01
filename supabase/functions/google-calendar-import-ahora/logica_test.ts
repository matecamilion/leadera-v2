/**
 *   deno test --allow-env supabase/functions/google-calendar-import-ahora/
 */
import { assert, assertEquals } from 'jsr:@std/assert@1'
import type { PerfilCalendario } from '../_shared/equipoCalendario.ts'
import type { Resumen } from '../google-calendar-import/importar.ts'
import {
  type CuentaLeida,
  type DepsImportAhora,
  ejecutarImportAhora,
  enEnfriamiento,
  ENFRIAMIENTO_MS,
  resultadoPublico,
} from './logica.ts'

const INMO = 'inmo-1'
const AHORA = Date.parse('2026-11-02T12:00:00Z')

const agente: PerfilCalendario = { id: 'agente-1', rol: 'AGENTE', activo: true, asiste_a: null, inmobiliaria_id: INMO }
const dueno: PerfilCalendario = { ...agente, id: 'dueno-1', rol: 'DUENO' }
const asistente: PerfilCalendario = { ...agente, id: 'asist-1', rol: 'ASISTENTE', asiste_a: 'agente-1' }

function cuenta(sobre: Partial<CuentaLeida> = {}): CuentaLeida {
  return {
    id: 'fila-1',
    agente_id: 'agente-1',
    access_token: 'SECRETO-ACCESS',
    refresh_token: 'SECRETO-REFRESH',
    token_expiry: null,
    google_calendar_id: 'primary',
    sync_token: 'SECRETO-SYNC',
    importacion_activa: true,
    importacion_fallos_seguidos: 0,
    importacion_ultima_at: null,
    conectado: true,
    ...sobre,
  }
}

function resumen(sobre: Partial<Resumen> = {}): Resumen {
  return {
    agente_id: 'agente-1',
    modo: 'incremental',
    leidos: 5,
    visitas: 1,
    tareas: 2,
    tareas_posible_visita: 1,
    salteados: { pasado: 1 },
    resultado: 'ok',
    ...sobre,
  }
}

interface Armado {
  deps: DepsImportAhora
  lecturasPerfil: string[]
  cuentasLeidas: string[]
  importadas: unknown[]
}

function armar(opciones: {
  perfiles?: PerfilCalendario[]
  cuenta?: CuentaLeida | null
  resumen?: Resumen
}): Armado {
  const lecturasPerfil: string[] = []
  const cuentasLeidas: string[] = []
  const importadas: unknown[] = []
  const perfiles = opciones.perfiles ?? []
  return {
    lecturasPerfil,
    cuentasLeidas,
    importadas,
    deps: {
      leerPerfil: (id) => {
        lecturasPerfil.push(id)
        return Promise.resolve(perfiles.find((p) => p.id === id) ?? null)
      },
      leerCuenta: (id) => {
        cuentasLeidas.push(id)
        return Promise.resolve(opciones.cuenta === undefined ? cuenta() : opciones.cuenta)
      },
      importar: (c) => {
        importadas.push(c)
        return Promise.resolve(opciones.resumen ?? resumen())
      },
      ahora: () => AHORA,
    },
  }
}

/** Silencia los logs mientras corre `fn`. */
async function mudo<T>(fn: () => Promise<T>): Promise<T> {
  const log = console.log
  const warn = console.warn
  console.log = () => {}
  console.warn = () => {}
  try {
    return await fn()
  } finally {
    console.log = log
    console.warn = warn
  }
}

function resultadoDe(r: { cuerpo: unknown }): string {
  return (r.cuerpo as { resultado: string }).resultado
}

// --- enfriamiento ----------------------------------------------------------

Deno.test('enfriamiento: dentro y fuera de la ventana', () => {
  const hace = (ms: number) => new Date(AHORA - ms).toISOString()
  assertEquals(enEnfriamiento(hace(1_000), AHORA), true)
  assertEquals(enEnfriamiento(hace(ENFRIAMIENTO_MS - 1), AHORA), true)
  assertEquals(enEnfriamiento(hace(ENFRIAMIENTO_MS), AHORA), false)
  assertEquals(enEnfriamiento(hace(60_000), AHORA), false)
})

Deno.test('enfriamiento: sin marca, marca rota o marca en el futuro se importa', () => {
  assertEquals(enEnfriamiento(null, AHORA), false)
  assertEquals(enEnfriamiento('no-es-una-fecha', AHORA), false)
  assertEquals(enEnfriamiento(new Date(AHORA + 5_000).toISOString(), AHORA), false)
})

// --- resolución de cuenta ---------------------------------------------------

Deno.test('agente: importa su propia cuenta, con una sola lectura de perfil', async () => {
  const a = armar({ perfiles: [agente] })
  const r = await mudo(() => ejecutarImportAhora(a.deps, 'agente-1'))
  assertEquals(r.status, 200)
  assertEquals(a.lecturasPerfil, ['agente-1'])
  assertEquals(a.cuentasLeidas, ['agente-1'])
  assertEquals(a.importadas.length, 1)
})

Deno.test('dueño: importa su propia cuenta', async () => {
  const a = armar({ perfiles: [dueno], cuenta: cuenta({ agente_id: 'dueno-1' }) })
  await mudo(() => ejecutarImportAhora(a.deps, 'dueno-1'))
  assertEquals(a.cuentasLeidas, ['dueno-1'])
  assertEquals(a.importadas.length, 1)
})

Deno.test('asistente válido: dos lecturas simples y la cuenta es la de su agente', async () => {
  const a = armar({ perfiles: [asistente, agente] })
  const r = await mudo(() => ejecutarImportAhora(a.deps, 'asist-1'))
  assertEquals(r.status, 200)
  assertEquals(a.lecturasPerfil, ['asist-1', 'agente-1'])
  assertEquals(a.cuentasLeidas, ['agente-1'])
  assertEquals(a.importadas.length, 1)
})

Deno.test('403 sin tocar la cuenta ni Google: todos los asistentes inválidos', async () => {
  const casos: [string, PerfilCalendario[], string][] = [
    ['sin perfil', [], 'nadie'],
    ['asistente inactivo', [{ ...asistente, activo: false }, agente], 'asist-1'],
    ['asistente sin agente', [{ ...asistente, asiste_a: null }], 'asist-1'],
    ['agente inexistente', [asistente], 'asist-1'],
    ['agente inactivo', [asistente, { ...agente, activo: false }], 'asist-1'],
    ['agente que es asistente', [asistente, { ...agente, rol: 'ASISTENTE' }], 'asist-1'],
    ['otra inmobiliaria', [asistente, { ...agente, inmobiliaria_id: 'inmo-2' }], 'asist-1'],
  ]
  for (const [nombre, perfiles, quien] of casos) {
    const a = armar({ perfiles })
    const r = await mudo(() => ejecutarImportAhora(a.deps, quien))
    assertEquals(r.status, 403, nombre)
    assertEquals(a.cuentasLeidas, [], `${nombre}: no se leyó ninguna cuenta`)
    assertEquals(a.importadas, [], `${nombre}: no se llamó a Google`)
  }
})

// --- estados sin error -------------------------------------------------------

Deno.test('cuenta inexistente o desconectada: no_conectado, sin importar', async () => {
  for (const c of [null, cuenta({ conectado: false })]) {
    const a = armar({ perfiles: [agente], cuenta: c })
    const r = await mudo(() => ejecutarImportAhora(a.deps, 'agente-1'))
    assertEquals(r.status, 200)
    assertEquals(resultadoDe(r), 'no_conectado')
    assertEquals(a.importadas, [])
  }
})

Deno.test('importación apagada: importacion_no_activada, sin importar', async () => {
  const a = armar({ perfiles: [agente], cuenta: cuenta({ importacion_activa: false }) })
  const r = await mudo(() => ejecutarImportAhora(a.deps, 'agente-1'))
  assertEquals(resultadoDe(r), 'importacion_no_activada')
  assertEquals(a.importadas, [])
})

Deno.test('dentro del enfriamiento: ya_actualizado, sin llamar a Google', async () => {
  const reciente = new Date(AHORA - 3_000).toISOString()
  const a = armar({ perfiles: [agente], cuenta: cuenta({ importacion_ultima_at: reciente }) })
  const r = await mudo(() => ejecutarImportAhora(a.deps, 'agente-1'))
  assertEquals(r.status, 200)
  assertEquals(resultadoDe(r), 'ya_actualizado')
  assertEquals(a.importadas, [])
})

Deno.test('pasado el enfriamiento se importa', async () => {
  const vieja = new Date(AHORA - 60_000).toISOString()
  const a = armar({ perfiles: [agente], cuenta: cuenta({ importacion_ultima_at: vieja }) })
  await mudo(() => ejecutarImportAhora(a.deps, 'agente-1'))
  assertEquals(a.importadas.length, 1)
})

// --- respuesta -----------------------------------------------------------------

Deno.test('la respuesta lleva solo cantidades: sin tokens, ids ni mensajes internos', async () => {
  const a = armar({
    perfiles: [agente],
    resumen: resumen({ resultado: 'error', error: 'Base: 23502 detalle interno' }),
  })
  const r = await mudo(() => ejecutarImportAhora(a.deps, 'agente-1'))
  const texto = JSON.stringify(r.cuerpo)
  assertEquals(Object.keys(r.cuerpo).sort(), [
    'leidos',
    'resultado',
    'salteados',
    'tareas',
    'tareas_posible_visita',
    'visitas',
  ])
  for (const prohibido of ['SECRETO', 'agente-1', 'detalle interno', 'sync_token']) {
    assert(!texto.includes(prohibido), `no debe incluir ${prohibido}`)
  }
  assertEquals(resultadoDe(r), 'error')
})

Deno.test('resultado ok trae las cantidades del resumen', async () => {
  const a = armar({ perfiles: [agente] })
  const r = await mudo(() => ejecutarImportAhora(a.deps, 'agente-1'))
  assertEquals(r.cuerpo, {
    resultado: 'ok',
    leidos: 5,
    tareas: 2,
    visitas: 1,
    tareas_posible_visita: 1,
    salteados: { pasado: 1 },
  })
})

Deno.test('resultadoPublico: transitorios se reintentan, el resto se informa', () => {
  assertEquals(resultadoPublico('ok'), 'ok')
  assertEquals(resultadoPublico('reautorizar'), 'reautorizar')
  assertEquals(resultadoPublico('sync_token_vencido'), 'reintentar')
  assertEquals(resultadoPublico('error_transitorio'), 'reintentar')
  assertEquals(resultadoPublico('error'), 'error')
})

Deno.test('los logs registran quién dispara y su rol, sin tokens', async () => {
  const mensajes: string[] = []
  const log = console.log
  console.log = (...a: unknown[]) => mensajes.push(a.map(String).join(' '))
  try {
    const a = armar({ perfiles: [asistente, agente] })
    await ejecutarImportAhora(a.deps, 'asist-1')
  } finally {
    console.log = log
  }
  const todo = mensajes.join('\n')
  assert(todo.includes('asist-1') && todo.includes('ASISTENTE'))
  assert(!todo.includes('SECRETO'))
})
