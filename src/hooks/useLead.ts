import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  actualizarContacto,
  actualizarDescripcion,
  actualizarEstado,
  asignarLead,
  crearLead,
  eliminarLead,
  obtenerLeadPorId,
  obtenerNombreAgente,
  type ContactoLead,
  type CrearLeadInput,
  type EstadoLead,
  type Lead,
} from '../lib/api/leads'
import { claves } from '../lib/queryKeys'
import { useUid } from './useUid'

/** Un lead por id. `data === null` = no existe o RLS lo tapa. */
export function useLead(id: string | undefined) {
  const uid = useUid()
  return useQuery<Lead | null>({
    queryKey: claves.lead.detalle(uid, id ?? ''),
    queryFn: () => obtenerLeadPorId(id as string),
    enabled: !!uid && Boolean(id),
  })
}

/**
 * Invalidación compartida por todas las mutaciones.
 *
 * `claves.leads.raiz` cubre el listado, el contador del chip "Todos" y los
 * conteos por lead de Fase 4a-i; `claves.lead.detalle` es la ficha abierta.
 */
function useInvalidarLead() {
  const queryClient = useQueryClient()
  const uid = useUid()
  return (id?: string) => {
    queryClient.invalidateQueries({ queryKey: claves.leads.raiz })
    if (id) queryClient.invalidateQueries({ queryKey: claves.lead.detalle(uid, id) })
  }
}

export function useCrearLead() {
  const invalidar = useInvalidarLead()
  const queryClient = useQueryClient()
  const uid = useUid()

  return useMutation({
    mutationFn: (input: CrearLeadInput) => crearLead(input),
    onSuccess: (lead) => {
      invalidar(lead.id)
      // Un lead REFERIDO o MANUAL suma a los nuevos contactos del día y la semana.
      queryClient.invalidateQueries({ queryKey: claves.modeloGestion.resumen(uid) })
      // Si el lead nació con fecha de próximo seguimiento, la agenda la muestra.
      queryClient.invalidateQueries({ queryKey: claves.tareas.raiz })
    },
  })
}

export function useActualizarContacto(id: string) {
  const queryClient = useQueryClient()
  const uid = useUid()
  const invalidar = useInvalidarLead()

  return useMutation({
    mutationFn: (contacto: ContactoLead) => actualizarContacto(id, contacto),
    onSuccess: (lead) => {
      // El update ya devolvió la fila: la dejamos en cache para que la ficha
      // se actualice sin esperar al refetch.
      queryClient.setQueryData(claves.lead.detalle(uid, id), lead)
      invalidar(id)
    },
  })
}

export function useActualizarDescripcion(id: string) {
  const queryClient = useQueryClient()
  const uid = useUid()
  const invalidar = useInvalidarLead()

  return useMutation({
    mutationFn: (descripcion: string) => actualizarDescripcion(id, descripcion),
    onSuccess: (lead) => {
      queryClient.setQueryData(claves.lead.detalle(uid, id), lead)
      invalidar(id)
    },
  })
}

export function useActualizarEstado(id: string) {
  const queryClient = useQueryClient()
  const uid = useUid()
  const invalidar = useInvalidarLead()

  return useMutation({
    mutationFn: (estado: EstadoLead | null) => actualizarEstado(id, estado),
    onSuccess: (lead) => {
      queryClient.setQueryData(claves.lead.detalle(uid, id), lead)
      invalidar(id)
    },
  })
}

/**
 * Asignar un lead a otro miembro.
 *
 * Todo lo que cuelga de `claves.leads.raiz` se refresca: el listado y sus
 * totales, el badge del menú, Mi día (secciones y contactados) y el conteo de
 * asignados del asistente. Además la ficha y el equipo, que cuenta por
 * `asignado_a`.
 */
export function useAsignarLead(id: string) {
  const queryClient = useQueryClient()
  const uid = useUid()
  const invalidar = useInvalidarLead()

  return useMutation({
    mutationFn: (asignadoA: string) => asignarLead(id, asignadoA),
    onSuccess: (lead) => {
      queryClient.setQueryData(claves.lead.detalle(uid, id), lead)
      invalidar(id)
      queryClient.invalidateQueries({ queryKey: claves.equipo.raiz })
    },
  })
}

export function useEliminarLead() {
  const queryClient = useQueryClient()
  const uid = useUid()
  const invalidar = useInvalidarLead()

  return useMutation({
    mutationFn: (id: string) => eliminarLead(id),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: claves.lead.detalle(uid, id) })
      invalidar()
    },
  })
}

/**
 * Nombre del agente asignado a un lead.
 *
 * Clave propia —`claves.agente`— y no colgada de la del lead: el perfil no
 * cambia cuando cambia el lead, y así dos fichas del mismo agente comparten la
 * entrada en vez de pedirlo dos veces.
 */
export function useNombreAgente(agenteId: string | null | undefined) {
  const uid = useUid()
  return useQuery<string | null>({
    queryKey: claves.agente.nombre(uid, agenteId),
    queryFn: () => obtenerNombreAgente(agenteId as string),
    enabled: !!uid && Boolean(agenteId),
  })
}
