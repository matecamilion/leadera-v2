/**
 * Tests de logica.ts (todo con datos inventados).
 *
 *   deno test --allow-env supabase/functions/verificar-duplicados-importacion/logica_test.ts
 */
import { assert, assertEquals } from 'jsr:@std/assert@1'
import { type FilaAVerificar, type LeadExistente, verificarDuplicados } from './logica.ts'

const fila = (n: number, telefono: string | null, email: string | null = null): FilaAVerificar => ({
  fila: n,
  telefono,
  email,
})
const lead = (telefono: string | null, email: string | null = null): LeadExistente => ({
  telefono,
  email,
})
const duplicadoDe = (filas: FilaAVerificar[], existentes: LeadExistente[]) =>
  verificarDuplicados(filas, existentes).map((r) => r.duplicado)

Deno.test('mismo teléfono en formatos distintos', () => {
  const existentes = [lead('223 555-0101'), lead('+54 9 223 555-0102')]
  assertEquals(
    duplicadoDe(
      [fila(2, '2235550101'), fila(3, '0223 15 555-0102'), fila(4, '223 555-0103')],
      existentes,
    ),
    ['telefono', 'telefono', null],
  )
})

Deno.test('"9 11 4555-0104" y "114 555-0104" son el mismo teléfono', () => {
  assertEquals(duplicadoDe([fila(2, '9 11 4555-0104')], [lead('114 555-0104')]), ['telefono'])
  assertEquals(duplicadoDe([fila(2, '114 555-0104')], [lead('9 11 4555-0104')]), ['telefono'])
})

Deno.test('email con mayúsculas y espacios', () => {
  assertEquals(
    duplicadoDe([fila(2, null, '  ANA@Ejemplo.com ')], [lead(null, 'ana@ejemplo.com')]),
    ['email'],
  )
  assertEquals(
    duplicadoDe([fila(2, null, 'ana@ejemplo.com')], [lead(null, 'Ana@EJEMPLO.com')]),
    ['email'],
  )
})

Deno.test('el teléfono tiene prioridad sobre el email', () => {
  const existentes = [lead('223 555-0101', 'ana@ejemplo.com')]
  assertEquals(duplicadoDe([fila(2, '2235550101', 'ana@ejemplo.com')], existentes), ['telefono'])
  // Con el teléfono distinto, cae al email.
  assertEquals(duplicadoDe([fila(2, '2235550199', 'ana@ejemplo.com')], existentes), ['email'])
})

Deno.test('un teléfono dudoso no matchea, ni siquiera consigo mismo', () => {
  const existentes = [lead('+1 310 555 0108'), lead('223 555-012'), lead('9 223 555-010')]
  assertEquals(
    duplicadoDe(
      [fila(2, '+1 310 555 0108'), fila(3, '223 555-012'), fila(4, '9 223 555-010')],
      existentes,
    ),
    [null, null, null],
  )
})

Deno.test('un teléfono dudoso no impide matchear por email', () => {
  assertEquals(
    duplicadoDe([fila(2, '+1 310 555 0108', 'ana@ejemplo.com')], [lead('+1 310 555 0108', 'ana@ejemplo.com')]),
    ['email'],
  )
})

Deno.test('filas y leads vacíos no se comparan', () => {
  const existentes = [lead(null, null), lead('', ''), lead('   ', '   ')]
  assertEquals(
    duplicadoDe([fila(2, null, null), fila(3, '', ''), fila(4, '  ', '  ')], existentes),
    [null, null, null],
  )
})

Deno.test('sin leads existentes ninguna es duplicada', () => {
  assertEquals(duplicadoDe([fila(2, '2235550101', 'a@b.co')], []), [null])
})

Deno.test('sin filas devuelve una lista vacía', () => {
  assertEquals(verificarDuplicados([], [lead('2235550101')]), [])
})

Deno.test('devuelve el número de fila tal cual vino, en el mismo orden', () => {
  const r = verificarDuplicados([fila(9, '2235550101'), fila(3, null)], [lead('2235550101')])
  assertEquals(r, [
    { fila: 9, duplicado: 'telefono' },
    { fila: 3, duplicado: null },
  ])
})

Deno.test('la respuesta no expone nada del lead existente', () => {
  const [r] = verificarDuplicados([fila(2, '2235550101')], [lead('2235550101', 'x@y.co')])
  assertEquals(Object.keys(r).sort(), ['duplicado', 'fila'])
})

Deno.test('2.000 filas contra 3.000 leads existentes, en tiempo razonable', () => {
  const telefonoDe = (i: number) => `223 ${String(5_000_000 + i).slice(0, 3)}-${String(5_000_000 + i).slice(3)}`
  const existentes = Array.from({ length: 3000 }, (_, i) =>
    lead(telefonoDe(i), `existente${i}@ejemplo.com`),
  )

  // 1.000 que existen (la mitad por teléfono, la mitad por email) y 1.000 nuevas.
  const filas = Array.from({ length: 2000 }, (_, i) => {
    if (i < 500) return fila(i + 2, telefonoDe(i * 2), null)
    if (i < 1000) return fila(i + 2, null, `EXISTENTE${i}@ejemplo.com`)
    return fila(i + 2, telefonoDe(10_000 + i), `nuevo${i}@ejemplo.com`)
  })

  const t0 = performance.now()
  const r = verificarDuplicados(filas, existentes)
  const ms = performance.now() - t0

  assertEquals(r.length, 2000)
  assertEquals(r.filter((x) => x.duplicado === 'telefono').length, 500)
  assertEquals(r.filter((x) => x.duplicado === 'email').length, 500)
  assertEquals(r.filter((x) => x.duplicado === null).length, 1000)
  assert(ms < 1000, `tardó ${ms.toFixed(0)} ms`)
})
