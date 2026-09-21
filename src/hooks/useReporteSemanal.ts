import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  actualizarReporteSemanal,
  obtenerReporteSemanal,
} from '../lib/api/reporteSemanal'

export const CLAVE_REPORTE_SEMANAL = ['reporte-semanal'] as const

/**
 * Si el agente pidió recibir el reporte semanal por email.
 *
 * La misma clave la usan el toggle de /perfil y el aviso de Mi día, así que
 * activar desde uno apaga el otro sin wiring extra.
 */
export function useReporteSemanal() {
  return useQuery<boolean>({
    queryKey: CLAVE_REPORTE_SEMANAL,
    queryFn: obtenerReporteSemanal,
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

  return useMutation<boolean, Error, boolean>({
    mutationFn: actualizarReporteSemanal,
    onSuccess: (activo) => {
      queryClient.setQueryData(CLAVE_REPORTE_SEMANAL, activo)
      queryClient.invalidateQueries({ queryKey: CLAVE_REPORTE_SEMANAL })
    },
  })
}
