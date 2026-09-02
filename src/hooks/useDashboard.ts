import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  deduplicarAContactar,
  leadAItemProgreso,
  obtenerCandidatosDelDia,
  obtenerCoincidenciasDelDia,
  obtenerContactadosHoy,
  separarLeadsDelDia,
  type CandidatosDelDia,
  type CoincidenciaDelDia,
  type ItemProgresoDia,
  type LeadContactado,
  type LeadsDelDia,
  type ProgresoDia,
} from '../lib/api/dashboard'
import { useEventosCalendario, type EventoCalendario } from './useTareas'
import { hoyComoClave } from '../lib/calendario'
import type { VisitaConContexto } from '../lib/api/visitas'
import type { Tarea } from '../types/database'

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

// ---------------------------------------------------------------------------
// Progreso del día
// ---------------------------------------------------------------------------

/**
 * Una tarea o una visita cancelada no es trabajo pendiente ni trabajo hecho:
 * queda afuera de la cuenta. Contarla como pendiente dejaría la barra sin
 * poder llegar nunca al 100%.
 */
function estaCancelado(evento: EventoCalendario): boolean {
  if (evento.tipo === 'TAREA') return (evento.raw as Tarea).estado === 'CANCELADA'
  if (evento.tipo === 'VISITA') return evento.estadoVisita === 'CANCELADA'
  return false
}

function eventoAItemProgreso(evento: EventoCalendario): ItemProgresoDia {
  if (evento.tipo === 'VISITA') {
    const visita = evento.raw as VisitaConContexto
    return {
      tipo: 'VISITA',
      id: evento.id,
      titulo: visita.propiedad?.direccion ?? 'Propiedad',
      completado: evento.estadoVisita === 'REALIZADA',
      hora: evento.hora,
    }
  }

  return {
    tipo: 'TAREA',
    id: evento.id,
    titulo: evento.titulo,
    completado: evento.completada === true,
    hora: evento.hora,
  }
}

/**
 * Lo que hay para hacer hoy y cuánto está hecho.
 *
 * Las tres fuentes se leen de donde ya viven, sin fetch propio:
 *
 *  - Tareas y visitas salen de `useEventosCalendario` con el rango de un solo
 *    día. Va por la misma clave de cache que el calendario de Tareas, así que
 *    hereda gratis el optimismo de `useCompletarTarea` y `useMarcarRealizada`:
 *    tildar una tarea mueve el contador sin round-trip ni código nuevo.
 *  - Los leads salen de los mismos candidatos que alimentan las secciones,
 *    deduplicados. Acá NO se sacan los contactados: son los que cuentan como
 *    completados.
 *
 * Los eventos de tipo SEGUIMIENTO del calendario se descartan: esos mismos
 * leads ya vienen —deduplicados y con su motivo— por la otra fuente, y contarlos
 * dos veces inflaría el total.
 */
export function useProgresoDelDia(): {
  data: ProgresoDia | undefined
  isPending: boolean
  isError: boolean
  error: Error | null
} {
  const hoy = hoyComoClave()
  const agenda = useEventosCalendario(hoy, hoy)
  const candidatos = useCandidatosDelDia()

  const data = useMemo<ProgresoDia | undefined>(() => {
    if (!agenda.data || !candidatos.data) return undefined

    const items: ItemProgresoDia[] = [
      ...agenda.data
        .filter((e) => e.tipo !== 'SEGUIMIENTO')
        .filter((e) => !estaCancelado(e))
        .map(eventoAItemProgreso),
      ...deduplicarAContactar(candidatos.data).map(leadAItemProgreso),
    ]

    return {
      completados: items.filter((i) => i.completado).length,
      total: items.length,
      items,
    }
  }, [agenda.data, candidatos.data])

  return {
    data,
    isPending: agenda.isPending || candidatos.isPending,
    isError: agenda.isError || candidatos.isError,
    error: (agenda.error ?? candidatos.error) as Error | null,
  }
}
