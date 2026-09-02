import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  actualizarMetaMensual,
  obtenerMetricasPerfil,
  type MetricasPerfil,
} from '../lib/api/perfil'

export const CLAVE_PERFIL = ['perfil', 'metricas'] as const

export function useMetricasPerfil() {
  return useQuery<MetricasPerfil>({
    queryKey: CLAVE_PERFIL,
    queryFn: obtenerMetricasPerfil,
  })
}

/**
 * Guarda la meta del mes.
 *
 * Al terminar escribe la meta devuelta directo en el cache: el progreso y el
 * ritmo se recalculan sin esperar el refetch, y el número que queda es el que
 * confirmó el server, no el que se tipeó.
 */
export function useGuardarMeta() {
  const queryClient = useQueryClient()

  return useMutation<number, Error, number>({
    mutationFn: actualizarMetaMensual,
    onSuccess: (metaGuardada) => {
      queryClient.setQueryData<MetricasPerfil>(CLAVE_PERFIL, (actual) =>
        actual ? { ...actual, metaMensualGanados: metaGuardada } : actual,
      )
    },
  })
}
