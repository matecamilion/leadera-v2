import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Spinner } from './Spinner'

/**
 * Deja pasar a /admin sólo al superadmin de LeadEra.
 *
 * Para cualquier otro, /admin no existe: se lo manda a /mi-dia sin mensaje,
 * sin "no tenés permiso" y sin guardar a dónde iba. Un aviso confirmaría que
 * la ruta está ahí. Sin sesión va al mismo lugar, y ProtectedRoute lo lleva al
 * login desde ahí: tampoco se recuerda /admin como destino después del login.
 *
 * Mientras se resuelve la sesión o el perfil, spinner y no redirección: si no,
 * un refresh en /admin rebotaría al superadmin antes de que llegue su fila.
 *
 * Igual que SuscripcionGuard, esto es una puerta de UI, no el límite de
 * seguridad. Lo que se puede leer lo decide la RLS: las policies
 * `*_select_superadmin` (migración 20260922120000) con
 * `private.my_es_superadmin()`, que además exige `activo`. Por eso acá también
 * se pide `activo`: si la base no le va a devolver nada, el panel no se abre.
 */
export function AdminGuard() {
  const { user, profile, loading, perfilListo } = useAuth()

  if (loading || (user && !perfilListo)) return <Spinner fullscreen />

  if (!user || profile?.es_superadmin !== true || !profile.activo) {
    return <Navigate to="/mi-dia" replace />
  }

  return <Outlet />
}
