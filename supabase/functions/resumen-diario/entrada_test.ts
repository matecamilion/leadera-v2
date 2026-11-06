/**
 * Tests de entrada.ts.
 *
 *   deno test supabase/functions/resumen-diario/entrada_test.ts
 */
import { assertEquals } from 'jsr:@std/assert@1'
import { leerEntrada } from './entrada.ts'

const U1 = '11111111-1111-4111-8111-111111111111'

Deno.test('cuerpo vacío o {} es la corrida real', () => {
  assertEquals(leerEntrada(''), { entrada: {} })
  assertEquals(leerEntrada('  \n'), { entrada: {} })
  assertEquals(leerEntrada('{}'), { entrada: {} })
})

Deno.test('entradas válidas', () => {
  assertEquals(leerEntrada('{"dry_run":true}'), { entrada: { dry_run: true } })
  assertEquals(leerEntrada(JSON.stringify({ destinatario: U1 })), { entrada: { destinatario: U1 } })
  assertEquals(leerEntrada('{"dry_run":true,"hoy":"2026-11-06"}'), {
    entrada: { dry_run: true, hoy: '2026-11-06' },
  })
  assertEquals(leerEntrada(JSON.stringify({ dry_run: false, destinatario: U1 })), {
    entrada: { dry_run: false, destinatario: U1 },
  })
})

const INVALIDAS: [string, string][] = [
  ['clave desconocida', '{"dryrun":true}'],
  ['dry_run texto', '{"dry_run":"true"}'],
  ['dry_run número', '{"dry_run":1}'],
  ['hoy con formato inválido', '{"dry_run":true,"hoy":"06/11/2026"}'],
  ['hoy que no existe', '{"dry_run":true,"hoy":"2026-02-30"}'],
  ['hoy que no es texto', '{"dry_run":true,"hoy":20261106}'],
  ['hoy sin dry_run', '{"hoy":"2026-11-06"}'],
  ['hoy con dry_run false', '{"dry_run":false,"hoy":"2026-11-06"}'],
  ['destinatario que no es uuid', '{"destinatario":"juan@mail.com"}'],
  ['destinatario que no es texto', '{"destinatario":5}'],
  ['arreglo', '[]'],
  ['null', 'null'],
  ['JSON roto', '{"dry_run":'],
]

for (const [nombre, cuerpo] of INVALIDAS) {
  Deno.test(`entrada inválida: ${nombre}`, () => {
    assertEquals('error' in leerEntrada(cuerpo), true)
  })
}
