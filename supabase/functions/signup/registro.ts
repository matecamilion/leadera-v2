/**
 * Piezas del alta independiente que se prueban sin levantar la función.
 */
import { normalizarCelularRegistro } from '../_shared/telefono.ts'

/**
 * El celular del alta independiente, validado y en formato internacional.
 *
 * Obligatorio: sin él no se puede escribirle a quien se registra. Corre ANTES de
 * insertar la inmobiliaria, para no dejar una cuenta a medias por un dato mal
 * escrito. El motivo del rechazo ya viene redactado para mostrarse.
 */
export function parseTelefonoIndependiente(
  body: Record<string, unknown>,
): { telefono: string } | { error: string } {
  const crudo = typeof body.telefono === 'string' ? body.telefono : ''
  const resultado = normalizarCelularRegistro(crudo)
  if (!resultado.ok) return { error: resultado.motivo }
  return { telefono: resultado.e164 }
}

/** Lo mínimo que se usa del cliente de Supabase. */
interface ClienteProfiles {
  from(tabla: 'profiles'): {
    update(valores: { telefono: string }): {
      eq(columna: 'id', valor: string): PromiseLike<{ error: { code?: string } | null }>
    }
  }
}

/**
 * Guarda el teléfono en el perfil recién creado.
 *
 * Nunca rompe el alta: si falla, el usuario ya existe y entra igual, y puede
 * cargarlo después desde Mi cuenta. Se loguea solo el código del error: el
 * mensaje de un CHECK violado puede traer la fila entera, número incluido.
 *
 * Devuelve si quedó guardado.
 */
export async function guardarTelefono(
  admin: ClienteProfiles,
  userId: string,
  telefono: string,
): Promise<boolean> {
  try {
    const { error } = await admin.from('profiles').update({ telefono }).eq('id', userId)
    if (error) {
      console.error('signup: no se pudo guardar el teléfono', error.code ?? 'sin código')
      return false
    }
    return true
  } catch {
    console.error('signup: no se pudo guardar el teléfono (excepción)')
    return false
  }
}
