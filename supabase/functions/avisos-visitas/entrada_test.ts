/**
 * Tests de entrada.ts.
 *
 *   deno test supabase/functions/avisos-visitas/entrada_test.ts
 */
import { assert, assertEquals } from 'jsr:@std/assert@1'
import { leerEntrada } from './entrada.ts'

Deno.test('cuerpo vacío o {} es la corrida real', () => {
  assertEquals(leerEntrada(''), { entrada: {} })
  assertEquals(leerEntrada('{}'), { entrada: {} })
})

Deno.test('entradas válidas', () => {
  assertEquals(leerEntrada('{"dry_run":true}'), { entrada: { dry_run: true } })
  assertEquals(leerEntrada('{"dry_run":true,"ahora":"2026-11-08T15:00:00-03:00"}'), {
    entrada: { dry_run: true, ahora: '2026-11-08T15:00:00-03:00' },
  })
  assertEquals(leerEntrada('{"dry_run":true,"ahora":"2026-11-08T18:00:00Z"}'), {
    entrada: { dry_run: true, ahora: '2026-11-08T18:00:00Z' },
  })
})

Deno.test('rechaza lo mal escrito', () => {
  const invalidos = [
    '[]',
    '{',
    '{"dryrun":true}',
    '{"dry_run":"true"}',
    '{"dry_run":true,"ahora":"mañana"}',
    '{"dry_run":true,"ahora":"2026-11-08T15:00:00"}',
    '{"dry_run":true,"ahora":"2026-13-45T15:00:00Z"}',
    '{"ahora":"2026-11-08T15:00:00-03:00"}',
    '{"dry_run":false,"ahora":"2026-11-08T15:00:00-03:00"}',
  ]
  for (const cuerpo of invalidos) assert('error' in leerEntrada(cuerpo), cuerpo)
})
