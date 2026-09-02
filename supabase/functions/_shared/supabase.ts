import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

/**
 * Cliente admin (service role). Bypassea RLS: se usa para crear usuarios,
 * inmobiliarias e invitaciones. NUNCA se expone al cliente.
 */
export function adminClient(): SupabaseClient {
  const url = requireEnv('SUPABASE_URL')
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/**
 * Cliente anon. Se usa para UNA sola cosa: canjear email+password por una
 * sesión después del alta (`signInWithPassword`). El service role key no puede
 * emitir sesiones de usuario, así que este paso requiere el anon key.
 * No se usa para leer ni escribir datos.
 */
export function anonClient(): SupabaseClient {
  const url = requireEnv('SUPABASE_URL')
  const anonKey = requireEnv('SUPABASE_ANON_KEY')
  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function requireEnv(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Falta la variable de entorno ${name}`)
  return value
}

/** Bearer token del header Authorization, o null. */
export function bearerToken(req: Request): string | null {
  const header = req.headers.get('Authorization') ?? ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match ? match[1].trim() : null
}

export type RolAgente = 'DUENO' | 'AGENTE' | 'ASISTENTE'

export interface PerfilBasico {
  id: string
  rol: RolAgente
  inmobiliaria_id: string
}

/**
 * Cupo de la inmobiliaria: ¿entra un usuario más?
 * Cuenta profiles y lo compara contra inmobiliarias.limite_usuarios.
 */
export async function hayCupo(
  admin: SupabaseClient,
  inmobiliariaId: string,
): Promise<{ ok: boolean; usados: number; limite: number }> {
  const [{ data: inmobiliaria, error: errInmo }, { count, error: errCount }] =
    await Promise.all([
      admin
        .from('inmobiliarias')
        .select('limite_usuarios')
        .eq('id', inmobiliariaId)
        .single(),
      admin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('inmobiliaria_id', inmobiliariaId),
    ])

  if (errInmo || !inmobiliaria) throw new Error('No se encontró la inmobiliaria')
  if (errCount) throw new Error('No se pudo contar los usuarios de la inmobiliaria')

  const usados = count ?? 0
  const limite = inmobiliaria.limite_usuarios as number
  return { ok: usados < limite, usados, limite }
}
