import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  actualizarReporteSemanal,
  obtenerReporteSemanal,
} from '../lib/api/reporteSemanal'
import { claves } from '../lib/queryKeys'
import { useUid } from './useUid'

/**
 * Si el agente pidió recibir el reporte semanal por email.
 *
 * La misma clave la usan el toggle de /perfil y el aviso de Mi día, así que
 * activar desde uno apaga el otro sin wiring extra.
 */
export function useReporteSemanal() {
  const uid = useUid()
  return useQuery<boolean>({
    queryKey: claves.reporteSemanal.activo(uid),
    queryFn: obtenerReporteSemanal,
    enabled: !!uid,
  })
}

/**
 * Prende o apaga el reporte.
 *
 * Igual que el toggle de Google Calendar: en el cache queda lo que devolvió la
 * base —no lo que se pidió— y además se invalida, así lo que se ve en pantalla
 * es el valor real de la fila.
 */
export function useCambiarReporteSemanal() {
  const queryClient = useQueryClient()
  const uid = useUid()

  return useMutation<boolean, Error, boolean>({
    mutationFn: actualizarReporteSemanal,
    onSuccess: (activo) => {
      queryClient.setQueryData(claves.reporteSemanal.activo(uid), activo)
      queryClient.invalidateQueries({ queryKey: claves.reporteSemanal.activo(uid) })
    },
  })
}
