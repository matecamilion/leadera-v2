/**
 * Tests de pushValidacion.ts.
 *
 *   deno test supabase/functions/_shared/pushValidacion_test.ts
 */
import { assertEquals } from 'jsr:@std/assert@1'
import { clasificarRespuesta, validarEndpoint, validarPayload } from './pushValidacion.ts'

// --- validarEndpoint ---------------------------------------------------------

const ENDPOINTS_VALIDOS: [string, string][] = [
  ['https://fcm.googleapis.com/fcm/send/abc', 'fcm.googleapis.com'],
  ['https://web.push.apple.com/abc', 'web.push.apple.com'],
  ['https://wns2-xxx.notify.windows.com/w/?token=abc', 'wns2-xxx.notify.windows.com'],
  ['https://updates.push.services.mozilla.com/wpush/v2/abc', 'updates.push.services.mozilla.com'],
  ['https://fcm.googleapis.com:443/fcm/send/abc', 'fcm.googleapis.com'],
  ['https://FCM.GoogleAPIs.com/fcm/send/abc', 'fcm.googleapis.com'],
  ['https://A.B.push.apple.com/x', 'a.b.push.apple.com'],
]

for (const [endpoint, host] of ENDPOINTS_VALIDOS) {
  Deno.test(`validarEndpoint: pasa ${endpoint}`, () => {
    assertEquals(validarEndpoint(endpoint), { ok: true, host })
  })
}

const ENDPOINTS_INVALIDOS: [string, string][] = [
  ['http://fcm.googleapis.com/x', 'http'],
  ['https://example.com/x', 'otro host'],
  ['https://fcm.googleapis.com.evil.com/x', 'host exacto con sufijo ajeno'],
  ['https://evil.com\\.push.apple.com/x', 'barra invertida'],
  ['https://.push.apple.com/x', 'sufijo sin etiqueta delante'],
  ['https://push.apple.com/x', 'dominio pelado'],
  ['https://a..push.apple.com/x', 'etiqueta vacía'],
  ['https://x.push.apple.com.evil.com/x', 'sufijo con dominio ajeno después'],
  ['https://fcm.googleapis.com:8443/x', 'puerto 8443'],
  ['https://user@fcm.googleapis.com/x', 'usuario'],
  ['https://user:clave@fcm.googleapis.com/x', 'usuario y clave'],
  ['https://fcm.googleapis.com@evil.com/x', 'host real es evil.com'],
  ['https://fcm.googleapis.com./x', 'punto final'],
  ['no es una url', 'URL inválida'],
  ['', 'vacío'],
  [`https://fcm.googleapis.com/${'a'.repeat(2048)}`, 'más de 2048 caracteres'],
]

for (const [endpoint, motivo] of ENDPOINTS_INVALIDOS) {
  Deno.test(`validarEndpoint: NO pasa (${motivo})`, () => {
    assertEquals(validarEndpoint(endpoint).ok, false)
  })
}

Deno.test('validarEndpoint: el largo exacto de 2048 caracteres todavía pasa', () => {
  const base = 'https://fcm.googleapis.com/'
  assertEquals(validarEndpoint(base + 'a'.repeat(2048 - base.length)).ok, true)
})

Deno.test('validarEndpoint: el motivo no incluye el endpoint', () => {
  const r = validarEndpoint('https://secreto.example.com/token-privado')
  assertEquals(r.ok, false)
  if (!r.ok) assertEquals(r.motivo.includes('secreto'), false)
})

// --- validarPayload ----------------------------------------------------------

const VALIDO = { title: 'Seguimiento', body: 'Llamar a Juan hoy', url: '/mi-dia' }

Deno.test('validarPayload: válido sin tag', () => {
  assertEquals(validarPayload(VALIDO), { ok: true, payload: VALIDO })
})

Deno.test('validarPayload: válido con tag', () => {
  const entrada = { ...VALIDO, tag: 'seguimiento:abc_1-2' }
  assertEquals(validarPayload(entrada), { ok: true, payload: entrada })
})

const PAYLOADS_INVALIDOS: [unknown, string][] = [
  [{ ...VALIDO, url: '//evil.com' }, 'url con //'],
  [{ ...VALIDO, url: '/\\evil.com' }, 'url con /\\'],
  [{ ...VALIDO, url: 'https://evil.com' }, 'url absoluta'],
  [{ ...VALIDO, url: 'mi-dia' }, 'url sin barra inicial'],
  [{ ...VALIDO, url: '/mi-dia\n' }, 'url con carácter de control'],
  [{ ...VALIDO, url: '/' + 'a'.repeat(300) }, 'url de más de 300'],
  [{ ...VALIDO, extra: 1 }, 'clave extra'],
  [{ ...VALIDO, title: '' }, 'título vacío'],
  [{ ...VALIDO, title: 'a'.repeat(101) }, 'título de más de 100'],
  [{ ...VALIDO, body: '' }, 'body vacío'],
  [{ ...VALIDO, body: 'a'.repeat(301) }, 'body de más de 300'],
  [{ ...VALIDO, tag: '' }, 'tag vacío'],
  [{ ...VALIDO, tag: 'con espacio' }, 'tag con caracteres inválidos'],
  [{ ...VALIDO, tag: 'a'.repeat(65) }, 'tag de más de 64'],
  [{ title: 'x', body: 'y' }, 'falta url'],
  [{ ...VALIDO, title: 123 }, 'título no es texto'],
  [null, 'null'],
  [[], 'arreglo'],
  ['texto', 'texto'],
]

for (const [entrada, motivo] of PAYLOADS_INVALIDOS) {
  Deno.test(`validarPayload: NO pasa (${motivo})`, () => {
    assertEquals(validarPayload(entrada).ok, false)
  })
}

Deno.test('validarPayload: más de 2000 bytes en UTF-8 no pasa aunque los largos individuales sí', () => {
  // Cada campo respeta su máximo de caracteres, pero "€" son 3 bytes en UTF-8:
  // 100 + 300 + 300 caracteres ≈ 2100 bytes.
  const entrada = { title: '€'.repeat(100), body: '€'.repeat(300), url: '/' + '€'.repeat(299) }
  const r = validarPayload(entrada)
  assertEquals(r.ok, false)
  if (!r.ok) assertEquals(r.motivo.includes('2000 bytes'), true)
})

Deno.test('validarPayload: justo por debajo de 2000 bytes pasa', () => {
  const entrada = { title: 'a'.repeat(100), body: 'b'.repeat(300), url: '/' + 'c'.repeat(299) }
  assertEquals(validarPayload(entrada).ok, true)
})

// --- clasificarRespuesta -----------------------------------------------------

const CLASES: [number, string][] = [
  [200, 'ok'],
  [201, 'ok'],
  [202, 'ok'],
  [404, 'eliminar'],
  [410, 'eliminar'],
  [429, 'reintentable'],
  [500, 'reintentable'],
  [503, 'reintentable'],
  [400, 'error'],
  [401, 'error'],
  [403, 'error'],
  [413, 'error'],
  [302, 'error'],
  [204, 'error'],
]

for (const [status, clase] of CLASES) {
  Deno.test(`clasificarRespuesta: ${status} → ${clase}`, () => {
    assertEquals(clasificarRespuesta(status), clase)
  })
}
