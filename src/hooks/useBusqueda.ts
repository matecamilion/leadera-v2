import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { obtenerDetalleMatch, type DetalleMatch } from '../lib/api/detalleMatch'
import {
  guardarBusqueda,
  obtenerCoincidencias,
  obtenerCriterios,
  type CriteriosBusqueda,
  type PropiedadCoincidente,
} from '../lib/api/busquedas'
import { claves } from '../lib/queryKeys'
import { useUid } from './useUid'

/** Criterios ya guardados, para precargar el formulario de edición. */
export function useCriteriosBusqueda(busquedaId: string | null | undefined) {
  const uid = useUid()
  return useQuery<CriteriosBusqueda | null>({
    queryKey: claves.busqueda.criterios(uid, busquedaId),
    queryFn: () => obtenerCriterios(busquedaId as string),
    enabled: !!uid && Boolean(busquedaId),
  })
}

interface GuardarInput {
  operacionId: string
  leadId: string
  criterios: CriteriosBusqueda
}

/**
 * Guarda los criterios y refresca lo que depende de ellos.
 *
 * Invalida la ficha de la operación porque el alta de una búsqueda le escribe
 * `busqueda_id`, y las coincidencias porque los criterios que las generan
 * acaban de cambiar.
 */
export function useGuardarBusqueda() {
  const queryClient = useQueryClient()
  const uid = useUid()

  return useMutation({
    mutationFn: ({ operacionId, leadId, criterios }: GuardarInput) =>
      guardarBusqueda(operacionId, leadId, criterios),
    onSuccess: (busquedaId, { operacionId }) => {
      queryClient.invalidateQueries({ queryKey: claves.operacion.detalle(uid, operacionId) })
      queryClient.invalidateQueries({ queryKey: claves.busqueda.criterios(uid, busquedaId) })
      queryClient.invalidateQueries({
        queryKey: claves.coincidenciasBusqueda.deBusqueda(uid, busquedaId),
      })
      // El selector de búsquedas del alta lista las del lead.
      queryClient.invalidateQueries({ queryKey: claves.busquedasDeLead.raiz })
    },
  })
}

/**
 * Propiedades que matchean, con su score.
 *
 * `staleTime` en 0: el catálogo de propiedades cambia por fuera de esta
 * pantalla, así que volver a entrar tiene que volver a puntuar.
 */
export function useCoincidenciasBusqueda(busquedaId: string | null | undefined) {
  const uid = useUid()
  return useQuery<PropiedadCoincidente[]>({
    queryKey: claves.coincidenciasBusqueda.deBusqueda(uid, busquedaId ?? ''),
    queryFn: () => obtenerCoincidencias(busquedaId as string),
    enabled: !!uid && Boolean(busquedaId),
    staleTime: 0,
  })
}

/**
 * La búsqueda y la propiedad de una coincidencia, para la pantalla de detalle.
 *
 * `data === null` no es un error: es "esta coincidencia ya no está vigente".
 * La pantalla lo distingue de `isError` y muestra una salida, no un fallo.
 */
export function useDetalleMatch(
  busquedaId: string | undefined,
  propiedadId: string | undefined,
) {
  const uid = useUid()
  return useQuery<DetalleMatch | null>({
    queryKey: claves.detalleMatch.detalle(uid, busquedaId, propiedadId),
    queryFn: () => obtenerDetalleMatch(busquedaId as string, propiedadId as string),
    enabled: !!uid && Boolean(busquedaId && propiedadId),
  })
}
