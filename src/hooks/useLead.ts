import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  actualizarContacto,
  actualizarEstado,
  crearLead,
  eliminarLead,
  obtenerLeadPorId,
  obtenerNombreAgente,
  type ContactoLead,
  type CrearLeadInput,
  type EstadoLead,
  type Lead,
} from '../lib/api/leads'

export const claveLead = (id: string) => ['lead', id] as const

/** Un lead por id. `data === null` = no existe o RLS lo tapa. */
export function useLead(id: string | undefined) {
  return useQuery<Lead | null>({
    queryKey: claveLead(id ?? ''),
    queryFn: () => obtenerLeadPorId(id as string),
    enabled: Boolean(id),
  })
}

/**
 * Invalidación compartida por todas las mutaciones.
 *
 * `['leads']` cubre el listado, el contador del chip "Todos" y los conteos
 * por lead de Fase 4a-i; `['lead', id]` es la ficha abierta.
 */
function useInvalidarLead() {
  const queryClient = useQueryClient()
  return (id?: string) => {
    queryClient.invalidateQueries({ queryKey: ['leads'] })
    if (id) queryClient.invalidateQueries({ queryKey: claveLead(id) })
  }
}

export function useCrearLead() {
  const invalidar = useInvalidarLead()

  return useMutation({
    mutationFn: (input: CrearLeadInput) => crearLead(input),
    onSuccess: (lead) => invalidar(lead.id),
  })
}

export function useActualizarContacto(id: string) {
  const queryClient = useQueryClient()
  const invalidar = useInvalidarLead()

  return useMutation({
    mutationFn: (contacto: ContactoLead) => actualizarContacto(id, contacto),
    onSuccess: (lead) => {
      // El update ya devolvió la fila: la dejamos en cache para que la ficha
      // se actualice sin esperar al refetch.
      queryClient.setQueryData(claveLead(id), lead)
      invalidar(id)
    },
  })
}

export function useActualizarEstado(id: string) {
  const queryClient = useQueryClient()
  const invalidar = useInvalidarLead()

  return useMutation({
    mutationFn: (estado: EstadoLead | null) => actualizarEstado(id, estado),
    onSuccess: (lead) => {
      queryClient.setQueryData(claveLead(id), lead)
      invalidar(id)
    },
  })
}

export function useEliminarLead() {
  const queryClient = useQueryClient()
  const invalidar = useInvalidarLead()

  return useMutation({
    mutationFn: (id: string) => eliminarLead(id),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: claveLead(id) })
      invalidar()
    },
  })
}

/**
 * Nombre del agente asignado a un lead.
 *
 * Clave propia —`['agente', id]`— y no colgada de la del lead: el perfil no
 * cambia cuando cambia el lead, y así dos fichas del mismo agente comparten la
 * entrada en vez de pedirlo dos veces.
 */
export function useNombreAgente(agenteId: string | null | undefined) {
  return useQuery<string | null>({
    queryKey: ['agente', agenteId],
    queryFn: () => obtenerNombreAgente(agenteId as string),
    enabled: Boolean(agenteId),
  })
}
