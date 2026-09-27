import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  actualizarEstadoPropiedad,
  actualizarPropiedad,
  eliminarPropiedad,
  obtenerPropiedadPorId,
  type CamposEditables,
  type EstadoPropiedad,
  type PropiedadDetalle,
} from '../lib/api/propiedades'
import { claves } from '../lib/queryKeys'
import { useUid } from './useUid'

export function useDetallePropiedad(id: string | undefined) {
  const uid = useUid()
  return useQuery<PropiedadDetalle | null>({
    queryKey: claves.propiedad.detalle(uid, id ?? ''),
    queryFn: () => obtenerPropiedadPorId(id as string),
    enabled: !!uid && Boolean(id),
  })
}

/** Invalida la ficha abierta y el listado, que muestra estado y precio. */
function useInvalidar(id: string) {
  const queryClient = useQueryClient()
  const uid = useUid()
  return () => {
    queryClient.invalidateQueries({ queryKey: claves.propiedad.detalle(uid, id) })
    queryClient.invalidateQueries({ queryKey: claves.propiedades.raiz })
  }
}

export function useActualizarEstadoPropiedad(id: string) {
  const queryClient = useQueryClient()
  const uid = useUid()
  const invalidar = useInvalidar(id)

  return useMutation({
    mutationFn: (estado: EstadoPropiedad) => actualizarEstadoPropiedad(id, estado),
    onSuccess: (propiedad) => {
      // El update ya devolvió la fila; la dejamos en cache para que el header
      // cambie sin esperar al refetch. Conservamos el join del propietario.
      queryClient.setQueryData<PropiedadDetalle | null>(claves.propiedad.detalle(uid, id), (prev) =>
        prev ? { ...prev, ...propiedad } : prev,
      )
      invalidar()
    },
  })
}

export function useActualizarPropiedad(id: string) {
  const queryClient = useQueryClient()
  const uid = useUid()
  const invalidar = useInvalidar(id)

  return useMutation({
    mutationFn: (campos: CamposEditables) => actualizarPropiedad(id, campos),
    onSuccess: (propiedad) => {
      queryClient.setQueryData<PropiedadDetalle | null>(claves.propiedad.detalle(uid, id), (prev) =>
        prev ? { ...prev, ...propiedad } : prev,
      )
      invalidar()
    },
  })
}

export function useEliminarPropiedad() {
  const queryClient = useQueryClient()
  const uid = useUid()

  return useMutation({
    mutationFn: (id: string) => eliminarPropiedad(id),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: claves.propiedad.detalle(uid, id) })
      queryClient.invalidateQueries({ queryKey: claves.propiedades.raiz })
    },
  })
}
