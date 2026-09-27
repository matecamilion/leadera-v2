import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  actualizarMetaMensual,
  obtenerMetricasPerfil,
  type MetricasPerfil,
} from '../lib/api/perfil'
import { claves } from '../lib/queryKeys'
import { useUid } from './useUid'

export function useMetricasPerfil() {
  const uid = useUid()
  return useQuery<MetricasPerfil>({
    queryKey: claves.perfil.metricas(uid),
    queryFn: obtenerMetricasPerfil,
    enabled: !!uid,
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
  const uid = useUid()

  return useMutation<number, Error, number>({
    mutationFn: actualizarMetaMensual,
    onSuccess: (metaGuardada) => {
      queryClient.setQueryData<MetricasPerfil>(claves.perfil.metricas(uid), (actual) =>
        actual ? { ...actual, metaMensualGanados: metaGuardada } : actual,
      )
    },
  })
}
