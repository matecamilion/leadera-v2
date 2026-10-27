/**
 * Tests de cupo.ts (datos inventados).
 *
 *   deno test --allow-env supabase/functions/verificar-duplicados-importacion/cupo_test.ts
 */
import { assertEquals } from 'jsr:@std/assert@1'
import { armarRespuesta, calcularCupo } from './cupo.ts'

Deno.test('límite null: sin tope', () => {
  assertEquals(calcularCupo(120, null), { limite: null, usados: 120 })
  assertEquals(calcularCupo(0, null), { limite: null, usados: 0 })
})

Deno.test('límite mayor que los usados', () => {
  assertEquals(calcularCupo(150, 200), { limite: 200, usados: 150 })
})

Deno.test('límite igual a los usados', () => {
  assertEquals(calcularCupo(200, 200), { limite: 200, usados: 200 })
})

Deno.test('límite menor que los usados: los dos números tal cual, sin recortar', () => {
  assertEquals(calcularCupo(230, 200), { limite: 200, usados: 230 })
})

Deno.test('un límite en 0 es un tope real, no "sin tope"', () => {
  assertEquals(calcularCupo(0, 0), { limite: 0, usados: 0 })
})

Deno.test('un dato ilegible cuenta como sin tope, no como 0', () => {
  assertEquals(calcularCupo(10, undefined), { limite: null, usados: 10 })
  assertEquals(calcularCupo(10, Number.NaN), { limite: null, usados: 10 })
  assertEquals(calcularCupo(10, -5), { limite: null, usados: 10 })
  assertEquals(calcularCupo(10, '200' as unknown as number), { limite: null, usados: 10 })
})

Deno.test('la respuesta lleva solo resultados y cupo', () => {
  const r = armarRespuesta(
    [
      { fila: 2, duplicado: 'telefono' },
      { fila: 3, duplicado: null },
    ],
    calcularCupo(10, 200),
  )
  assertEquals(Object.keys(r).sort(), ['cupo', 'resultados'])
  assertEquals(r, {
    resultados: [
      { fila: 2, duplicado: 'telefono' },
      { fila: 3, duplicado: null },
    ],
    cupo: { limite: 200, usados: 10 },
  })
})

Deno.test('la respuesta no deja pasar campos de más, aunque entren', () => {
  // Si por un descuido la lectura devolviera un lead entero, no viaja.
  const sucio = {
    fila: 2,
    duplicado: 'email',
    id: 'x',
    nombre: 'Ana',
    telefono: '2235550101',
  } as unknown as { fila: number; duplicado: 'email' }
  const cupoSucio = { limite: 200, usados: 10, plan: 'SOLO', inmobiliaria_id: 'z' }

  const r = armarRespuesta([sucio], cupoSucio)

  assertEquals(Object.keys(r.resultados[0]).sort(), ['duplicado', 'fila'])
  assertEquals(Object.keys(r.cupo).sort(), ['limite', 'usados'])
})

Deno.test('con filas vacías la respuesta trae igual el cupo', () => {
  assertEquals(armarRespuesta([], calcularCupo(5, null)), {
    resultados: [],
    cupo: { limite: null, usados: 5 },
  })
})
