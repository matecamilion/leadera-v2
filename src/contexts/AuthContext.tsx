import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'

export type Profile = Database['public']['Tables']['profiles']['Row']

interface AuthContextValue {
  user: User | null
  /** Perfil de agente del usuario. null mientras carga o si todavía no existe. */
  profile: Profile | null
  /** true hasta que se resuelve el primer chequeo de sesión. */
  loading: boolean
  /** Vuelve a leer el profile de la base. Para después de editarlo. */
  refrescarPerfil: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // --- Sesión --------------------------------------------------------------
  useEffect(() => {
    let activo = true

    supabase.auth.getSession().then(({ data }) => {
      if (!activo) return
      setUser(data.session?.user ?? null)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      // Si getSession todavía no volvió, esto ya nos deja el estado resuelto.
      setLoading(false)
    })

    return () => {
      activo = false
      sub.subscription.unsubscribe()
    }
  }, [])

  // --- Perfil --------------------------------------------------------------
  // Guardamos junto al id del usuario al que pertenece, y derivamos `profile`
  // en render. Así al cambiar de sesión nunca se ve el perfil del usuario
  // anterior mientras carga el nuevo.
  const [perfilCargado, setPerfilCargado] = useState<{
    userId: string
    profile: Profile | null
  } | null>(null)

  useEffect(() => {
    if (!user) return

    let activo = true

    supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!activo) return
        if (error) console.error('No se pudo cargar el perfil', error)
        setPerfilCargado({ userId: user.id, profile: error ? null : data })
      })

    return () => {
      activo = false
    }
  }, [user])

  // El profile se lee una sola vez por sesión. Cuando la propia app lo edita
  // (Perfil) hay que releerlo o el nombre del header queda con el valor viejo.
  const refrescarPerfil = useCallback(async () => {
    const userId = user?.id
    if (!userId) return

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      console.error('No se pudo recargar el perfil', error)
      return
    }
    setPerfilCargado({ userId, profile: data })
  }, [user?.id])

  const profile =
    user && perfilCargado?.userId === user.id ? perfilCargado.profile : null

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, profile, loading, refrescarPerfil, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth tiene que usarse dentro de <AuthProvider>')
  return ctx
}
