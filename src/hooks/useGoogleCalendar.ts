import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  actualizarImportacionActiva,
  desconectarGoogle,
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

/**
 * Desconecta el calendario del agente.
 *
 * A diferencia de conectar, acá la pestaña no navega a ningún lado: el estado
 * lo tiene que actualizar esta app. Se hace en dos pasos y los dos hacen falta:
 *
 *  - `setQueryData(null)` deja el estado en "nunca conectó" en el mismo tick, así
 *    el botón dice "Conectar" apenas cierra el modal. Con sólo invalidar, React
 *    Query sirve el dato viejo mientras refetchea y el agente vería "Conectado"
 *    un instante después de desconectar.
 *  - `invalidateQueries` releé igual, para que lo que quede en pantalla sea lo
 *    que dice la base y no lo que esta función asumió.
 */
export function useDesconectarGoogle() {
  const queryClient = useQueryClient()

  return useMutation<void, Error, void>({
    mutationFn: desconectarGoogle,
    onSuccess: () => {
      queryClient.setQueryData(CLAVE_GOOGLE_CALENDAR, null)
      queryClient.invalidateQueries({ queryKey: CLAVE_GOOGLE_CALENDAR })
    },
  })
}

/**
 * Prende o apaga la importación de Google -> LeadEra.
 *
 * El toggle de /perfil no guarda su propio estado: pinta `importacionActiva`
 * de esta query. Al volver la mutación se escribe en el cache lo que devolvió
 * la base —no lo que se pidió— y además se invalida, así lo que queda en
 * pantalla es el valor real de la fila.
 */
export function useCambiarImportacionGoogle() {
  const queryClient = useQueryClient()

  return useMutation<boolean, Error, boolean>({
    mutationFn: actualizarImportacionActiva,
    onSuccess: (activa) => {
      queryClient.setQueryData<ConexionGoogle | null>(CLAVE_GOOGLE_CALENDAR, (previo) =>
        previo ? { ...previo, importacionActiva: activa } : previo,
      )
      queryClient.invalidateQueries({ queryKey: CLAVE_GOOGLE_CALENDAR })
    },
  })
}
