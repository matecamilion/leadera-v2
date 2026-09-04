import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  cancelarSuscripcion,
  crearSuscripcion,
  listarPreciosPlanes,
  obtenerEstadoSuscripcion,
  type CancelacionConfirmada,
  type EstadoDeMiSuscripcion,
  type Plan,
  type PrecioPlan,
  type SuscripcionCreada,
} from '../lib/api/suscripcion'

/** Todo lo de la suscripción cuelga de esta clave. */
export const CLAVE_SUSCRIPCION = ['suscripcion'] as const

/**
 * Los precios de lista.
 *
 * Se recalculan una vez por semana, así que no tiene sentido pedirlos seguido:
 * `staleTime` largo para no golpear la base en cada visita a la pantalla.
 */
export function usePreciosPlanes() {
  return useQuery<PrecioPlan[]>({
    queryKey: [...CLAVE_SUSCRIPCION, 'precios'],
    queryFn: listarPreciosPlanes,
    staleTime: 10 * 60_000,
  })
}

/**
 * El estado de mi suscripción. Puede ser `null` si la RLS de `inmobiliarias` no
 * deja leer la fila; la pantalla trata ese caso como "no sé".
 */
export function useEstadoSuscripcion() {
  return useQuery<EstadoDeMiSuscripcion | null>({
    queryKey: [...CLAVE_SUSCRIPCION, 'estado'],
    queryFn: obtenerEstadoSuscripcion,
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

  return useMutation<SuscripcionCreada, Error, Plan>({
    mutationFn: crearSuscripcion,
    onError: () => {
      // El intento pudo haber dejado el mp_preapproval_id guardado aunque el
      // usuario no llegue a pagar: el estado en pantalla ya no es confiable.
      qc.invalidateQueries({ queryKey: [...CLAVE_SUSCRIPCION, 'estado'] })
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

  return useMutation<CancelacionConfirmada, Error, void>({
    mutationFn: cancelarSuscripcion,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: [...CLAVE_SUSCRIPCION, 'estado'] })
    },
  })
}
