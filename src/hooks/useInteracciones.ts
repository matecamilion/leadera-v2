import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  actualizarInteraccion,
  crearInteraccion,
  eliminarInteraccion,
  listarInteraccionesPorLead,
  type CamposEditablesInteraccion,
  type CrearInteraccionInput,
  type Interaccion,
} from '../lib/api/interacciones'
import { claveLead } from './useLead'

export const claveInteracciones = (leadId: string) =>
  ['interacciones', leadId] as const

export function useInteraccionesPorLead(leadId: string | undefined) {
  return useQuery<Interaccion[]>({
    queryKey: claveInteracciones(leadId ?? ''),
    queryFn: () => listarInteraccionesPorLead(leadId as string),
    enabled: Boolean(leadId),
  })
}

export function useCrearInteraccion() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CrearInteraccionInput) => crearInteraccion(input),
    onSuccess: (_interaccion, input) => {
      // El timeline de la ficha.
      queryClient.invalidateQueries({ queryKey: claveInteracciones(input.lead_id) })
      // La ficha: el trigger le movió las fechas de contacto.
      queryClient.invalidateQueries({ queryKey: claveLead(input.lead_id) })
      // El listado de Fase 4a-i: cambia el orden de prioridad y el "último
      // contacto", y el lead puede haber dejado de ser "nuevo".
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      // Los conteos por lead que alimentan la tabla y las cards del listado
      // viven bajo su propia clave, que `['leads']` no alcanza.
      queryClient.invalidateQueries({ queryKey: ['interacciones-por-lead'] })
    },
  })
}

/**
 * Invalidación compartida por la edición y el borrado.
 *
 * `['interacciones']` como prefijo alcanza para el historial del lead y para
 * el timeline de la operación —`claveEventos` cuelga de la misma raíz—, así
 * que tocar una interacción cargada desde una operación refresca las dos
 * pantallas sin wiring extra.
 *
 * La ficha del lead y el listado entran igual que en el alta: las fechas de
 * contacto y el conteo por lead salen de estas filas.
 */
function useInvalidarInteracciones(leadId: string) {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ['interacciones'] })
    queryClient.invalidateQueries({ queryKey: claveLead(leadId) })
    queryClient.invalidateQueries({ queryKey: ['leads'] })
    queryClient.invalidateQueries({ queryKey: ['interacciones-por-lead'] })
  }
}

/**
 * Edita tipo, detalle y fecha.
 *
 * La ventana de 24hs y el permiso los aplica la base; el hook sólo propaga el
 * error que la capa de API ya tradujo.
 */
export function useActualizarInteraccion(leadId: string) {
  const invalidar = useInvalidarInteracciones(leadId)

  return useMutation({
    mutationFn: ({ id, campos }: { id: string; campos: CamposEditablesInteraccion }) =>
      actualizarInteraccion(id, campos),
    onSuccess: invalidar,
  })
}

export function useEliminarInteraccion(leadId: string) {
  const invalidar = useInvalidarInteracciones(leadId)

  return useMutation({
    mutationFn: (id: string) => eliminarInteraccion(id),
    onSuccess: invalidar,
  })
}
