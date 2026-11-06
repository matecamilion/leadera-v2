/**
 * Tests de resumenTexto.ts.
 *
 *   deno test supabase/functions/_shared/resumenTexto_test.ts
 */
import { assert, assertEquals } from 'jsr:@std/assert@1'
import { armarResumen, type ConteosDelDia, MAX_CUERPO, MAX_TITULO } from './resumenTexto.ts'

function conteos(parcial: Partial<ConteosDelDia>): ConteosDelDia {
  return { prioritarios: 0, nuevos: 0, seguimientos: 0, visitas_hoy: 0, ...parcial }
}

Deno.test('los cuatro ítems: los dos primeros van en el título y el resto en el cuerpo', () => {
  assertEquals(armarResumen(conteos({ visitas_hoy: 2, seguimientos: 1, prioritarios: 5, nuevos: 6 })), {
    title: 'Hoy: 2 visitas y 1 seguimiento',
    body: '5 prioritarios y 6 leads nuevos. Empezá por Mi día.',
  })
})

Deno.test('sin visitas ni seguimientos: prioritarios y nuevos van en el título', () => {
  assertEquals(armarResumen(conteos({ prioritarios: 5, nuevos: 6 })), {
    title: 'Hoy: 5 prioritarios y 6 leads nuevos',
    body: 'Empezá por Mi día.',
  })
})

Deno.test('un solo ítem', () => {
  assertEquals(armarResumen(conteos({ nuevos: 1 })), {
    title: 'Hoy: 1 lead nuevo',
    body: 'Empezá por Mi día.',
  })
})

Deno.test('tres ítems: el tercero va solo en el cuerpo', () => {
  assertEquals(armarResumen(conteos({ visitas_hoy: 1, prioritarios: 3, nuevos: 2 })), {
    title: 'Hoy: 1 visita y 3 prioritarios',
    body: '2 leads nuevos. Empezá por Mi día.',
  })
})

Deno.test('se saltea lo que está en cero y respeta el orden', () => {
  assertEquals(armarResumen(conteos({ seguimientos: 4, nuevos: 2 })), {
    title: 'Hoy: 4 seguimientos y 2 leads nuevos',
    body: 'Empezá por Mi día.',
  })
})

Deno.test('singular y plural de cada ítem', () => {
  const uno = armarResumen(conteos({ visitas_hoy: 1, seguimientos: 1, prioritarios: 1, nuevos: 1 }))
  assertEquals(uno, {
    title: 'Hoy: 1 visita y 1 seguimiento',
    body: '1 prioritario y 1 lead nuevo. Empezá por Mi día.',
  })
  const varios = armarResumen(conteos({ visitas_hoy: 2, seguimientos: 2, prioritarios: 2, nuevos: 2 }))
  assertEquals(varios, {
    title: 'Hoy: 2 visitas y 2 seguimientos',
    body: '2 prioritarios y 2 leads nuevos. Empezá por Mi día.',
  })
})

Deno.test('los cuatro en cero: no hay resumen', () => {
  assertEquals(armarResumen(conteos({})), null)
})

Deno.test('valores raros cuentan como 0', () => {
  const raros = {
    prioritarios: NaN,
    nuevos: -3,
    seguimientos: 1.5,
    visitas_hoy: Infinity,
  }
  assertEquals(armarResumen(raros), null)
  assertEquals(armarResumen({ ...raros, nuevos: 2 })?.title, 'Hoy: 2 leads nuevos')
  assertEquals(
    armarResumen({ prioritarios: '4', nuevos: null, seguimientos: undefined, visitas_hoy: 1 } as unknown as ConteosDelDia),
    { title: 'Hoy: 1 visita', body: 'Empezá por Mi día.' },
  )
})

Deno.test('valores grandes respetan los límites de largo', () => {
  const grande = armarResumen(conteos({ visitas_hoy: 99999, seguimientos: 99999, prioritarios: 99999, nuevos: 99999 }))!
  assert(grande.title.length <= MAX_TITULO, grande.title)
  assert(grande.body.length <= MAX_CUERPO, grande.body)
})

Deno.test('un número desmesurado se recorta con "…" sin cortar una palabra', () => {
  const enorme = Number.MAX_SAFE_INTEGER
  const r = armarResumen(conteos({ seguimientos: enorme, prioritarios: enorme, nuevos: enorme, visitas_hoy: enorme }))!
  assert(r.title.length <= MAX_TITULO, r.title)
  assert(r.body.length <= MAX_CUERPO, r.body)
  assert(r.title.endsWith('…'), r.title)
  // Cada palabra del título recortado existe entera en el texto original.
  const original = `Hoy: ${enorme} visitas y ${enorme} seguimientos`
  for (const palabra of r.title.replace('…', '').trim().split(' ')) {
    assert(original.split(' ').includes(palabra), `palabra cortada: ${palabra}`)
  }
})

Deno.test('sin emojis ni signos de apertura', () => {
  const r = armarResumen(conteos({ visitas_hoy: 2, seguimientos: 1, prioritarios: 5, nuevos: 6 }))!
  assert(!/[¡¿\p{Extended_Pictographic}]/u.test(`${r.title} ${r.body}`))
})
