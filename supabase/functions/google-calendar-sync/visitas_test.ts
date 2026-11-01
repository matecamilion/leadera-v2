/**
 * Título y descripción del evento de una visita: con propiedad, externa, sin
 * ninguna de las dos, con link y cancelada.
 *
 *   deno test --allow-env supabase/functions/google-calendar-sync/visitas_test.ts
 */
import { assertEquals } from 'jsr:@std/assert@1'
import { armarEvento, type FilaVisita, visitaARegistro } from './logica.ts'

function visita(sobre: Partial<FilaVisita> = {}): FilaVisita {
  return {
    fecha: '2026-11-10',
    hora: '15:30:00',
    notas: null,
    estado: 'AGENDADA',
    google_event_id: null,
    titulo_externo: null,
    link_externo: null,
    propiedades: null,
    ...sobre,
  }
}

const evento = (sobre: Partial<FilaVisita>) => armarEvento(visitaARegistro(visita(sobre)))

Deno.test('visita con propiedad: muestra la dirección', () => {
  const e = evento({ propiedades: { direccion: 'Colon 2230' } })
  assertEquals(e.summary, 'Visita: Colon 2230')
})

Deno.test('visita externa: muestra su titulo_externo', () => {
  const e = evento({ titulo_externo: 'Casa de los Alvarez en Funes' })
  assertEquals(e.summary, 'Visita: Casa de los Alvarez en Funes')
})

Deno.test('con propiedad y titulo_externo a la vez, gana la dirección (misma cadena que el front)', () => {
  const e = evento({ propiedades: { direccion: 'Colon 2230' }, titulo_externo: 'otro' })
  assertEquals(e.summary, 'Visita: Colon 2230')
})

Deno.test('sin propiedad ni titulo_externo: cae en "Propiedad"', () => {
  assertEquals(evento({}).summary, 'Visita: Propiedad')
})

Deno.test('descripción: solo notas queda igual que antes', () => {
  assertEquals(evento({ notas: 'Llevar llaves' }).description, 'Llevar llaves')
  assertEquals(evento({ notas: null }).description, null)
})

Deno.test('descripción: el link va debajo de las notas', () => {
  const e = evento({ notas: 'Llevar llaves', link_externo: 'https://zonaprop.com/ficha/123' })
  assertEquals(e.description, 'Llevar llaves\n\nhttps://zonaprop.com/ficha/123')
})

Deno.test('descripción: link sin notas es solo el link', () => {
  assertEquals(
    evento({ link_externo: 'https://zonaprop.com/ficha/123' }).description,
    'https://zonaprop.com/ficha/123',
  )
  // Notas en blanco no dejan un renglón vacío arriba.
  assertEquals(
    evento({ notas: '   ', link_externo: 'https://x.com/a' }).description,
    'https://x.com/a',
  )
})

Deno.test('cancelada: sigue agregando "(Cancelada)" al título', () => {
  assertEquals(
    evento({ estado: 'CANCELADA', propiedades: { direccion: 'Colon 2230' } }).summary,
    'Visita: Colon 2230 (Cancelada)',
  )
  assertEquals(
    evento({ estado: 'CANCELADA', titulo_externo: 'Casa de los Alvarez' }).summary,
    'Visita: Casa de los Alvarez (Cancelada)',
  )
})

Deno.test('otros estados no agregan sufijo', () => {
  assertEquals(evento({ estado: 'REALIZADA', titulo_externo: 'X' }).summary, 'Visita: X')
})

Deno.test('fecha, hora y marca de origen no cambian', () => {
  const r = visitaARegistro(visita({ google_event_id: 'ev-1' }))
  assertEquals(r.fecha, '2026-11-10')
  assertEquals(r.hora, '15:30:00')
  assertEquals(r.google_event_id, 'ev-1')
  assertEquals(armarEvento(r).extendedProperties, { private: { origen: 'leadera' } })
})
