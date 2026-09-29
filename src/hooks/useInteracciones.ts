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
import { claves } from '../lib/queryKeys'
import { useUid } from './useUid'

export function useInteraccionesPorLead(leadId: string | undefined) {
  const uid = useUid()
  return useQuery<Interaccion[]>({
    queryKey: claves.interacciones.deLead(uid, leadId ?? ''),
    queryFn: () => listarInteraccionesPorLead(leadId as string),
    enabled: !!uid && Boolean(leadId),
  })
}

export function useCrearInteraccion() {
  const queryClient = useQueryClient()
  const uid = useUid()

  return useMutation({
    mutationFn: (input: CrearInteraccionInput) => crearInteraccion(input),
    onSuccess: (_interaccion, input) => {
      // El timeline de la ficha.
      queryClient.invalidateQueries({ queryKey: claves.interacciones.deLead(uid, input.lead_id) })
      // La ficha: el trigger le movió las fechas de contacto.
      queryClient.invalidateQueries({ queryKey: claves.lead.detalle(uid, input.lead_id) })
      // El listado de Fase 4a-i: cambia el orden de prioridad y el "último
      // contacto", y el lead puede haber dejado de ser "nuevo".
      queryClient.invalidateQueries({ queryKey: claves.leads.raiz })
      // Los conteos por lead que alimentan la tabla y las cards del listado
      // viven bajo su propia raíz, que `claves.leads` no alcanza.
      queryClient.invalidateQueries({ queryKey: claves.interaccionesPorLead.raiz })
      // Una VISITA o REUNION suma a las actividades verdes de la semana.
      queryClient.invalidateQueries({ queryKey: claves.modeloGestion.semana(uid) })
    },
  })
}

/**
 * Invalidación compartida por la edición y el borrado.
 *
 * `claves.interacciones.raiz` como prefijo alcanza para el historial del lead y
 * para el timeline de la operación —`deOperacion` cuelga de la misma raíz—, así
 * que tocar una interacción cargada desde una operación refresca las dos
 * pantallas sin wiring extra.
 *
 * La ficha del lead y el listado entran igual que en el alta: las fechas de
 * contacto y el conteo por lead salen de estas filas.
 */
function useInvalidarInteracciones(leadId: string) {
  const queryClient = useQueryClient()
  const uid = useUid()
  return () => {
    queryClient.invalidateQueries({ queryKey: claves.interacciones.raiz })
    queryClient.invalidateQueries({ queryKey: claves.lead.detalle(uid, leadId) })
    queryClient.invalidateQueries({ queryKey: claves.leads.raiz })
    queryClient.invalidateQueries({ queryKey: claves.interaccionesPorLead.raiz })
    // Cambiar el tipo o borrar una VISITA/REUNION mueve las actividades verdes.
    queryClient.invalidateQueries({ queryKey: claves.modeloGestion.semana(uid) })
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
