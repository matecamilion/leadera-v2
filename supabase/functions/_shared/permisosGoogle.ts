/**
 * Quién puede tener su propia conexión con Google Calendar.
 *
 * Un ASISTENTE no tiene calendario propio: opera el de su agente
 * (`profiles.asiste_a`), y solo el agente (o el dueño que hace de agente)
 * conecta Google. Este módulo es lo único que decide eso para las funciones
 * `google-oauth-init`, `google-oauth-callback` y `google-calendar-import`, así
 * las tres dicen lo mismo y la regla se testea sin base.
 *
 * Es lógica pura: la lectura del rol va por `rolDeUsuario`.
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

/** Mensaje al usuario cuando un asistente intenta conectar. */
export const MENSAJE_ASISTENTE_NO_CONECTA =
  'Tu agente gestiona la conexión con Google Calendar. Pedile que la conecte desde su perfil.'

/**
 * ¿Puede iniciar o completar una conexión con Google este rol?
 *
 * Falla cerrado: un rol desconocido, o ninguno (usuario sin perfil), NO puede.
 * Si algún día se suma un rol nuevo, queda bloqueado hasta que se lo habilite
 * acá a propósito.
 */
export function puedeConectarGoogle(rol: string | null | undefined): boolean {
  return rol === 'DUENO' || rol === 'AGENTE'
}

/**
 * ¿Es un asistente? Para la importación, que filtra cuentas ya existentes:
 * ahí solo se saltea a un asistente confirmado, y un perfil faltante sigue su
 * camino de error de siempre (`El agente no tiene perfil`).
 */
export function esAsistente(rol: string | null | undefined): boolean {
  return rol === 'ASISTENTE'
}

/**
 * Rol de un usuario, o null si no tiene perfil. Un error de lectura se
 * propaga: quien llama decide cerrar (init/callback) y no asumir un rol.
 */
export async function rolDeUsuario(admin: SupabaseClient, userId: string): Promise<string | null> {
  const { data, error } = await admin
    .from('profiles')
    .select('rol')
    .eq('id', userId)
    .maybeSingle<{ rol: string }>()

  if (error) throw error
  return data?.rol ?? null
}

/** Roles de varios usuarios a la vez: `id -> rol`. Los que no tienen perfil no aparecen. */
export async function rolesDeUsuarios(
  admin: SupabaseClient,
  userIds: string[],
): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map()

  const { data, error } = await admin.from('profiles').select('id, rol').in('id', userIds)
  if (error) throw error

  return new Map((data ?? []).map((f: { id: string; rol: string }) => [f.id, f.rol]))
}
