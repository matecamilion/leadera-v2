import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import {
  cancelarSuscripcion,
  crearSuscripcion,
  listarPagos,
  listarPreciosPlanes,
  obtenerEstadoSuscripcion,
  type CancelacionConfirmada,
  type EstadoDeMiSuscripcion,
  type PagoDelHistorial,
  type Plan,
  type PrecioPlan,
  type SuscripcionCreada,
} from '../lib/api/suscripcion'
import { claves } from '../lib/queryKeys'
import { useUid } from './useUid'

/**
 * Los precios de lista.
 *
 * Se recalculan una vez por semana, así que no tiene sentido pedirlos seguido:
 * `staleTime` largo para no golpear la base en cada visita a la pantalla.
 */
export function usePreciosPlanes() {
  return useQuery<PrecioPlan[]>({
    queryKey: claves.suscripcion.precios(),
    queryFn: listarPreciosPlanes,
    staleTime: 10 * 60_000,
  })
}

/**
 * El estado de mi suscripción. Puede ser `null` si la RLS de `inmobiliarias` no
 * deja leer la fila; la pantalla trata ese caso como "no sé".
 *
 * El id sale del `profile` de `AuthContext`, que carga aparte de la sesión:
 * hasta que llega —o si no trae inmobiliaria— la query queda deshabilitada.
 * Ojo quien espere con `isPending`: una query deshabilitada queda pending para
 * siempre. Para un spinner va `isLoading`, que sólo es true si está pidiendo.
 */
export function useEstadoSuscripcion() {
  const uid = useUid()
  const inmobiliariaId = useAuth().profile?.inmobiliaria_id
  return useQuery<EstadoDeMiSuscripcion | null>({
    queryKey: claves.suscripcion.estado(uid, inmobiliariaId),
    queryFn: () => obtenerEstadoSuscripcion(inmobiliariaId!),
    enabled: !!uid && !!inmobiliariaId,
  })
}

/**
 * Arranca el checkout.
 *
 * No invalida nada en el success: el flujo termina en una redirección a Mercado
 * Pago, así que esta pestaña se va. Al volver, la pantalla se monta de nuevo y
 * vuelve a pedir el estado.
 */
export function useCrearSuscripcion() {
  const qc = useQueryClient()
  const uid = useUid()
  const inmobiliariaId = useAuth().profile?.inmobiliaria_id

  return useMutation<SuscripcionCreada, Error, Plan>({
    mutationFn: crearSuscripcion,
    onError: () => {
      // El intento pudo haber dejado el mp_preapproval_id guardado aunque el
      // usuario no llegue a pagar: el estado en pantalla ya no es confiable.
      qc.invalidateQueries({ queryKey: claves.suscripcion.estado(uid, inmobiliariaId) })
    },
  })
}

/**
 * Da de baja la suscripción.
 *
 * Se invalida el estado pase lo que pase: si salió bien hay que releer
 * `cancelacion_solicitada`, y si falló no sabemos en qué punto quedó (Mercado
 * Pago pudo haber cancelado y haber fallado el registro).
 */
export function useCancelarSuscripcion() {
  const qc = useQueryClient()
  const uid = useUid()
  const inmobiliariaId = useAuth().profile?.inmobiliaria_id

  return useMutation<CancelacionConfirmada, Error, void>({
    mutationFn: cancelarSuscripcion,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: claves.suscripcion.estado(uid, inmobiliariaId) })
    },
  })
}

/**
 * El historial de cobros de mi inmobiliaria.
 *
 * Queda deshabilitado hasta tener el id: sale del profile, que carga aparte de
 * la sesión, y sin él la query traería el historial de nadie.
 */
export function usePagos(inmobiliariaId: string | undefined) {
  const uid = useUid()
  return useQuery<PagoDelHistorial[]>({
    queryKey: claves.suscripcion.pagos(uid, inmobiliariaId),
    queryFn: () => listarPagos(inmobiliariaId!),
    enabled: !!uid && inmobiliariaId != null,
  })
}
