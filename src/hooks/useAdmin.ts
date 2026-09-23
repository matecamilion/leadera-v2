import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import {
  ajustarVencimiento,
  anularPago,
  extenderTrial,
  setTipoCuenta,
  suspenderCuenta,
  historialCobros,
  obtenerMetricasCuenta,
  obtenerPanelAdmin,
  registrarPagoManual,
  type AjusteVencimientoInput,
  type DatosPanelAdmin,
  type MetricasUsoCuenta,
  type MovimientoCobro,
  type PagoManualInput,
  type TipoCuenta,
} from '../lib/api/admin'

/** Todo lo del panel cuelga de esta clave. */
export const CLAVE_ADMIN = ['admin'] as const

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
    queryKey: [...CLAVE_ADMIN, 'panel', user?.id],
    queryFn: () => obtenerPanelAdmin(),
    enabled: !!user,
  })
}

/** Conteos de uso de una inmobiliaria, para /admin/inmobiliarias/:id. */
export function useMetricasCuenta(inmobiliariaId: string | undefined) {
  const { user } = useAuth()
  return useQuery<MetricasUsoCuenta>({
    queryKey: [...CLAVE_ADMIN, 'metricas', user?.id, inmobiliariaId],
    queryFn: () => obtenerMetricasCuenta(inmobiliariaId as string),
    enabled: !!user && !!inmobiliariaId,
  })
}

/** Los movimientos de cobro de una cuenta: pagos manuales, de MP y ajustes. */
export function useHistorialCobros(inmobiliariaId: string | undefined) {
  const { user } = useAuth()
  return useQuery<MovimientoCobro[]>({
    queryKey: [...CLAVE_ADMIN, 'cobros', user?.id, inmobiliariaId],
    queryFn: () => historialCobros(inmobiliariaId as string),
    enabled: !!user && !!inmobiliariaId,
  })
}

/**
 * Qué refrescar después de tocar el cobro de una cuenta.
 *
 * `['admin']` como prefijo alcanza para las tres consultas del panel: el
 * listado —donde cambian el estado, el método y el vencimiento—, el historial
 * de cobros y las métricas. Invalidar de más acá cuesta tres queries livianas;
 * invalidar de menos deja la pantalla mintiendo después de cobrar.
 */
function useInvalidarAdmin() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: CLAVE_ADMIN })
}

export function useRegistrarPagoManual() {
  const invalidar = useInvalidarAdmin()

  return useMutation({
    mutationFn: (input: PagoManualInput) => registrarPagoManual(input),
    onSuccess: invalidar,
  })
}

export function useAjustarVencimiento() {
  const invalidar = useInvalidarAdmin()

  return useMutation({
    mutationFn: (input: AjusteVencimientoInput) => ajustarVencimiento(input),
    onSuccess: invalidar,
  })
}

export function useSetTipoCuenta() {
  const invalidar = useInvalidarAdmin()

  return useMutation({
    mutationFn: ({ inmobiliariaId, tipo }: { inmobiliariaId: string; tipo: TipoCuenta }) =>
      setTipoCuenta(inmobiliariaId, tipo),
    onSuccess: invalidar,
  })
}

export function useAnularPago() {
  const invalidar = useInvalidarAdmin()

  return useMutation({
    mutationFn: ({ eventoId, nota }: { eventoId: string; nota: string }) =>
      anularPago(eventoId, nota),
    onSuccess: invalidar,
  })
}

export function useExtenderTrial() {
  const invalidar = useInvalidarAdmin()

  return useMutation({
    mutationFn: ({
      inmobiliariaId,
      dias,
      nota,
    }: {
      inmobiliariaId: string
      dias: number
      nota: string
    }) => extenderTrial(inmobiliariaId, dias, nota),
    onSuccess: invalidar,
  })
}

export function useSuspenderCuenta() {
  const invalidar = useInvalidarAdmin()

  return useMutation({
    mutationFn: ({ inmobiliariaId, nota }: { inmobiliariaId: string; nota: string }) =>
      suspenderCuenta(inmobiliariaId, nota),
    onSuccess: invalidar,
  })
}
