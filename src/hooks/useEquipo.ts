import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  listarEquipo,
  listarLeadsDelEquipo,
  obtenerCupo,
  obtenerStatsEquipo,
  toggleActivoMiembro,
  type CupoEquipo,
  type LeadsEquipoResult,
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

/** Todo lo del equipo cuelga de esta clave, para invalidarlo de una. */
export const CLAVE_EQUIPO = ['equipo'] as const

/** Filas por página de la tabla de leads del equipo. */
export const LEADS_EQUIPO_POR_PAGINA = 20

export function useEquipo(rol: RolAgente | undefined, miId: string | undefined) {
  return useQuery<Miembro[]>({
    queryKey: [...CLAVE_EQUIPO, 'miembros', rol, miId],
    queryFn: () => listarEquipo(rol!, miId!),
    enabled: !!rol && !!miId,
  })
}

export function useCupoEquipo() {
  return useQuery<CupoEquipo>({
    queryKey: [...CLAVE_EQUIPO, 'cupo'],
    queryFn: obtenerCupo,
  })
}

export function useStatsEquipo(habilitado: boolean) {
  return useQuery<StatsEquipo>({
    queryKey: [...CLAVE_EQUIPO, 'stats'],
    queryFn: obtenerStatsEquipo,
    // Las stats recorren toda la cartera: no se piden hasta que se abre la tab.
    enabled: habilitado,
  })
}

export function useLeadsDelEquipo(page: number, habilitado: boolean) {
  return useQuery<LeadsEquipoResult>({
    queryKey: [...CLAVE_EQUIPO, 'leads', page],
    queryFn: () => listarLeadsDelEquipo(page, LEADS_EQUIPO_POR_PAGINA),
    enabled: habilitado,
    // Al paginar se mantiene la tabla anterior en vez de volver al skeleton.
    placeholderData: (anterior) => anterior,
  })
}

export function useInvitacionesPendientes(habilitado: boolean) {
  return useQuery<InvitacionPendiente[]>({
    queryKey: [...CLAVE_EQUIPO, 'invitaciones'],
    queryFn: listarInvitacionesPendientes,
    enabled: habilitado,
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
      queryClient.invalidateQueries({ queryKey: CLAVE_EQUIPO })
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
      queryClient.invalidateQueries({ queryKey: CLAVE_EQUIPO })
    },
  })
}
