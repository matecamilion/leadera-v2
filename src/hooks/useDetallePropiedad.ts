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

export const clavePropiedad = (id: string) => ['propiedad', id] as const

export function useDetallePropiedad(id: string | undefined) {
  return useQuery<PropiedadDetalle | null>({
    queryKey: clavePropiedad(id ?? ''),
    queryFn: () => obtenerPropiedadPorId(id as string),
    enabled: Boolean(id),
  })
}

/** Invalida la ficha abierta y el listado, que muestra estado y precio. */
function useInvalidar(id: string) {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: clavePropiedad(id) })
    queryClient.invalidateQueries({ queryKey: ['propiedades'] })
  }
}

export function useActualizarEstadoPropiedad(id: string) {
  const queryClient = useQueryClient()
  const invalidar = useInvalidar(id)

  return useMutation({
    mutationFn: (estado: EstadoPropiedad) => actualizarEstadoPropiedad(id, estado),
    onSuccess: (propiedad) => {
      // El update ya devolvió la fila; la dejamos en cache para que el header
      // cambie sin esperar al refetch. Conservamos el join del propietario.
      queryClient.setQueryData<PropiedadDetalle | null>(clavePropiedad(id), (prev) =>
        prev ? { ...prev, ...propiedad } : prev,
      )
      invalidar()
    },
  })
}

export function useActualizarPropiedad(id: string) {
  const queryClient = useQueryClient()
  const invalidar = useInvalidar(id)

  return useMutation({
    mutationFn: (campos: CamposEditables) => actualizarPropiedad(id, campos),
    onSuccess: (propiedad) => {
      queryClient.setQueryData<PropiedadDetalle | null>(clavePropiedad(id), (prev) =>
        prev ? { ...prev, ...propiedad } : prev,
      )
      invalidar()
    },
  })
}

export function useEliminarPropiedad() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => eliminarPropiedad(id),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: clavePropiedad(id) })
      queryClient.invalidateQueries({ queryKey: ['propiedades'] })
    },
  })
}
