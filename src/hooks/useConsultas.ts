import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import {
  aceptarConsulta,
  contarPendientes,
  descartarConsulta,
  listarConsultas,
  listarVolvieron,
  obtenerResumenConsultas,
  vincularConsulta,
  type Consulta,
  type FiltroConsultas,
} from '../lib/api/consultas'
import { anteriorDelMismoUsuario, claves } from '../lib/queryKeys'
import { useUid } from './useUid'

/** Cada cuánto se refresca el badge con la pestaña visible. */
const INTERVALO_PENDIENTES_MS = 60_000

export function useConsultas(filtro: FiltroConsultas, page: number, agenteId: string) {
  const uid = useUid()
  return useQuery({
    queryKey: claves.consultas.lista(uid, filtro, agenteId, page),
    queryFn: () => listarConsultas(filtro, page, agenteId || undefined),
    enabled: !!uid,
    placeholderData: anteriorDelMismoUsuario(uid),
  })
}

export function useVolvieronAConsultar(agenteId: string, habilitado: boolean) {
  const uid = useUid()
  return useQuery({
    queryKey: claves.consultas.volvieron(uid, agenteId),
    queryFn: () => listarVolvieron(agenteId || undefined),
    enabled: !!uid && habilitado,
  })
}

/**
 * El número del badge. Polling cada 60 s, solo con la pestaña visible, y
 * refetch al volver a la pestaña: la app tiene `refetchOnWindowFocus` apagado,
 * pero una consulta nueva es justo lo que hay que ver al volver.
 */
export function usePendientesConsultas() {
  const uid = useUid()
  const { profile } = useAuth()
  return useQuery({
    queryKey: claves.consultas.pendientes(uid, profile?.rol),
    queryFn: () => contarPendientes(profile?.rol, uid as string),
    enabled: !!uid && !!profile,
    refetchInterval: INTERVALO_PENDIENTES_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  })
}

export function useResumenConsultas() {
  const uid = useUid()
  const { profile } = useAuth()
  return useQuery({
    queryKey: claves.consultas.resumen(uid, profile?.rol),
    queryFn: () => obtenerResumenConsultas(profile?.rol, uid as string),
    enabled: !!uid && !!profile,
    refetchOnWindowFocus: true,
  })
}

/**
 * Después de cualquier acción: la bandeja, el badge y Mi día (`consultas`), y
 * si entró un lead, todo lo que cuelga de `leads` y el uso del plan.
 */
function useInvalidarConsultas() {
  const queryClient = useQueryClient()
  return (entroUnLead: boolean) => {
    queryClient.invalidateQueries({ queryKey: claves.consultas.raiz })
    if (entroUnLead) {
      queryClient.invalidateQueries({ queryKey: claves.leads.raiz })
      queryClient.invalidateQueries({ queryKey: claves.usoRecursos.raiz })
    }
  }
}

export function useAceptarConsulta() {
  const invalidar = useInvalidarConsultas()
  return useMutation({
    mutationFn: (consulta: Pick<Consulta, 'id' | 'email'>) => aceptarConsulta(consulta),
    // También en `limite` y `ya_resuelta`: la fila cambió (aviso o estado).
    onSettled: (resultado) => invalidar(resultado?.tipo === 'ok'),
  })
}

export function useDescartarConsulta() {
  const invalidar = useInvalidarConsultas()
  return useMutation({
    mutationFn: ({ id, motivo }: { id: string; motivo: string | null }) =>
      descartarConsulta(id, motivo),
    onSettled: () => invalidar(false),
  })
}

export function useVincularConsulta() {
  const invalidar = useInvalidarConsultas()
  return useMutation({
    mutationFn: (id: string) => vincularConsulta(id),
    onSettled: () => invalidar(false),
  })
}
