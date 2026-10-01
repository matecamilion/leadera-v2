import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  cambiarActivo,
  guardarPreguntas,
  obtenerMiLink,
  type LinkConsulta,
  type PreguntaOpcional,
} from '../lib/api/linksConsulta'
import { claves } from '../lib/queryKeys'
import { useUid } from './useUid'

const GENERAL = 'general'

/**
 * El link del agente: el general (sin `propiedadId`) o el de una propiedad.
 *
 * Es un "obtener o crear" idempotente, así que va como query: la primera vez
 * crea la fila y después sale del cache. `habilitado` deja que el de una
 * propiedad se cree recién cuando alguien lo pide.
 */
export function useMiLink(propiedadId?: string, habilitado = true) {
  const uid = useUid()
  return useQuery({
    queryKey: claves.linksConsulta.mio(uid, propiedadId ?? GENERAL),
    queryFn: () => obtenerMiLink(propiedadId),
    enabled: !!uid && habilitado,
    staleTime: 5 * 60_000,
  })
}

/** Deja la fila nueva en cache: el panel se actualiza sin esperar un refetch. */
function useGuardarEnCache(propiedadId?: string) {
  const queryClient = useQueryClient()
  const uid = useUid()
  return (link: LinkConsulta) =>
    queryClient.setQueryData(claves.linksConsulta.mio(uid, propiedadId ?? GENERAL), link)
}

export function useGuardarPreguntas(propiedadId?: string) {
  const guardar = useGuardarEnCache(propiedadId)
  return useMutation({
    mutationFn: ({ id, preguntasOff }: { id: string; preguntasOff: PreguntaOpcional[] }) =>
      guardarPreguntas(id, preguntasOff),
    onSuccess: guardar,
  })
}

export function useCambiarActivo(propiedadId?: string) {
  const guardar = useGuardarEnCache(propiedadId)
  return useMutation({
    mutationFn: ({ id, activo }: { id: string; activo: boolean }) => cambiarActivo(id, activo),
    onSuccess: guardar,
  })
}
