/**
 * Tests de permisosGoogle.ts.
 *
 *   deno test --allow-env supabase/functions/_shared/permisosGoogle_test.ts
 */
import { assertEquals } from 'jsr:@std/assert@1'
import { esAsistente, puedeConectarGoogle } from './permisosGoogle.ts'

Deno.test('puedeConectarGoogle: dueño y agente sí', () => {
  assertEquals(puedeConectarGoogle('DUENO'), true)
  assertEquals(puedeConectarGoogle('AGENTE'), true)
})

Deno.test('puedeConectarGoogle: el asistente no', () => {
  assertEquals(puedeConectarGoogle('ASISTENTE'), false)
})

Deno.test('puedeConectarGoogle: sin perfil o con un rol desconocido, falla cerrado', () => {
  assertEquals(puedeConectarGoogle(null), false)
  assertEquals(puedeConectarGoogle(undefined), false)
  assertEquals(puedeConectarGoogle(''), false)
  assertEquals(puedeConectarGoogle('SUPERADMIN'), false)
  assertEquals(puedeConectarGoogle('asistente'), false)
})

Deno.test('esAsistente: solo el rol ASISTENTE', () => {
  assertEquals(esAsistente('ASISTENTE'), true)
  assertEquals(esAsistente('AGENTE'), false)
  assertEquals(esAsistente('DUENO'), false)
})

Deno.test('esAsistente: sin perfil NO es asistente (la importación sigue su camino de error)', () => {
  assertEquals(esAsistente(null), false)
  assertEquals(esAsistente(undefined), false)
})
