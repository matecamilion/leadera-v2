import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import {
  listarEquipo,
  listarLeadsDelEquipo,
  obtenerCupo,
  obtenerResumenCupo,
  obtenerStatsEquipo,
  toggleActivoMiembro,
  type CupoEquipo,
  type LeadsEquipoResult,
  type ResumenCupo,
  type Miembro,
  type RolAgente,
  type StatsEquipo,
} from '../lib/api/equipo'
import {
  crearInvitacion,
  listarInvitacionesPendientes,
  type InvitacionCreada,
  type InvitacionPendiente,
} from '../lib/api/invitaciones'
import { anteriorDelMismoUsuario, claves } from '../lib/queryKeys'
import { useUid } from './useUid'

/** Filas por página de la tabla de leads del equipo. */
export const LEADS_EQUIPO_POR_PAGINA = 20

export function useEquipo(rol: RolAgente | undefined, miId: string | undefined) {
  const uid = useUid()
  return useQuery<Miembro[]>({
    queryKey: claves.equipo.miembros(uid, rol, miId),
    queryFn: () => listarEquipo(rol!, miId!),
    enabled: !!uid && !!rol && !!miId,
  })
}

/** El id sale del `profile`: hasta que llega, la query no dispara. */
export function useCupoEquipo() {
  const uid = useUid()
  const inmobiliariaId = useAuth().profile?.inmobiliaria_id
  return useQuery<CupoEquipo>({
    queryKey: claves.equipo.cupo(uid, inmobiliariaId),
    queryFn: () => obtenerCupo(inmobiliariaId!),
    enabled: !!uid && !!inmobiliariaId,
  })
}

export function useStatsEquipo(habilitado: boolean) {
  const uid = useUid()
  return useQuery<StatsEquipo>({
    queryKey: claves.equipo.stats(uid),
    queryFn: obtenerStatsEquipo,
    // Las stats recorren toda la cartera: no se piden hasta que se abre la tab.
    enabled: !!uid && habilitado,
  })
}

export function useLeadsDelEquipo(page: number, habilitado: boolean) {
  const uid = useUid()
  return useQuery<LeadsEquipoResult>({
    queryKey: claves.equipo.leads(uid, page),
    queryFn: () => listarLeadsDelEquipo(page, LEADS_EQUIPO_POR_PAGINA),
    enabled: !!uid && habilitado,
    // Al paginar se mantiene la tabla anterior en vez de volver al skeleton.
    placeholderData: anteriorDelMismoUsuario(uid),
  })
}

export function useInvitacionesPendientes(habilitado: boolean) {
  const uid = useUid()
  return useQuery<InvitacionPendiente[]>({
    queryKey: claves.equipo.invitaciones(uid),
    queryFn: listarInvitacionesPendientes,
    enabled: !!uid && habilitado,
  })
}

interface InvitarInput {
  rol: RolAgente
  asisteA?: string | null
}

export function useCrearInvitacion() {
  const queryClient = useQueryClient()

  return useMutation<InvitacionCreada, Error, InvitarInput>({
    mutationFn: ({ rol, asisteA }) => crearInvitacion(rol, asisteA),
    onSuccess: () => {
      // Cambia la lista de pendientes; el cupo todavía no, porque la
      // invitación no ocupa lugar hasta que alguien la usa.
      queryClient.invalidateQueries({ queryKey: claves.equipo.raiz })
    },
  })
}

interface ToggleInput {
  profileId: string
  activo: boolean
}

export function useToggleActivo() {
  const queryClient = useQueryClient()

  return useMutation<void, Error, ToggleInput>({
    mutationFn: ({ profileId, activo }) => toggleActivoMiembro(profileId, activo),
    onSuccess: () => {
      // Afecta a la lista y también a las stats agregadas.
      queryClient.invalidateQueries({ queryKey: claves.equipo.raiz })
    },
  })
}

/** Plan y agentes para el pie del menú. Sólo lo pide quien lo va a ver (el dueño). */
export function useResumenCupo(habilitado: boolean) {
  const uid = useUid()
  return useQuery<ResumenCupo | null>({
    queryKey: claves.equipo.resumenCupo(uid),
    queryFn: obtenerResumenCupo,
    enabled: !!uid && habilitado,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: true,
  })
}
