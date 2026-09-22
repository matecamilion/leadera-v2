import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import {
  obtenerMetricasCuenta,
  obtenerPanelAdmin,
  type DatosPanelAdmin,
  type MetricasUsoCuenta,
} from '../lib/api/admin'

/**
 * Todo lo del panel /admin, en una sola ida.
 *
 * El id del usuario va en la clave: el cache de React Query sobrevive a un
 * cambio de sesión en la misma pestaña, y estos datos no pueden quedar a mano
 * del siguiente que entre.
 */
export function usePanelAdmin() {
  const { user } = useAuth()
  return useQuery<DatosPanelAdmin>({
    queryKey: ['admin', 'panel', user?.id],
    queryFn: () => obtenerPanelAdmin(),
    enabled: !!user,
  })
}

/** Conteos de uso de una inmobiliaria, para /admin/inmobiliarias/:id. */
export function useMetricasCuenta(inmobiliariaId: string | undefined) {
  const { user } = useAuth()
  return useQuery<MetricasUsoCuenta>({
    queryKey: ['admin', 'metricas', user?.id, inmobiliariaId],
    queryFn: () => obtenerMetricasCuenta(inmobiliariaId as string),
    enabled: !!user && !!inmobiliariaId,
  })
}
