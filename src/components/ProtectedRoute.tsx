import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Spinner } from './Spinner'

/**
 * Deja pasar sólo con sesión activa.
 *
 * Mientras se resuelve el chequeo inicial muestra un spinner: si redirigiéramos
 * durante `loading`, un refresh en una ruta protegida rebotaría al login antes
 * de que Supabase termine de rehidratar la sesión desde storage.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <Spinner fullscreen label="Verificando tu sesión" />

  if (!user) {
    // Guardamos a dónde iba para volver ahí después del login.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <>{children}</>
}
