import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  listarInteraccionesPorOperacion,
  type Interaccion,
} from '../lib/api/interacciones'
import {
  actualizarEstadoOperacion,
  actualizarOperacion,
  actualizarSeguimientoOperacion,
  eliminarOperacion,
  listarOperacionesPorLead,
  listarOperacionesPorPropiedad,
  type CamposEditablesOperacion,
  type EstadoOperacion,
  type OperacionDetalle,
} from '../lib/api/operaciones'
import { obtenerOperacionPorId } from '../lib/api/operaciones'
import { claves } from '../lib/queryKeys'
import { useUid } from './useUid'

export function useOperacion(id: string | undefined) {
  const uid = useUid()
  return useQuery<OperacionDetalle | null>({
    queryKey: claves.operacion.detalle(uid, id ?? ''),
    queryFn: () => obtenerOperacionPorId(id as string),
    enabled: !!uid && Boolean(id),
  })
}

/**
 * Los eventos de una operación son interacciones con `operacion_id`, así que la
 * clave cuelga de `claves.interacciones.raiz`: lo que ya invalida el historial
 * del lead refresca también este timeline, sin wiring extra.
 */
export function useEventosOperacion(operacionId: string | undefined) {
  const uid = useUid()
  return useQuery<Interaccion[]>({
    queryKey: claves.interacciones.deOperacion(uid, operacionId ?? ''),
    queryFn: () => listarInteraccionesPorOperacion(operacionId as string),
    enabled: !!uid && Boolean(operacionId),
  })
}

/**
 * Invalidación cruzada.
 *
 * Además de la ficha y el listado general, hay que tocar las claves de las
 * dos pantallas que ahora muestran operaciones: la tab del lead y la sección
 * de la propiedad. Sin esto, cambiar un estado acá dejaría al lead mostrando
 * el valor viejo hasta un refresh manual.
 */
function useInvalidarOperacion(
  id: string,
  leadId: string | null,
  propiedadId: string | null,
) {
  const queryClient = useQueryClient()
  const uid = useUid()
  return () => {
    queryClient.invalidateQueries({ queryKey: claves.operacion.detalle(uid, id) })
    queryClient.invalidateQueries({ queryKey: claves.operaciones.raiz })
    if (leadId) {
      queryClient.invalidateQueries({ queryKey: claves.operacionesPorLead.deLead(uid, leadId) })
    }
    if (propiedadId) {
      queryClient.invalidateQueries({
        queryKey: claves.operacionesPorPropiedad.dePropiedad(uid, propiedadId),
      })
    }
  }
}

export function useActualizarEstadoOperacion(
  id: string,
  leadId: string | null,
  propiedadId: string | null,
) {
  const queryClient = useQueryClient()
  const uid = useUid()
  const invalidar = useInvalidarOperacion(id, leadId, propiedadId)

  return useMutation({
    mutationFn: (estado: EstadoOperacion) => actualizarEstadoOperacion(id, estado),
    onSuccess: (operacion) => {
      // El update ya devolvió la fila: la dejamos en cache para que el stepper
      // se mueva sin esperar al refetch, conservando los joins.
      queryClient.setQueryData<OperacionDetalle | null>(claves.operacion.detalle(uid, id), (prev) =>
        prev ? { ...prev, ...operacion } : prev,
      )
      invalidar()
    },
  })
}

/** Agenda o limpia el próximo seguimiento de la operación. */
export function useActualizarSeguimientoOperacion(
  id: string,
  leadId: string | null,
  propiedadId: string | null,
) {
  const queryClient = useQueryClient()
  const uid = useUid()
  const invalidar = useInvalidarOperacion(id, leadId, propiedadId)

  return useMutation({
    mutationFn: (fecha: string | null) => actualizarSeguimientoOperacion(id, fecha),
    onSuccess: (operacion) => {
      queryClient.setQueryData<OperacionDetalle | null>(claves.operacion.detalle(uid, id), (prev) =>
        prev ? { ...prev, ...operacion } : prev,
      )
      invalidar()
    },
  })
}

/**
 * Edita los campos de la ficha.
 *
 * El vínculo puede cambiar en esta misma mutación, así que además de invalidar
 * el lead y la propiedad de ANTES —los que llegan por parámetro— hay que
 * invalidar los de DESPUÉS, que salen de la fila devuelta. Sin eso, mover una
 * operación de un lead a otro dejaría la tab del lead nuevo sin mostrarla.
 */
export function useActualizarOperacion(
  id: string,
  leadId: string | null,
  propiedadId: string | null,
) {
  const queryClient = useQueryClient()
  const uid = useUid()
  const invalidar = useInvalidarOperacion(id, leadId, propiedadId)

  return useMutation({
    mutationFn: (campos: CamposEditablesOperacion) => actualizarOperacion(id, campos),
    onSuccess: (operacion) => {
      queryClient.setQueryData<OperacionDetalle | null>(claves.operacion.detalle(uid, id), (prev) =>
        prev ? { ...prev, ...operacion } : prev,
      )
      invalidar()

      if (operacion.lead_id && operacion.lead_id !== leadId) {
        queryClient.invalidateQueries({
          queryKey: claves.operacionesPorLead.deLead(uid, operacion.lead_id),
        })
      }
      if (operacion.propiedad_id && operacion.propiedad_id !== propiedadId) {
        queryClient.invalidateQueries({
          queryKey: claves.operacionesPorPropiedad.dePropiedad(uid, operacion.propiedad_id),
        })
      }
      // Los joins (nombre del lead, dirección de la propiedad) no vienen en la
      // fila del update: se refetchea la ficha para traerlos resueltos.
      queryClient.invalidateQueries({ queryKey: claves.operacion.detalle(uid, id) })
    },
  })
}

/**
 * Borra la operación.
 *
 * Se le pasan lead y propiedad porque después del borrado ya no hay fila de
 * donde sacarlos, y las dos pantallas que la listaban tienen que enterarse.
 */
export function useEliminarOperacion(
  leadId: string | null,
  propiedadId: string | null,
) {
  const queryClient = useQueryClient()
  const uid = useUid()

  return useMutation({
    mutationFn: (id: string) => eliminarOperacion(id),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: claves.operacion.detalle(uid, id) })
      queryClient.invalidateQueries({ queryKey: claves.operaciones.raiz })
      if (leadId) {
        queryClient.invalidateQueries({ queryKey: claves.operacionesPorLead.deLead(uid, leadId) })
      }
      if (propiedadId) {
        queryClient.invalidateQueries({
          queryKey: claves.operacionesPorPropiedad.dePropiedad(uid, propiedadId),
        })
      }
    },
  })
}

/** Operaciones de un lead — alimenta la tab de su ficha. */
export function useOperacionesPorLead(leadId: string | undefined) {
  const uid = useUid()
  return useQuery({
    queryKey: claves.operacionesPorLead.deLead(uid, leadId),
    queryFn: () => listarOperacionesPorLead(leadId as string),
    enabled: !!uid && Boolean(leadId),
  })
}

/** Operaciones de una propiedad — alimenta la sección de su ficha. */
export function useOperacionesPorPropiedad(propiedadId: string | undefined) {
  const uid = useUid()
  return useQuery({
    queryKey: claves.operacionesPorPropiedad.dePropiedad(uid, propiedadId),
    queryFn: () => listarOperacionesPorPropiedad(propiedadId as string),
    enabled: !!uid && Boolean(propiedadId),
  })
}
