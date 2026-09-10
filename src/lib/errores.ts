import { mensajeDeNegocio } from './mensajesDeError'

/**
 * Traduce un error de Supabase a algo que se le pueda mostrar al usuario.
 *
 * El problema que resuelve: la capa de API venía haciendo
 * `throw new Error(\`No se pudo X: ${error.message}\`)`, y `error.message` es el
 * texto crudo de PostgREST. Eso le mostraba al usuario cosas como
 * `new row violates row-level security policy for table "leads"` —nombres de
 * tablas, de columnas y de constraints—, que es el mapa de la base servido
 * gratis a cualquiera que fuerce un error.
 *
 * Corre en la capa de API a propósito, y no en la UI: acá el error todavía es
 * el objeto de Supabase con su `code`. Cuando se envuelve en un `Error` pelado
 * el código se pierde y sólo queda el texto, que es más frágil de matchear.
 *
 * No inventa un catálogo nuevo: los mensajes que la base ya redacta para
 * leerse —las cuotas de plan, los triggers de cierre de operación, las
 * validaciones de fecha— los sigue resolviendo `mensajesDeError.ts`, que es
 * donde viven. Acá sólo se agrega lo que necesita el `code` y el respaldo
 * seguro.
 */

/** Lo que se muestra cuando no se reconoce el error. */
const GENERICO = 'Ocurrió un error. Probá de nuevo en un momento.'

/**
 * Códigos de Postgres que llegan seguido, con su lectura para el usuario.
 *
 * Ninguno nombra la tabla ni la columna: quien no tiene permiso sobre algo
 * tampoco tiene por qué enterarse de cómo se llama.
 */
const POR_CODIGO: Record<string, string> = {
  // 42501 — RLS rechazó la fila. Es el más delicado de los cuatro: el texto
  // crudo dice literalmente el nombre de la tabla.
  '42501': 'No tenés permiso para hacer esta acción.',
  // 23505 — unique_violation. Sin el nombre del índice no se puede saber qué
  // campo se repitió, y el nombre es justamente lo que no queremos mostrar.
  '23505': 'Ya existe un registro con esos datos.',
  // 23503 — foreign_key_violation.
  '23503': 'El dato apunta a algo que no existe o que ya se eliminó.',
  // 23502 — not_null_violation.
  '23502': 'Faltan datos obligatorios.',
}

/**
 * @param error   Lo que devolvió Supabase, tal cual (con su `code`).
 * @param respaldo Frase de la pantalla para cuando no se reconoce nada, por
 *                 ejemplo "No se pudo eliminar la tarea." Sin ella se usa un
 *                 genérico.
 */
export function interpretarErrorSupabase(error: unknown, respaldo = GENERICO): string {
  const codigo = (error as { code?: string } | null)?.code
  const texto = (error as { message?: string } | null)?.message ?? ''

  // 1. Los mensajes que la base redacta para el usuario ganan sobre el código:
  //    un `raise exception` de una cuota de plan llega con código P0001, pero
  //    su texto es exactamente lo que hay que mostrar.
  const deNegocio = mensajeDeNegocio(texto)
  if (deNegocio) return deNegocio

  // 2. P0001 es `raise_exception`: el SQLSTATE que Postgres le pone a un
  //    `RAISE EXCEPTION` de PL/pgSQL cuando no se le indica otro. O sea, a algo
  //    que escribimos nosotros. Postgres nunca lo usa para describir la
  //    estructura de la base —para eso están la clase 23 y 42501—, así que el
  //    código alcanza para distinguir "mensaje nuestro" de "volcado del motor"
  //    sin tener que mantener una lista de frases. Los conocidos ya los agarró
  //    el paso 1 con su texto mejorado; éste es el respaldo para el RPC nuevo
  //    que todavía no está en el catálogo, que antes se veía tal cual y tiene
  //    que seguir viéndose.
  if (codigo === 'P0001' && texto) return texto

  // 3. Código conocido.
  if (codigo && POR_CODIGO[codigo]) return POR_CODIGO[codigo]

  // 4. Nada reconocido: al usuario la frase de la pantalla, y el error entero
  //    a la consola para no perderlo en desarrollo.
  console.error('[supabase]', error)
  return respaldo
}
