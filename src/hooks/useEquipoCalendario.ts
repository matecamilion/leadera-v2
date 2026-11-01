import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { listarIdsAsistentesDe } from '../lib/api/equipoCalendario'
import { agenteDeAtribucion } from '../lib/atribucionLead'
import { armarEquipoCalendario, type EquipoCalendario } from '../lib/equipoCalendario'
import { claves } from '../lib/queryKeys'
import { useUid } from './useUid'

export interface EquipoCalendarioEstado {
  /**
   * El equipo, o `undefined` hasta que llega el perfil. Mientras carga la
   * lista de asistentes ya trae al usuario y a su agente, así las tarjetas no
   * parpadean sin permisos; `listo` dice cuándo está completo.
   */
  equipo: EquipoCalendario | undefined
  /** La lectura de asistentes terminó (bien o mal). Las queries esperan esto. */
  listo: boolean
}

/**
 * Con quién comparte calendario el usuario logueado.
 *
 * Dueño y agente: ellos y los asistentes que los asisten. Asistente: su agente
 * y los asistentes de su agente. Cambia poco (cuando entra o sale alguien del
 * equipo), por eso el `staleTime` es largo.
 *
 * Si la lectura de asistentes falla no se bloquea el calendario: se sigue con
 * el usuario y su agente, que cubre lo que carga cualquier asistente.
 */
export function useEquipoCalendario(): EquipoCalendarioEstado {
  const uid = useUid()
  const { profile } = useAuth()
  const dueno = profile ? agenteDeAtribucion(profile) : undefined

  const asistentes = useQuery<string[]>({
    queryKey: claves.equipoCalendario.de(uid, dueno),
    queryFn: () => listarIdsAsistentesDe(dueno as string, profile!.inmobiliaria_id),
    enabled: !!uid && !!profile && !!dueno,
    staleTime: 10 * 60_000,
  })

  const equipo = useMemo(
    () => (profile ? armarEquipoCalendario(profile, asistentes.data ?? []) : undefined),
    [profile, asistentes.data],
  )

  return { equipo, listo: !!profile && !asistentes.isPending }
}
