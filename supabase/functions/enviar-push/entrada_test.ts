/**
 * Tests de entrada.ts.
 *
 *   deno test supabase/functions/enviar-push/entrada_test.ts
 */
import { assertEquals } from 'jsr:@std/assert@1'
import { leerEntrada } from './entrada.ts'

const U1 = '11111111-1111-4111-8111-111111111111'
const U2 = '22222222-2222-4222-8222-222222222222'
const PAYLOAD = { title: 'Seguimiento', body: 'Llamar a Juan', url: '/mi-dia' }

function leer(obj: unknown) {
  return leerEntrada(JSON.stringify(obj))
}

Deno.test('entrada mínima válida: ttl 3600 y dry_run false por defecto', () => {
  assertEquals(leer({ user_ids: [U1], payload: PAYLOAD }), {
    entrada: { user_ids: [U1], payload: PAYLOAD, ttl: 3600, dry_run: false },
  })
})

Deno.test('entrada completa válida', () => {
  assertEquals(leer({ user_ids: [U1, U2], payload: { ...PAYLOAD, tag: 'a' }, ttl: 60, dry_run: true }), {
    entrada: { user_ids: [U1, U2], payload: { ...PAYLOAD, tag: 'a' }, ttl: 60, dry_run: true },
  })
})

const INVALIDAS: [string, unknown][] = [
  ['clave desconocida', { user_ids: [U1], payload: PAYLOAD, dryrun: true }],
  ['user_ids vacío', { user_ids: [], payload: PAYLOAD }],
  ['sin user_ids', { payload: PAYLOAD }],
  ['user_ids no uuid', { user_ids: ['abc'], payload: PAYLOAD }],
  ['user_ids repetidos', { user_ids: [U1, U1.toUpperCase()], payload: PAYLOAD }],
  ['más de 200 user_ids', {
    user_ids: Array.from({ length: 201 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`),
    payload: PAYLOAD,
  }],
  ['sin payload', { user_ids: [U1] }],
  ['payload con url externa', { user_ids: [U1], payload: { ...PAYLOAD, url: '//evil.com' } }],
  ['ttl menor a 60', { user_ids: [U1], payload: PAYLOAD, ttl: 59 }],
  ['ttl mayor a 86400', { user_ids: [U1], payload: PAYLOAD, ttl: 86_401 }],
  ['ttl decimal', { user_ids: [U1], payload: PAYLOAD, ttl: 60.5 }],
  ['ttl texto', { user_ids: [U1], payload: PAYLOAD, ttl: '60' }],
  ['dry_run texto', { user_ids: [U1], payload: PAYLOAD, dry_run: 'true' }],
  ['arreglo', []],
  ['null', null],
]

for (const [nombre, entrada] of INVALIDAS) {
  Deno.test(`entrada inválida: ${nombre}`, () => {
    assertEquals('error' in leer(entrada), true)
  })
}

Deno.test('entrada inválida: cuerpo vacío o que no es JSON', () => {
  assertEquals('error' in leerEntrada(''), true)
  assertEquals('error' in leerEntrada('{no'), true)
})
