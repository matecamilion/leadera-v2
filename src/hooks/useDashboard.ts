import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  obtenerCandidatosDelDia,
  obtenerCoincidenciasDelDia,
  obtenerContactadosHoy,
  separarLeadsDelDia,
  type CandidatosDelDia,
  type CoincidenciaDelDia,
  type LeadContactado,
  type LeadsDelDia,
} from '../lib/api/dashboard'
import { useAuth } from '../contexts/AuthContext'
import { obtenerLeadsPorEnfriarse, type PorEnfriarse } from '../lib/api/leadsPorEnfriarse'
import { asignadoAPorDefecto } from '../lib/alcanceLeads'
import { claves } from '../lib/queryKeys'
import { useUid } from './useUid'

/*
 * Los leads del día cuelgan de `claves.leads` y no de `claves.dashboard` a
 * propósito: `useCrearInteraccion` y el "marcar realizada" de visitas ya
 * invalidan esa raíz, así que registrar un contacto saca al lead de las
 * secciones y lo suma a contactados sin tocar ninguno de esos dos módulos.
 */

/**
 * La única lectura de leads de la jornada.
 *
 * Las tres vistas —secciones, barra de progreso y contactados— son cortes
 * distintos de este mismo conjunto, así que comparten la entrada de cache y se
 * pide una sola vez por visita a Mi día.
 */
function useCandidatosDelDia() {
  const uid = useUid()
  // Un asistente trabaja lo que tiene asignado; el resto, todo lo visible.
  // Espera al perfil: sin el rol se pediría el pool y después se corregiría.
  const { profile } = useAuth()
  const asignadoA = asignadoAPorDefecto(profile?.rol, uid)
  return useQuery<CandidatosDelDia>({
    queryKey: claves.leads.delDia(uid, asignadoA ? 'mios' : 'todos'),
    queryFn: () => obtenerCandidatosDelDia(asignadoA),
    enabled: !!uid && !!profile,
  })
}

/**
 * Las tres secciones de la pantalla principal, ya sin los contactados de hoy.
 *
 * Devuelve la misma forma que antes de que hubiera pantalla de contactados: la
 * página no se entera de que ahora sale de un derivado.
 */
export function useLeadsDelDia(): {
  data: LeadsDelDia | undefined
  isPending: boolean
  isError: boolean
  error: Error | null
  refetch: () => void
} {
  const candidatos = useCandidatosDelDia()

  const data = useMemo(
    () => (candidatos.data ? separarLeadsDelDia(candidatos.data) : undefined),
    [candidatos.data],
  )

  return {
    data,
    isPending: candidatos.isPending,
    isError: candidatos.isError,
    error: candidatos.error,
    refetch: () => void candidatos.refetch(),
  }
}

/**
 * Dos queries separadas y no una: las coincidencias son más caras y menos
 * urgentes, así que la jornada se pinta apenas llega sin esperarlas.
 */
export function useCoincidenciasDelDia() {
  const uid = useUid()
  return useQuery<CoincidenciaDelDia[]>({
    queryKey: claves.dashboard.coincidencias(uid),
    queryFn: obtenerCoincidenciasDelDia,
    enabled: !!uid,
  })
}

/** Los leads con una interacción de hoy, para la pantalla de contactados. */
export function useContactadosHoy() {
  const uid = useUid()
  const { profile } = useAuth()
  const asignadoA = asignadoAPorDefecto(profile?.rol, uid)
  return useQuery<LeadContactado[]>({
    queryKey: claves.leads.contactadosHoy(uid, asignadoA ? 'mios' : 'todos'),
    queryFn: () => obtenerContactadosHoy(asignadoA),
    enabled: !!uid && !!profile,
  })
}

/**
 * Los leads que llevan 21 días o más sin contacto real. A diferencia del resto
 * de Mi día, el asistente no filtra por `asignado_a`: ve todos los del agente al
 * que asiste, así que no hay alcance en la clave ni espera al perfil.
 */
export function useLeadsPorEnfriarse() {
  const uid = useUid()
  return useQuery<PorEnfriarse>({
    queryKey: claves.leads.porEnfriarse(uid),
    queryFn: obtenerLeadsPorEnfriarse,
    enabled: !!uid,
  })
}
