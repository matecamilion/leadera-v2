/**
 * Tests de googleApi.ts: cómo se traducen los estados HTTP de Google, con un
 * `fetch` simulado (no hay red).
 *
 *   deno test --allow-env supabase/functions/google-calendar-sync/googleApi_test.ts
 */
import { assert, assertEquals } from 'jsr:@std/assert@1'
import { googleReal } from './googleApi.ts'
import type { EventoGoogle } from './logica.ts'

const EVENTO: EventoGoogle = {
  summary: 'x',
  start: { date: '2026-11-05' },
  end: { date: '2026-11-06' },
  extendedProperties: { private: { origen: 'leadera' } },
}

/** Reemplaza `fetch` por una respuesta fija mientras corre `fn`. */
async function conFetch<T>(
  respuesta: { status: number; cuerpo?: unknown } | 'caida',
  fn: (llamadas: { url: string; metodo: string }[]) => Promise<T>,
): Promise<T> {
  const original = globalThis.fetch
  const llamadas: { url: string; metodo: string }[] = []
  // Los tests de error esperan el console.error del código; se silencia.
  const errorOriginal = console.error
  console.error = () => {}

  globalThis.fetch = ((url: string | URL | Request, init?: RequestInit) => {
    llamadas.push({ url: String(url), metodo: init?.method ?? 'GET' })
    if (respuesta === 'caida') return Promise.reject(new Error('sin red'))
    return Promise.resolve(
      new Response(respuesta.cuerpo === undefined ? null : JSON.stringify(respuesta.cuerpo), {
        status: respuesta.status,
      }),
    )
  }) as typeof fetch

  try {
    return await fn(llamadas)
  } finally {
    globalThis.fetch = original
    console.error = errorOriginal
  }
}

// --- editar ----------------------------------------------------------------

Deno.test('editar: 404 es no_existe', async () => {
  await conFetch({ status: 404 }, async () => {
    assertEquals(await googleReal.editar('primary', 'ev', EVENTO, 'a'), { estado: 'no_existe' })
  })
})

Deno.test('editar: 410 es no_existe', async () => {
  await conFetch({ status: 410 }, async () => {
    assertEquals(await googleReal.editar('primary', 'ev', EVENTO, 'a'), { estado: 'no_existe' })
  })
})

Deno.test('editar: cualquier otro error NO es no_existe (no se recrea)', async () => {
  for (const status of [400, 401, 403, 429, 500, 503]) {
    await conFetch({ status }, async () => {
      assertEquals(await googleReal.editar('primary', 'ev', EVENTO, 'a'), { estado: 'error' })
    })
  }
})

Deno.test('editar: sin red es error, no no_existe', async () => {
  await conFetch('caida', async () => {
    assertEquals(await googleReal.editar('primary', 'ev', EVENTO, 'a'), { estado: 'error' })
  })
})

Deno.test('editar: 200 devuelve el id', async () => {
  await conFetch({ status: 200, cuerpo: { id: 'ev-2' } }, async (llamadas) => {
    assertEquals(await googleReal.editar('primary', 'ev', EVENTO, 'a'), { estado: 'ok', id: 'ev-2' })
    assertEquals(llamadas[0].metodo, 'PATCH')
  })
})

// --- obtener ---------------------------------------------------------------

Deno.test('obtener: 404 y 410 son no_existe', async () => {
  for (const status of [404, 410]) {
    await conFetch({ status }, async () => {
      assertEquals(await googleReal.obtener('primary', 'ev', 'a'), { estado: 'no_existe' })
    })
  }
})

Deno.test('obtener: otros errores son error', async () => {
  for (const status of [401, 403, 500]) {
    await conFetch({ status }, async () => {
      assertEquals(await googleReal.obtener('primary', 'ev', 'a'), { estado: 'error' })
    })
  }
})

Deno.test('obtener: con la marca de LeadEra', async () => {
  const cuerpo = { id: 'ev', status: 'confirmed', extendedProperties: { private: { origen: 'leadera' } } }
  await conFetch({ status: 200, cuerpo }, async (llamadas) => {
    assertEquals(await googleReal.obtener('primary', 'ev', 'a'), {
      estado: 'ok',
      cancelado: false,
      marcado: true,
    })
    // Pide solo los campos que decide, no el evento entero.
    assert(llamadas[0].url.includes('fields=id,status,extendedProperties'))
  })
})

Deno.test('obtener: sin la marca, o con otra marca', async () => {
  for (const cuerpo of [
    { id: 'ev', status: 'confirmed' },
    { id: 'ev', status: 'confirmed', extendedProperties: { private: { origen: 'otra-app' } } },
    { id: 'ev', status: 'confirmed', extendedProperties: { private: {} } },
  ]) {
    await conFetch({ status: 200, cuerpo }, async () => {
      assertEquals(await googleReal.obtener('primary', 'ev', 'a'), {
        estado: 'ok',
        cancelado: false,
        marcado: false,
      })
    })
  }
})

Deno.test('obtener: un evento cancelado se reconoce', async () => {
  await conFetch({ status: 200, cuerpo: { id: 'ev', status: 'cancelled' } }, async () => {
    assertEquals(await googleReal.obtener('primary', 'ev', 'a'), {
      estado: 'ok',
      cancelado: true,
      marcado: false,
    })
  })
})

// --- borrar ----------------------------------------------------------------

Deno.test('borrar: 204, 404 y 410 son éxito', async () => {
  for (const status of [204, 404, 410]) {
    await conFetch({ status }, async () => {
      assertEquals(await googleReal.borrar('primary', 'ev', 'a'), true)
    })
  }
})

Deno.test('borrar: otros errores son fallo', async () => {
  for (const status of [401, 403, 500]) {
    await conFetch({ status }, async () => {
      assertEquals(await googleReal.borrar('primary', 'ev', 'a'), false)
    })
  }
})

// --- crear -----------------------------------------------------------------

Deno.test('crear: devuelve el id; un error devuelve null', async () => {
  await conFetch({ status: 200, cuerpo: { id: 'ev-9' } }, async () => {
    assertEquals(await googleReal.crear('primary', EVENTO, 'a'), 'ev-9')
  })
  await conFetch({ status: 500 }, async () => {
    assertEquals(await googleReal.crear('primary', EVENTO, 'a'), null)
  })
})

// --- logs ------------------------------------------------------------------

Deno.test('los logs de error no incluyen el cuerpo de la respuesta de Google', async () => {
  const original = globalThis.fetch
  const errorOriginal = console.error
  const mensajes: string[] = []
  console.error = (...args: unknown[]) => mensajes.push(args.map(String).join(' '))
  globalThis.fetch = (() =>
    Promise.resolve(new Response('SECRETO-DE-LA-AGENDA', { status: 500 }))) as typeof fetch

  try {
    await googleReal.editar('primary', 'ev', EVENTO, 'a')
    await googleReal.obtener('primary', 'ev', 'a')
    await googleReal.borrar('primary', 'ev', 'a')
    await googleReal.crear('primary', EVENTO, 'a')
  } finally {
    globalThis.fetch = original
    console.error = errorOriginal
  }

  assert(mensajes.length >= 4)
  assert(mensajes.every((m) => !m.includes('SECRETO-DE-LA-AGENDA')))
  assert(mensajes.every((m) => m.includes('500')))
})
