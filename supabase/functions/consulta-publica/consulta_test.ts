/**
 * Tests de las partes puras de consulta-publica.
 *
 *   deno test supabase/functions/consulta-publica/consulta_test.ts
 *
 * El token necesita SUPABASE_SERVICE_ROLE_KEY: acá se setea uno de mentira.
 */
import { assert, assertEquals } from 'jsr:@std/assert@1'
import { normalizarTelefonoAR } from '../_shared/telefono.ts'
import { type ContextoEncuesta, validarPost } from './encuesta.ts'
import { armarBusqueda, armarResumen, calificar } from './puntaje.ts'
import { emitirToken, verificarToken } from './token.ts'

Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'clave-de-prueba')

const GENERAL: ContextoEncuesta = { flujo: 'GENERAL', operacionFija: null, preguntasOff: [] }
const PROP_VENTA: ContextoEncuesta = { flujo: 'PROPIEDAD', operacionFija: 'COMPRA', preguntasOff: [] }

const CONTACTO = { nombre: 'Ana', apellido: 'Gómez', telefono: '223 555-1234', email: 'ana@mail.com' }

function postGeneral(respuestas: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  return { token: 't', hp: '', consentimiento: true, respuestas, contacto: CONTACTO, ...extra }
}

// --- Teléfono (mismos casos que documenta src/lib/telefono.ts) ----------------

Deno.test('normalizarTelefonoAR: formatos de la práctica', () => {
  assertEquals(normalizarTelefonoAR('223 545-1180'), '5492235451180')
  assertEquals(normalizarTelefonoAR('0223 15 545-1180'), '5492235451180')
  assertEquals(normalizarTelefonoAR('+54 9 223 545-1180'), '5492235451180')
  assertEquals(normalizarTelefonoAR('+54 223 545-1180'), '5492235451180')
  assertEquals(normalizarTelefonoAR('15 545-1180'), '5492235451180')
  assertEquals(normalizarTelefonoAR('444-5555'), '5492234445555')
})

Deno.test('normalizarTelefonoAR: abonado pelado que empieza con 54 (igual que el front)', () => {
  // Rareza heredada de src/lib/telefono.ts: "545-1180" se toma como si trajera
  // el código de país. La copia tiene que dar lo mismo que el front; si se
  // corrige, se corrige en los dos lados.
  assertEquals(normalizarTelefonoAR('545-1180'), '5451180')
})

// --- Validación ---------------------------------------------------------------

Deno.test('validarPost: link general de compra completo', () => {
  const r = validarPost(
    postGeneral({
      operacion: 'COMPRA',
      tipo_propiedad: 'DEPARTAMENTO',
      zona: 'Centro',
      presupuesto: 'USD_100_150K',
      pago: 'CONTADO',
      plazo: 'MENOS_3M',
      vender: false,
    }),
    GENERAL,
  )
  assert(r.ok)
  assertEquals(r.valor.respuestas.operacion, 'COMPRA')
  assertEquals(r.valor.respuestas.garantia, null)
})

Deno.test('validarPost: en alquiler se pide garantía, no pago', () => {
  const base = { operacion: 'ALQUILER', tipo_propiedad: 'PH', presupuesto: 'ARS_0_400K', plazo: 'YA', vender: false }
  assert(!validarPost(postGeneral({ ...base, pago: 'CONTADO' }), GENERAL).ok)
  assert(validarPost(postGeneral({ ...base, garantia: 'SEGURO_CAUCION' }), GENERAL).ok)
})

Deno.test('validarPost: rango de la otra moneda se rechaza', () => {
  const r = validarPost(
    postGeneral({ operacion: 'ALQUILER', tipo_propiedad: 'PH', presupuesto: 'USD_0_50K', garantia: 'NO_TENGO', plazo: 'YA', vender: false }),
    GENERAL,
  )
  assert(!r.ok)
})

Deno.test('validarPost: sin consentimiento se rechaza', () => {
  const r = validarPost(
    postGeneral(
      { operacion: 'COMPRA', tipo_propiedad: 'CASA', presupuesto: 'USD_0_50K', pago: 'NO_SABE', plazo: 'YA', vender: false },
      { consentimiento: false },
    ),
    GENERAL,
  )
  assert(!r.ok)
})

Deno.test('validarPost: link de propiedad no acepta operación ni tipo', () => {
  const base = { presupuesto: 'SI', pago: 'CONTADO', plazo: 'YA', visita: true }
  assert(validarPost(postGeneral(base), PROP_VENTA).ok)
  assert(!validarPost(postGeneral({ ...base, operacion: 'COMPRA' }), PROP_VENTA).ok)
  assert(!validarPost(postGeneral({ ...base, tipo_propiedad: 'CASA' }), PROP_VENTA).ok)
})

Deno.test('validarPost: pregunta apagada no se acepta', () => {
  const ctx: ContextoEncuesta = { ...PROP_VENTA, preguntasOff: ['visita', 'email'] }
  assert(!validarPost(postGeneral({ presupuesto: 'SI', pago: 'CONTADO', plazo: 'YA', visita: true }), ctx).ok)
  assert(!validarPost(postGeneral({ presupuesto: 'SI', pago: 'CONTADO', plazo: 'YA' }), ctx).ok) // trae email
  const sinEmail = postGeneral({ presupuesto: 'SI', pago: 'CONTADO', plazo: 'YA' }, {
    contacto: { nombre: 'Ana', apellido: 'Gómez', telefono: '2235551234' },
  })
  assert(validarPost(sinEmail, ctx).ok)
})

Deno.test('validarPost: presupuesto ausente se tolera', () => {
  const r = validarPost(postGeneral({ pago: 'CONTADO', plazo: 'YA', visita: true }), PROP_VENTA)
  assert(r.ok)
  assertEquals(r.valor.respuestas.presupuesto, null)
})

Deno.test('validarPost: email con comodín de PostgREST se rechaza', () => {
  const r = validarPost(
    postGeneral({ presupuesto: 'SI', pago: 'CONTADO', plazo: 'YA', visita: true }, {
      contacto: { nombre: 'Ana', apellido: 'Gómez', telefono: '2235551234', email: 'a*b@mail.com' },
    }),
    PROP_VENTA,
  )
  assert(!r.ok)
})

Deno.test('validarPost: teléfono corto se rechaza', () => {
  const r = validarPost(
    postGeneral({ presupuesto: 'SI', pago: 'CONTADO', plazo: 'YA', visita: true }, {
      contacto: { nombre: 'Ana', apellido: 'Gómez', telefono: '1234' },
    }),
    PROP_VENTA,
  )
  assert(!r.ok)
})

Deno.test('validarPost: apellido obligatorio (vacío, solo espacios o largo de más)', () => {
  const base = { presupuesto: 'SI', pago: 'CONTADO', plazo: 'YA', visita: true }
  const con = (apellido: unknown) =>
    validarPost(postGeneral(base, { contacto: { nombre: 'Ana', apellido, telefono: '2235551234' } }), PROP_VENTA)

  const sinCampo = validarPost(
    postGeneral(base, { contacto: { nombre: 'Ana', telefono: '2235551234' } }),
    PROP_VENTA,
  )
  assert(!sinCampo.ok)
  assertEquals(sinCampo.error, 'Falta el apellido.')
  assert(!con('').ok)
  assert(!con('   ').ok)
  assert(!con(null).ok)
  assert(!con('x'.repeat(81)).ok)

  const ok = con('  Gómez  ')
  assert(ok.ok)
  assertEquals(ok.valor.contacto.apellido, 'Gómez')
  assert(con('x'.repeat(80)).ok)
})

// --- Puntaje ------------------------------------------------------------------

function respuestas(over: Record<string, unknown> = {}) {
  return {
    operacion: 'COMPRA' as const,
    tipo_propiedad: null,
    zona: null,
    presupuesto: 'SI',
    pago: 'CONTADO' as const,
    garantia: null,
    plazo: 'YA' as const,
    visita: true,
    vender: null,
    ...over,
  }
}

Deno.test('calificar: caliente y auto-aceptable', () => {
  const c = calificar('PROPIEDAD', respuestas(), { nombre: 'A', apellido: 'B', telefono: 'x', email: 'a@b.co' })
  assertEquals(c.puntaje, 30 + 25 + 25 + 10 + 5)
  assertEquals(c.temperatura, 'CALIENTE')
  assert(c.autoAceptable)
})

Deno.test('calificar: sin presupuesto nunca es auto-aceptable', () => {
  const c = calificar('PROPIEDAD', respuestas({ presupuesto: null }), {
    nombre: 'A', apellido: 'B', telefono: 'x', email: 'a@b.co',
  })
  assertEquals(c.puntaje, 65)
  assertEquals(c.temperatura, 'CALIENTE')
  assert(!c.autoAceptable)
})

Deno.test('calificar: curioso queda frío', () => {
  const c = calificar(
    'PROPIEDAD',
    respuestas({ presupuesto: 'NO', pago: 'NO_SABE', plazo: 'SOLO_MIRANDO', visita: false }),
    { nombre: 'A', apellido: 'B', telefono: 'x', email: null },
  )
  assertEquals(c.puntaje, -20)
  assertEquals(c.temperatura, 'FRIO')
  assert(!c.autoAceptable)
})

Deno.test('calificar: necesita vender marca posible captación', () => {
  const c = calificar('PROPIEDAD', respuestas({ pago: 'NECESITA_VENDER' }), {
    nombre: 'A', apellido: 'B', telefono: 'x', email: null,
  })
  assert(c.posibleCaptacion)
})

// --- Búsqueda y resumen ---------------------------------------------------------

Deno.test('armarBusqueda: compra general carga rango USD', () => {
  const b = armarBusqueda('GENERAL', respuestas({
    tipo_propiedad: 'CASA', zona: 'Centro', presupuesto: 'USD_100_150K', visita: null,
  }), null)
  assertEquals([b.precio_min, b.precio_max], [100_000, 150_000])
})

Deno.test('armarBusqueda: alquiler no carga precios (ARS va a notas)', () => {
  const b = armarBusqueda('GENERAL', respuestas({
    operacion: 'ALQUILER', pago: null, garantia: 'PROPIETARIA', tipo_propiedad: 'PH', presupuesto: 'ARS_0_400K',
  }), null)
  assertEquals([b.precio_min, b.precio_max], [null, null])
  assert(b.notas.includes('Hasta $400.000'))
})

Deno.test('armarResumen: propiedad no disponible lo dice', () => {
  const r = respuestas({ tipo_propiedad: 'CASA', presupuesto: 'USD_0_50K', visita: null })
  const cal = calificar('GENERAL', r, { nombre: 'A', apellido: 'B', telefono: 'x', email: null })
  const texto = armarResumen('GENERAL', r, cal, { tipo: 'PH', zona: 'Chauvin', precio: 132000, moneda: 'USD' })
  assert(texto.includes('ya no estaba disponible'))
  assert(!texto.toLowerCase().includes('direcc'))
})

// --- Token --------------------------------------------------------------------

Deno.test('token: ida y vuelta, vencido y alterado', async () => {
  const ahora = Date.now()
  const t = await emitirToken('a1b2c3d4e5f6', ahora)
  assertEquals(await verificarToken(t, ahora + 1000), { slug: 'a1b2c3d4e5f6', emitido: ahora })
  assertEquals(await verificarToken(t, ahora + 25 * 60 * 60 * 1000), null)
  assertEquals(await verificarToken(t.replace('a1b2c3d4e5f6', 'ffffffffffff'), ahora), null)
  assertEquals(await verificarToken(t.slice(0, -2) + 'xx', ahora), null)
})
