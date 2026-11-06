/**
 * Tests de decisiones.ts.
 *
 *   deno test supabase/functions/resumen-diario/decisiones_test.ts
 */
import { assertEquals } from 'jsr:@std/assert@1'
import { decidirReclamo, interpretarRespuestaPush, RECLAMO_VENCIDO_MS, type RespuestaPush } from './decisiones.ts'

const AHORA = Date.parse('2026-11-06T12:05:00Z')
const haceMs = (ms: number) => new Date(AHORA - ms).toISOString()

Deno.test('decidirReclamo: ENVIADO y OMITIDO se saltean', () => {
  assertEquals(decidirReclamo({ estado: 'ENVIADO', actualizado_at: haceMs(10 * 60 * 60_000) }, AHORA), 'saltar')
  assertEquals(decidirReclamo({ estado: 'OMITIDO', actualizado_at: haceMs(10 * 60 * 60_000) }, AHORA), 'saltar')
})

Deno.test('decidirReclamo: ENVIANDO reciente se saltea, vencida se retoma', () => {
  assertEquals(decidirReclamo({ estado: 'ENVIANDO', actualizado_at: haceMs(60_000) }, AHORA), 'saltar')
  assertEquals(
    decidirReclamo({ estado: 'ENVIANDO', actualizado_at: haceMs(RECLAMO_VENCIDO_MS - 1) }, AHORA),
    'saltar',
  )
  assertEquals(decidirReclamo({ estado: 'ENVIANDO', actualizado_at: haceMs(RECLAMO_VENCIDO_MS) }, AHORA), 'retomar')
  assertEquals(decidirReclamo({ estado: 'ENVIANDO', actualizado_at: haceMs(60 * 60_000) }, AHORA), 'retomar')
})

Deno.test('decidirReclamo: ERROR se reintenta aunque sea reciente', () => {
  assertEquals(decidirReclamo({ estado: 'ERROR', actualizado_at: haceMs(1000) }, AHORA), 'retomar')
})

const base: RespuestaPush = {
  destinatarios: 1,
  suscripciones: 2,
  enviadas: 0,
  simuladas: 0,
  eliminadas: 0,
  rechazadas: 0,
  reintentables: 0,
}

Deno.test('interpretarRespuestaPush: llegó a algún dispositivo es ENVIADO', () => {
  assertEquals(interpretarRespuestaPush({ ...base, enviadas: 1, reintentables: 1 }, false), {
    estado: 'ENVIADO',
    dispositivos: 2,
    enviados: 1,
  })
})

Deno.test('interpretarRespuestaPush: en dry_run cuentan las simuladas', () => {
  assertEquals(interpretarRespuestaPush({ ...base, simuladas: 2 }, true), {
    estado: 'ENVIADO',
    dispositivos: 2,
    enviados: 2,
  })
  assertEquals(interpretarRespuestaPush({ ...base, enviadas: 2 }, true).estado, 'ERROR')
})

Deno.test('interpretarRespuestaPush: sin destinatarios o sin dispositivos es OMITIDO', () => {
  assertEquals(interpretarRespuestaPush({ ...base, destinatarios: 0, suscripciones: 0 }, false).estado, 'OMITIDO')
  assertEquals(interpretarRespuestaPush({ ...base, suscripciones: 0 }, false).estado, 'OMITIDO')
})

Deno.test('interpretarRespuestaPush: todos los dispositivos dados de baja es OMITIDO', () => {
  assertEquals(interpretarRespuestaPush({ ...base, eliminadas: 2 }, false).estado, 'OMITIDO')
})

Deno.test('interpretarRespuestaPush: hay dispositivos y no llegó a ninguno es ERROR', () => {
  const r = interpretarRespuestaPush({ ...base, reintentables: 2 }, false)
  assertEquals(r.estado, 'ERROR')
  assertEquals(r.dispositivos, 2)
  const parcial = interpretarRespuestaPush({ ...base, eliminadas: 1, reintentables: 1 }, false)
  assertEquals(parcial.estado, 'ERROR')
})
