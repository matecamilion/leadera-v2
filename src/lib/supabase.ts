import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'
import { capturarHashRecuperacion, escucharRecuperacion } from './recuperacion'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Faltan VITE_SUPABASE_URL y/o VITE_SUPABASE_ANON_KEY. ' +
      'Copiá .env.example a .env.local y completá los valores del proyecto de Supabase.',
  )
}

// Antes de crear el cliente: al procesar el link de recuperación borra el hash.
capturarHashRecuperacion()

/**
 * Cliente único de Supabase para toda la app.
 *
 * El tipo `Database` es un placeholder hasta Fase 1; una vez creado el proyecto
 * se regenera con:
 *   npx supabase gen types typescript --project-id <id> > src/types/database.ts
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

// Inmediatamente después y sin await: PASSWORD_RECOVERY se emite una sola vez,
// y ResetPassword (lazy) puede montarse cuando ya pasó.
escucharRecuperacion(supabase)
