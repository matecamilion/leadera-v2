/**
 * Lectura del perfil del usuario y, si es un asistente, el de su agente.
 *
 * DOS consultas simples por id, sin embeds ni hints de FK: la FK
 * `profiles_asiste_a_fkey` es autorreferenciada (profiles -> profiles) y el
 * embed por ella es ambiguo para PostgREST. Es la misma lectura que usa
 * `google-calendar-import-ahora`.
 *
 * `consultar` es una sola fila de `profiles` por id (lo que devuelve
 * `.eq('id', id).maybeSingle()`): un objeto o null, nunca una lista. Se inyecta
 * para testear la forma de los datos y los errores sin base.
 *
 * Un error de base NO es lo mismo que un rechazo por permiso: acá se lanza
 * `ErrorLecturaPerfil` para que quien llama responda 500 y lo deje claro en el
 * log, en vez de caer en un 403 que se vería igual que "no tenés permiso".
 */
import type { AgenteCalendario, PerfilCalendario } from '../_shared/equipoCalendario.ts'

export interface ErrorDeBase {
  message: string
  code?: string
}

export type ConsultaPerfil = (id: string) => PromiseLike<{ data: unknown; error: ErrorDeBase | null }>

export class ErrorLecturaPerfil extends Error {
  constructor(contexto: string, causa: string) {
    super(`${contexto}: ${causa}`)
    this.name = 'ErrorLecturaPerfil'
  }
}

function textoDeError(error: ErrorDeBase): string {
  return `${error.code ? `${error.code} ` : ''}${error.message}`.trim()
}

/** Una fila de perfil, o null si no existe. Cualquier otra cosa es un error. */
async function leerUno(
  consultar: ConsultaPerfil,
  id: string,
  contexto: string,
): Promise<Record<string, unknown> | null> {
  const { data, error } = await consultar(id)
  if (error) throw new ErrorLecturaPerfil(contexto, textoDeError(error))
  if (data === null || data === undefined) return null
  if (typeof data !== 'object' || Array.isArray(data)) {
    throw new ErrorLecturaPerfil(contexto, 'la base devolvió una forma inesperada (se esperaba una fila)')
  }
  return data as Record<string, unknown>
}

export async function leerPerfilesDe(
  consultar: ConsultaPerfil,
  userId: string,
): Promise<{ usuario: PerfilCalendario | null; agente: AgenteCalendario | null }> {
  const fila = await leerUno(consultar, userId, 'perfil del usuario')
  if (!fila) return { usuario: null, agente: null }

  const usuario = fila as unknown as PerfilCalendario

  // Solo un asistente con `asiste_a` necesita el segundo perfil.
  if (usuario.rol !== 'ASISTENTE' || !usuario.asiste_a) return { usuario, agente: null }

  const filaAgente = await leerUno(consultar, usuario.asiste_a, 'perfil del agente')
  return { usuario, agente: (filaAgente as unknown as AgenteCalendario | null) ?? null }
}
