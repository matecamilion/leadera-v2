import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { obtenerDetalleMatch, type DetalleMatch } from '../lib/api/detalleMatch'
import {
  guardarBusqueda,
  obtenerCoincidencias,
  obtenerCriterios,
  type CriteriosBusqueda,
  type PropiedadCoincidente,
} from '../lib/api/busquedas'
import { claveOperacion } from './useOperacion'

export const claveCoincidencias = (busquedaId: string) =>
  ['coincidencias-busqueda', busquedaId] as const

/** Criterios ya guardados, para precargar el formulario de edición. */
export function useCriteriosBusqueda(busquedaId: string | null | undefined) {
  return useQuery<CriteriosBusqueda | null>({
    queryKey: ['busqueda', busquedaId],
    queryFn: () => obtenerCriterios(busquedaId as string),
    enabled: Boolean(busquedaId),
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

  return useMutation({
    mutationFn: ({ operacionId, leadId, criterios }: GuardarInput) =>
      guardarBusqueda(operacionId, leadId, criterios),
    onSuccess: (busquedaId, { operacionId }) => {
      queryClient.invalidateQueries({ queryKey: claveOperacion(operacionId) })
      queryClient.invalidateQueries({ queryKey: ['busqueda', busquedaId] })
      queryClient.invalidateQueries({ queryKey: claveCoincidencias(busquedaId) })
      // El selector de búsquedas del alta lista las del lead.
      queryClient.invalidateQueries({ queryKey: ['busquedas-de-lead'] })
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
  return useQuery<PropiedadCoincidente[]>({
    queryKey: claveCoincidencias(busquedaId ?? ''),
    queryFn: () => obtenerCoincidencias(busquedaId as string),
    enabled: Boolean(busquedaId),
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
  return useQuery<DetalleMatch | null>({
    queryKey: ['detalle-match', busquedaId, propiedadId],
    queryFn: () => obtenerDetalleMatch(busquedaId as string, propiedadId as string),
    enabled: Boolean(busquedaId && propiedadId),
  })
}
