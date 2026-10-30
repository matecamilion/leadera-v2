import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  desmarcarPaso,
  fijarFechaPrevistaEscritura,
  marcarNoAplica,
  marcarPaso,
  obtenerPasosTramite,
  type TramitePaso,
} from '../lib/api/tramite'
import { claves } from '../lib/queryKeys'
import type { PasoTramite } from '../lib/tramite'
import { useUid } from './useUid'

/**
 * Las filas del trámite de una operación. La clave cuelga de
 * `claves.operaciones`, así que lo que invalida a las operaciones lo refresca.
 */
export function useTramiteOperacion(operacionId: string | undefined) {
  const uid = useUid()
  return useQuery<TramitePaso[]>({
    queryKey: claves.operaciones.tramite(uid, operacionId ?? ''),
    queryFn: () => obtenerPasosTramite(operacionId as string),
    enabled: !!uid && Boolean(operacionId),
  })
}

/** Una escritura sobre el trámite que, al terminar, refresca el de esa operación. */
function useMutacionTramite<Variables>(
  operacionId: string,
  escribir: (variables: Variables) => Promise<TramitePaso>,
) {
  const queryClient = useQueryClient()
  const uid = useUid()

  return useMutation({
    mutationFn: escribir,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: claves.operaciones.tramite(uid, operacionId) }),
  })
}

export function useMarcarPaso(operacionId: string) {
  return useMutacionTramite(
    operacionId,
    ({ paso, fecha }: { paso: PasoTramite; fecha?: string }) =>
      marcarPaso(operacionId, paso, fecha),
  )
}

export function useMarcarNoAplica(operacionId: string) {
  return useMutacionTramite(operacionId, (paso: PasoTramite) => marcarNoAplica(operacionId, paso))
}

export function useDesmarcarPaso(operacionId: string) {
  return useMutacionTramite(operacionId, (paso: PasoTramite) => desmarcarPaso(operacionId, paso))
}

export function useFijarFechaPrevistaEscritura(operacionId: string) {
  return useMutacionTramite(operacionId, (fecha: string | null) =>
    fijarFechaPrevistaEscritura(operacionId, fecha),
  )
}
