import { useAuth } from '../contexts/AuthContext'

/**
 * El id del usuario logueado, para las claves de React Query.
 *
 * `undefined` sin sesión: las queries que lo usan van con `enabled: !!uid`, así
 * que no disparan hasta saber de quién son los datos.
 */
export function useUid(): string | undefined {
  return useAuth().user?.id
}
