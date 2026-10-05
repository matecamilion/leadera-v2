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

// --- Cuatro operaciones en el link general ---------------------------------------

const PROPIETARIO = { tipo_propiedad: 'CASA', zona: 'Chauvin', plazo: 'MENOS_3M' }

Deno.test('validarPost: venta de propietario completa', () => {
  const r = validarPost(
    postGeneral({ operacion: 'VENTA', ...PROPIETARIO, presupuesto: 'USD_150_250K', publicada: 'NO' }),
    GENERAL,
  )
  assert(r.ok)
  assertEquals(r.valor.respuestas.publicada, 'NO')
  assertEquals([r.valor.respuestas.pago, r.valor.respuestas.garantia, r.valor.respuestas.vender], [null, null, null])
})

Deno.test('validarPost: propietario no acepta pago, garantía ni vender', () => {
  const base = { operacion: 'VENTA', ...PROPIETARIO, presupuesto: 'TASACION', publicada: 'NO' }
  assert(validarPost(postGeneral(base), GENERAL).ok)
  assert(!validarPost(postGeneral({ ...base, pago: 'CONTADO' }), GENERAL).ok)
  assert(!validarPost(postGeneral({ ...base, garantia: 'PROPIETARIA' }), GENERAL).ok)
  assert(!validarPost(postGeneral({ ...base, vender: true }), GENERAL).ok)
  assert(!validarPost(postGeneral({ operacion: 'VENTA', ...PROPIETARIO, presupuesto: 'TASACION' }), GENERAL).ok) // falta publicada
})

Deno.test('validarPost: "No sé" vale solo para la operación que corresponde', () => {
  const venta = { operacion: 'VENTA', ...PROPIETARIO, publicada: 'NO' }
  const alq = { operacion: 'ALQUILER_PROPIETARIO', ...PROPIETARIO, publicada: 'NO' }
  assert(validarPost(postGeneral({ ...venta, presupuesto: 'TASACION' }), GENERAL).ok)
  assert(!validarPost(postGeneral({ ...venta, presupuesto: 'ASESORAR' }), GENERAL).ok)
  assert(validarPost(postGeneral({ ...alq, presupuesto: 'ASESORAR' }), GENERAL).ok)
  assert(!validarPost(postGeneral({ ...alq, presupuesto: 'TASACION' }), GENERAL).ok)
})

Deno.test('validarPost: alquiler acepta pesos y dólares, no rangos de compra', () => {
  const base = { operacion: 'ALQUILER', tipo_propiedad: 'DEPARTAMENTO', garantia: 'SEGURO_CAUCION', plazo: 'YA', vender: false }
  assert(validarPost(postGeneral({ ...base, presupuesto: 'ARS_500_800K' }), GENERAL).ok)
  assert(validarPost(postGeneral({ ...base, presupuesto: 'USD_800_1200' }), GENERAL).ok)
  assert(!validarPost(postGeneral({ ...base, presupuesto: 'USD_100_150K' }), GENERAL).ok)
})

Deno.test('validarPost: rangos nuevos de compra y legacy siguen valiendo', () => {
  const base = { operacion: 'COMPRA', tipo_propiedad: 'CASA', pago: 'CONTADO', plazo: 'YA', vender: false }
  assert(validarPost(postGeneral({ ...base, presupuesto: 'USD_700K_MAS' }), GENERAL).ok)
  assert(validarPost(postGeneral({ ...base, presupuesto: 'USD_0_50K' }), GENERAL).ok) // legacy
  const alquiler = { operacion: 'ALQUILER', tipo_propiedad: 'PH', garantia: 'NO_TENGO', plazo: 'YA', vender: false }
  assert(validarPost(postGeneral({ ...alquiler, presupuesto: 'ARS_0_400K' }), GENERAL).ok) // legacy
})

// --- Monto del rango abierto ----------------------------------------------------

const COMPRA_ALTA = {
  operacion: 'COMPRA', tipo_propiedad: 'CASA', presupuesto: 'USD_700K_MAS', pago: 'CONTADO', plazo: 'YA', vender: false,
}

function montoValidado(respuestas: Record<string, unknown>) {
  const r = validarPost(postGeneral(respuestas), GENERAL)
  assert(r.ok)
  return r.valor.respuestas.presupuesto_monto
}

Deno.test('validarPost: monto válido en los tres rangos abiertos', () => {
  assertEquals(montoValidado({ ...COMPRA_ALTA, presupuesto_monto: 900_000 }), 900_000)
  assertEquals(montoValidado({ ...COMPRA_ALTA, presupuesto_monto: 700_000 }), 700_000) // el piso vale
  const alquiler = { operacion: 'ALQUILER', tipo_propiedad: 'PH', garantia: 'PROPIETARIA', plazo: 'YA', vender: false }
  assertEquals(montoValidado({ ...alquiler, presupuesto: 'ARS_2M_MAS', presupuesto_monto: 2_500_000 }), 2_500_000)
  assertEquals(montoValidado({ ...alquiler, presupuesto: 'USD_2000_MAS', presupuesto_monto: 3_000 }), 3_000)
  // Propietarios también.
  const venta = { operacion: 'VENTA', tipo_propiedad: 'CASA', presupuesto: 'USD_700K_MAS', publicada: 'NO', plazo: 'YA' }
  assertEquals(montoValidado({ ...venta, presupuesto_monto: 1_200_000 }), 1_200_000)
})

Deno.test('validarPost: sin monto, queda null', () => {
  assertEquals(montoValidado(COMPRA_ALTA), null)
  assertEquals(montoValidado({ ...COMPRA_ALTA, presupuesto_monto: null }), null)
})

Deno.test('validarPost: monto bajo el piso o sobre el tope se descarta, sin rechazar', () => {
  assertEquals(montoValidado({ ...COMPRA_ALTA, presupuesto_monto: 699_999 }), null)
  assertEquals(montoValidado({ ...COMPRA_ALTA, presupuesto_monto: 35_000_001 }), null)
  assertEquals(montoValidado({ ...COMPRA_ALTA, presupuesto_monto: 35_000_000 }), 35_000_000)
})

Deno.test('validarPost: monto que no es entero se descarta', () => {
  assertEquals(montoValidado({ ...COMPRA_ALTA, presupuesto_monto: 900_000.5 }), null)
  assertEquals(montoValidado({ ...COMPRA_ALTA, presupuesto_monto: '900000' }), null)
  assertEquals(montoValidado({ ...COMPRA_ALTA, presupuesto_monto: -1 }), null)
})

Deno.test('validarPost: monto con un rango que no es abierto se descarta', () => {
  assertEquals(montoValidado({ ...COMPRA_ALTA, presupuesto: 'USD_400_700K', presupuesto_monto: 900_000 }), null)
  // Rango abierto de la primera versión: la página vieja no pregunta el monto.
  assertEquals(montoValidado({ ...COMPRA_ALTA, presupuesto: 'USD_250K_MAS', presupuesto_monto: 900_000 }), null)
  // Sin presupuesto tampoco.
  const { presupuesto: _, ...sinRango } = COMPRA_ALTA
  assertEquals(montoValidado({ ...sinRango, presupuesto_monto: 900_000 }), null)
})

Deno.test('validarPost: el link de propiedad no acepta monto', () => {
  const r = validarPost(postGeneral({ presupuesto: 'SI', pago: 'CONTADO', plazo: 'YA', visita: true, presupuesto_monto: 900_000 }), PROP_VENTA)
  assert(!r.ok)
})

Deno.test('calificar: el monto no cambia el puntaje', () => {
  const sin = calificar('GENERAL', respuestas({ presupuesto: 'USD_700K_MAS', visita: null }), CONTACTO)
  const con = calificar('GENERAL', respuestas({ presupuesto: 'USD_700K_MAS', presupuesto_monto: 900_000, visita: null }), CONTACTO)
  assertEquals(con, sin)
})

Deno.test('armarResumen: rango abierto con monto', () => {
  const r = respuestas({ presupuesto: 'USD_700K_MAS', presupuesto_monto: 900_000, visita: null })
  const texto = armarResumen('GENERAL', r, calificar('GENERAL', r, CONTACTO), null)
  assert(texto.includes('Presupuesto: Más de USD 700.000 (indicó USD 900.000).'))
  const sin = respuestas({ presupuesto: 'USD_700K_MAS', visita: null })
  assert(armarResumen('GENERAL', sin, calificar('GENERAL', sin, CONTACTO), null).includes('Presupuesto: Más de USD 700.000.'))
})

Deno.test('armarBusqueda: USD con monto, el monto es el techo', () => {
  const b = armarBusqueda('GENERAL', respuestas({ presupuesto: 'USD_700K_MAS', presupuesto_monto: 900_000, visita: null }), null)
  assertEquals([b?.precio_min, b?.precio_max], [700_000, 900_000])
  const alquiler = armarBusqueda('GENERAL', respuestas({
    operacion: 'ALQUILER', pago: null, garantia: 'PROPIETARIA', presupuesto: 'USD_2000_MAS', presupuesto_monto: 3_000,
  }), null)
  assertEquals([alquiler?.precio_min, alquiler?.precio_max], [2_000, 3_000])
})

Deno.test('armarBusqueda: USD sin monto, sin techo como hoy', () => {
  const b = armarBusqueda('GENERAL', respuestas({ presupuesto: 'USD_700K_MAS', visita: null }), null)
  assertEquals([b?.precio_min, b?.precio_max], [700_000, null])
})

Deno.test('armarBusqueda: pesos con monto, a notas y sin precios', () => {
  const b = armarBusqueda('GENERAL', respuestas({
    operacion: 'ALQUILER', pago: null, garantia: 'PROPIETARIA', presupuesto: 'ARS_2M_MAS', presupuesto_monto: 2_500_000,
  }), null)
  assertEquals([b?.precio_min, b?.precio_max], [null, null])
  assert(b?.notas.includes('presupuesto: Más de $2.000.000 (indicó $2.500.000)'))
})

Deno.test('validarPost: el link de propiedad no acepta operaciones de propietario', () => {
  const ambas: ContextoEncuesta = { flujo: 'PROPIEDAD', operacionFija: null, preguntasOff: [] }
  const base = { presupuesto: 'SI', plazo: 'YA', visita: true }
  assert(validarPost(postGeneral({ ...base, operacion: 'COMPRA', pago: 'CONTADO' }), ambas).ok)
  assert(!validarPost(postGeneral({ ...base, operacion: 'VENTA', publicada: 'NO' }), ambas).ok)
})

Deno.test('calificar: propietario sin publicar es caliente y captación', () => {
  const r = respuestas({
    operacion: 'VENTA', pago: null, visita: null, presupuesto: 'USD_150_250K', publicada: 'NO', plazo: 'MENOS_3M',
  })
  const c = calificar('GENERAL', r, { nombre: 'A', apellido: 'B', telefono: 'x', email: 'a@b.co' })
  assertEquals(c.puntaje, 30 + 25 + 25 + 5)
  assertEquals(c.temperatura, 'CALIENTE')
  assert(c.autoAceptable)
  assert(c.posibleCaptacion)
})

Deno.test('armarBusqueda: propietario no genera búsqueda', () => {
  const r = respuestas({ operacion: 'ALQUILER_PROPIETARIO', pago: null, visita: null, presupuesto: 'ASESORAR', publicada: 'VARIAS' })
  assertEquals(armarBusqueda('GENERAL', r, null), null)
})

Deno.test('armarBusqueda: alquiler en USD carga precios; en pesos, a notas', () => {
  const usd = armarBusqueda('GENERAL', respuestas({
    operacion: 'ALQUILER', pago: null, garantia: 'PROPIETARIA', tipo_propiedad: 'PH', presupuesto: 'USD_800_1200',
  }), null)
  assertEquals([usd?.precio_min, usd?.precio_max], [800, 1200])
  const ars = armarBusqueda('GENERAL', respuestas({
    operacion: 'ALQUILER', pago: null, garantia: 'PROPIETARIA', tipo_propiedad: 'PH', presupuesto: 'ARS_500_800K',
  }), null)
  assertEquals([ars?.precio_min, ars?.precio_max], [null, null])
  assert(ars?.notas.includes('$500.000 a $800.000'))
})

Deno.test('armarResumen: propietario habla de valor y publicación', () => {
  const r = respuestas({ operacion: 'VENTA', pago: null, visita: null, tipo_propiedad: 'CASA', zona: 'Chauvin', presupuesto: 'TASACION', publicada: 'UNA_INMOBILIARIA' })
  const cal = calificar('GENERAL', r, { nombre: 'A', apellido: 'B', telefono: 'x', email: null })
  const texto = armarResumen('GENERAL', r, cal, null)
  assert(texto.includes('Venta de su propiedad'))
  assert(texto.includes('Su propiedad: Casa en Chauvin'))
  assert(texto.includes('Valor estimado: No sé, quiero una tasación'))
  assert(texto.includes('Publicada: Con una inmobiliaria'))
})

// --- Puntaje ------------------------------------------------------------------

function respuestas(over: Record<string, unknown> = {}) {
  return {
    operacion: 'COMPRA' as const,
    tipo_propiedad: null,
    zona: null,
    presupuesto: 'SI',
    presupuesto_monto: null,
    pago: 'CONTADO' as const,
    garantia: null,
    publicada: null,
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
  assertEquals([b?.precio_min, b?.precio_max], [100_000, 150_000])
})

Deno.test('armarBusqueda: alquiler no carga precios (ARS va a notas)', () => {
  const b = armarBusqueda('GENERAL', respuestas({
    operacion: 'ALQUILER', pago: null, garantia: 'PROPIETARIA', tipo_propiedad: 'PH', presupuesto: 'ARS_0_400K',
  }), null)
  assertEquals([b?.precio_min, b?.precio_max], [null, null])
  assert(b?.notas.includes('Hasta $400.000'))
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
