import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  desmarcarPaso,
  fijarFechaPrevistaEscritura,
  generarPostventaSiCorresponde,
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

/**
 * Una escritura sobre el trámite que, al terminar, refresca el de esa operación.
 *
 * Refresca también cuando falla: marcar la escritura puede quedar guardado y
 * fallar recién al agendar la postventa, y la casilla tiene que reflejarlo.
 */
function useMutacionTramite<Variables, Resultado>(
  operacionId: string,
  escribir: (variables: Variables) => Promise<Resultado>,
  alTerminar?: (resultado: Resultado) => void,
) {
  const queryClient = useQueryClient()
  const uid = useUid()

  return useMutation({
    mutationFn: escribir,
    onSuccess: alTerminar,
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: claves.operaciones.tramite(uid, operacionId) }),
  })
}

/**
 * Completa un paso. Si es la escritura y todavía no se generó la postventa, la
 * agenda: `agendadas` es cuántas tareas entraron, o `null` si no correspondía.
 * Las tareas nuevas aparecen en Mi día y en el calendario sin recargar.
 */
export function useMarcarPaso(operacionId: string) {
  const queryClient = useQueryClient()

  return useMutacionTramite(
    operacionId,
    async ({ paso, fecha }: { paso: PasoTramite; fecha?: string }) => {
      const fila = await marcarPaso(operacionId, paso, fecha)
      return { agendadas: await generarPostventaSiCorresponde(fila) }
    },
    ({ agendadas }) => {
      if (agendadas) queryClient.invalidateQueries({ queryKey: claves.tareas.raiz })
    },
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
