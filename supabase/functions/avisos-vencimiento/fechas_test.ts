/**
 * Tests de fechas.ts (datos inventados).
 *
 *   deno test supabase/functions/avisos-vencimiento/fechas_test.ts
 *
 * El vencimiento es el día D = 2026-11-10 en hora de Argentina (UTC−3). Se
 * prueba a tres horas del día D, porque `registrar_pago_manual` deja el
 * vencimiento en `now() + N meses` y la hora es arbitraria: el plazo tiene que
 * ser el mismo para las tres.
 */
import { assertEquals } from 'jsr:@std/assert@1'
import { avisoDeHoy, fechaAR, fechaDeCorte } from './fechas.ts'

const D = '2026-11-10'

/** Instante de un horario local de Argentina (UTC−3). */
function ar(fecha: string, hora: string): number {
  return Date.parse(`${fecha}T${hora}:00-03:00`)
}

const HORAS_DE_VENCIMIENTO = [
  { nombre: '00:30', hasta: ar(D, '00:30') },
  { nombre: '15:00', hasta: ar(D, '15:00') },
  { nombre: '23:50', hasta: ar(D, '23:50') },
]

for (const { nombre, hasta } of HORAS_DE_VENCIMIENTO) {
  Deno.test(`vence a las ${nombre} AR: el día de vencimiento es D`, () => {
    assertEquals(fechaAR(hasta), D)
  })

  Deno.test(`vence a las ${nombre} AR: el corte es D+1`, () => {
    assertEquals(fechaDeCorte(hasta), '2026-11-11')
  })

  Deno.test(`vence a las ${nombre} AR: el día anterior sale el PREVIO`, () => {
    assertEquals(avisoDeHoy(hasta, '2026-11-09'), {
      tipo: 'PREVIO',
      vencimiento: D,
      corte: '2026-11-11',
    })
  })

  Deno.test(`vence a las ${nombre} AR: el día D sale DIA_VENCIMIENTO`, () => {
    assertEquals(avisoDeHoy(hasta, D), {
      tipo: 'DIA_VENCIMIENTO',
      vencimiento: D,
      corte: '2026-11-11',
    })
  })

  Deno.test(`vence a las ${nombre} AR: el día D+1 no sale ningún aviso`, () => {
    assertEquals(avisoDeHoy(hasta, '2026-11-11'), null)
  })
}

Deno.test('el PREVIO arranca tres días antes y no antes', () => {
  const hasta = ar(D, '15:00')
  assertEquals(avisoDeHoy(hasta, '2026-11-06'), null)
  assertEquals(avisoDeHoy(hasta, '2026-11-07')?.tipo, 'PREVIO')
  assertEquals(avisoDeHoy(hasta, '2026-11-08')?.tipo, 'PREVIO')
  assertEquals(avisoDeHoy(hasta, '2026-11-09')?.tipo, 'PREVIO')
})

Deno.test('después del corte no hay avisos, ni siquiera días más tarde', () => {
  const hasta = ar(D, '15:00')
  assertEquals(avisoDeHoy(hasta, '2026-11-12'), null)
  assertEquals(avisoDeHoy(hasta, '2026-11-14'), null)
})

Deno.test('cambio de mes: el corte de un vencimiento a fin de mes', () => {
  assertEquals(fechaDeCorte(ar('2026-11-30', '23:50')), '2026-12-01')
})
