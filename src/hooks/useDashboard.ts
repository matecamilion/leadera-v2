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

export const CLAVE_COINCIDENCIAS = ['dashboard', 'coincidencias'] as const

/**
 * Los leads del día cuelgan de `['leads']` y no de `['dashboard']` a propósito:
 * `useCrearInteraccion` y el "marcar realizada" de visitas ya invalidan esa
 * clave, así que registrar un contacto saca al lead de las secciones y lo suma
 * a contactados sin tocar ninguno de esos dos módulos.
 */
export const CLAVE_CANDIDATOS = ['leads', 'del-dia'] as const
export const CLAVE_CONTACTADOS_HOY = ['leads', 'contactados-hoy'] as const

/**
 * La única lectura de leads de la jornada.
 *
 * Las tres vistas —secciones, barra de progreso y contactados— son cortes
 * distintos de este mismo conjunto, así que comparten la entrada de cache y se
 * pide una sola vez por visita a Mi día.
 */
function useCandidatosDelDia() {
  return useQuery<CandidatosDelDia>({
    queryKey: CLAVE_CANDIDATOS,
    queryFn: obtenerCandidatosDelDia,
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
  }
}

/**
 * Dos queries separadas y no una: las coincidencias son más caras y menos
 * urgentes, así que la jornada se pinta apenas llega sin esperarlas.
 */
export function useCoincidenciasDelDia() {
  return useQuery<CoincidenciaDelDia[]>({
    queryKey: CLAVE_COINCIDENCIAS,
    queryFn: obtenerCoincidenciasDelDia,
  })
}

/** Los leads con una interacción de hoy, para la pantalla de contactados. */
export function useContactadosHoy() {
  return useQuery<LeadContactado[]>({
    queryKey: CLAVE_CONTACTADOS_HOY,
    queryFn: obtenerContactadosHoy,
  })
}
