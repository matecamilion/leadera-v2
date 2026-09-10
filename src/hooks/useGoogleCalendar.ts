import { useMutation, useQuery } from '@tanstack/react-query'
import {
  iniciarConexionGoogle,
  obtenerConexionGoogle,
  type ConexionGoogle,
} from '../lib/api/googleCalendar'

export const CLAVE_GOOGLE_CALENDAR = ['google-calendar'] as const

/**
 * Estado de la conexión con Google Calendar del agente logueado.
 *
 * Tres estados posibles y los tres se distinguen en pantalla:
 *  - `undefined`/`null` → nunca conectó.
 *  - `{ conectado: true }` → andando.
 *  - `{ conectado: false }` → conectó y le revocaron el permiso; hay que
 *    reconectar. Lo baja `google-calendar-sync` cuando Google rechaza el
 *    refresh_token.
 */
export function useConexionGoogle() {
  return useQuery<ConexionGoogle | null>({
    queryKey: CLAVE_GOOGLE_CALENDAR,
    queryFn: obtenerConexionGoogle,
  })
}

/**
 * Pide la URL de consentimiento y manda el navegador a Google.
 *
 * La navegación va con `window.location.assign` y no con `<a>` ni router: es un
 * salto fuera de la SPA a un dominio de Google, y el que vuelve después es el
 * callback con un 302 a /perfil.
 *
 * No hay `onSuccess` que invalide el cache: para cuando Google responde, esta
 * pestaña ya navegó. El estado se relee solo al volver, porque el callback
 * redirige a /perfil y la query se monta de nuevo.
 */
export function useConectarGoogle() {
  return useMutation<string, Error, void>({
    mutationFn: iniciarConexionGoogle,
    onSuccess: (url) => {
      window.location.assign(url)
    },
  })
}
