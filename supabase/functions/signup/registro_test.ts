/**
 * Tests de registro.ts (teléfono del alta independiente).
 *
 *   deno test --allow-read supabase/functions/signup/registro_test.ts
 */
import { assert, assertEquals, assertFalse, assertStringIncludes } from 'jsr:@std/assert@1'
import { guardarTelefono, parseTelefonoIndependiente } from './registro.ts'

Deno.test('parse: un celular válido sale en formato internacional', () => {
  assertEquals(parseTelefonoIndependiente({ telefono: '223 555-0101' }), {
    telefono: '+5492235550101',
  })
  assertEquals(parseTelefonoIndependiente({ telefono: '+598 99 123 456' }), {
    telefono: '+59899123456',
  })
})

Deno.test('parse: el independiente exige teléfono', () => {
  for (const body of [{}, { telefono: '' }, { telefono: '   ' }, { telefono: 12345678 }]) {
    const r = parseTelefonoIndependiente(body)
    assert('error' in r)
  }
})

Deno.test('parse: sin código de área se rechaza, no se asume 223', () => {
  const r = parseTelefonoIndependiente({ telefono: '555 0101' })
  assert('error' in r)
  assertStringIncludes(r.error, 'código de área')
})

Deno.test('parse: un valor absurdo se rechaza', () => {
  assert('error' in parseTelefonoIndependiente({ telefono: 'no tengo' }))
  assert('error' in parseTelefonoIndependiente({ telefono: '+54 223 555' }))
})

function clienteFalso(resultado: () => Promise<{ error: { code?: string } | null }>) {
  const llamadas: { telefono: string; id: string }[] = []
  return {
    llamadas,
    cliente: {
      from: (_tabla: 'profiles') => ({
        update: (valores: { telefono: string }) => ({
          eq: (_c: 'id', id: string) => {
            llamadas.push({ telefono: valores.telefono, id })
            return resultado()
          },
        }),
      }),
    },
  }
}

function capturarErrores<T>(fn: () => Promise<T>): Promise<{ valor: T; logs: string[] }> {
  const original = console.error
  const logs: string[] = []
  console.error = (...args: unknown[]) => {
    logs.push(args.map(String).join(' '))
  }
  return fn()
    .then((valor) => ({ valor, logs }))
    .finally(() => {
      console.error = original
    })
}

Deno.test('guardar: escribe el teléfono en el perfil del usuario', async () => {
  const { cliente, llamadas } = clienteFalso(() => Promise.resolve({ error: null }))
  assert(await guardarTelefono(cliente, 'user-1', '+5492235550101'))
  assertEquals(llamadas, [{ telefono: '+5492235550101', id: 'user-1' }])
})

Deno.test('guardar: si la base falla, no rompe y no loguea el número', async () => {
  const { cliente } = clienteFalso(() => Promise.resolve({ error: { code: '23514' } }))
  const { valor, logs } = await capturarErrores(() =>
    guardarTelefono(cliente, 'user-1', '+5492235550101'),
  )
  assertFalse(valor)
  assertEquals(logs.length, 1)
  assertFalse(logs[0].includes('5550101'))
  assertStringIncludes(logs[0], '23514')
})

Deno.test('guardar: si el cliente lanza, no rompe y no loguea el número', async () => {
  const { cliente } = clienteFalso(() => Promise.reject(new Error('fallo con +5492235550101')))
  const { valor, logs } = await capturarErrores(() =>
    guardarTelefono(cliente, 'user-1', '+5492235550101'),
  )
  assertFalse(valor)
  assertEquals(logs.length, 1)
  assertFalse(logs[0].includes('5550101'))
})

// Chequeo de estructura sobre index.ts: la función arranca un servidor al
// importarse, así que no se puede cargar en un test. Se verifica que el celular
// se valide antes de insertar la inmobiliaria, que se guarde después de crear al
// usuario y que la puerta del invitado no lo toque.
Deno.test('index: validación antes de la inmobiliaria, guardado después del usuario, invitado ajeno', async () => {
  const fuente = await Deno.readTextFile(new URL('./index.ts', import.meta.url))

  const independiente = fuente.slice(
    fuente.indexOf('async function signupIndependiente'),
    fuente.indexOf('async function signupInvitado'),
  )
  const invitado = fuente.slice(
    fuente.indexOf('async function signupInvitado'),
    fuente.indexOf('function parseDatosPersonales'),
  )

  const parseo = independiente.indexOf('parseTelefonoIndependiente(')
  const insert = independiente.indexOf(".from('inmobiliarias')")
  const alta = independiente.indexOf('await crearUsuario(')
  const guardado = independiente.indexOf('guardarTelefono(')
  const sesion = independiente.indexOf('responderConSesion(')

  assert(parseo > -1 && parseo < insert, 'el celular se valida antes de insertar la inmobiliaria')
  assert(alta < guardado && guardado < sesion, 'se guarda después de crear el usuario y antes de la sesión')
  assertFalse(invitado.includes('telefono'), 'el invitado no maneja teléfono')
  assertFalse(invitado.includes('guardarTelefono'))
})
