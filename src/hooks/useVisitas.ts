import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  cancelarVisita,
  contarVisitasDeLead,
  crearVisita,
  eliminarVisita,
  listarVisitas,
  marcarRealizada,
  obtenerEstadisticasVisitasPropiedad,
  type CrearVisitaInput,
  type EstadisticasVisitasPropiedad,
  type VisitaConContexto,
} from '../lib/api/visitas'
// El calendario unificado vive en `useTareas`: de ahí salen la clave del cache
// y la forma del evento. La dependencia va en un solo sentido —`useTareas` no
// importa nada de acá— así que no hay ciclo.
import { CLAVE_TAREAS, type EventoCalendario } from './useTareas'
import type { EstadoVisita } from '../types/database'

/** Las visitas sueltas cuelgan de esta clave; el calendario, de CLAVE_TAREAS. */
export const CLAVE_VISITAS = ['visitas'] as const

/** Visitas de un rango, para quien las quiera sin el resto del calendario. */
export function useVisitas(desde: string, hasta: string) {
  return useQuery<VisitaConContexto[]>({
    queryKey: [...CLAVE_VISITAS, desde, hasta],
    queryFn: () => listarVisitas(desde, hasta),
    placeholderData: (anterior) => anterior,
  })
}

/**
 * Los agregados cuelgan de CLAVE_VISITAS: todo lo que ya invalida esa clave
 * —crear, marcar realizada, cancelar, eliminar— los recalcula sin wiring extra.
 */
export const claveEstadisticasPropiedad = (id: string) =>
  [...CLAVE_VISITAS, 'estadisticas-propiedad', id] as const
export const claveVisitasDeLead = (id: string) =>
  [...CLAVE_VISITAS, 'por-lead', id] as const

/** Visitas realizadas, agendadas e interesados únicos de una propiedad. */
export function useEstadisticasVisitasPropiedad(propiedadId: string | undefined) {
  return useQuery<EstadisticasVisitasPropiedad>({
    queryKey: claveEstadisticasPropiedad(propiedadId ?? ''),
    queryFn: () => obtenerEstadisticasVisitasPropiedad(propiedadId as string),
    enabled: Boolean(propiedadId),
  })
}

/** Cuántas visitas realizadas acumula un lead. */
export function useVisitasDeLead(leadId: string | undefined) {
  return useQuery<number>({
    queryKey: claveVisitasDeLead(leadId ?? ''),
    queryFn: () => contarVisitasDeLead(leadId as string),
    enabled: Boolean(leadId),
  })
}

interface ContextoOptimista {
  anteriores: [readonly unknown[], EventoCalendario[] | undefined][]
}

/**
 * Cambia el estado de una visita con actualización optimista.
 *
 * Se parchea tanto `estadoVisita` como el `raw`: el panel del día lee el estado
 * desde `raw`, así que tocar sólo el campo de arriba dejaría el chip del
 * calendario actualizado y los botones del panel sin enterarse hasta que
 * respondiera el server. Mismo patrón —y misma trampa— que en tareas.
 */
function useCambiarEstadoVisita(
  accion: (id: string) => Promise<unknown>,
  estado: EstadoVisita,
) {
  const queryClient = useQueryClient()

  return useMutation<unknown, Error, string, ContextoOptimista>({
    mutationFn: accion,

    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: CLAVE_TAREAS })

      const anteriores = queryClient.getQueriesData<EventoCalendario[]>({
        queryKey: CLAVE_TAREAS,
      })

      for (const [clave] of anteriores) {
        queryClient.setQueryData<EventoCalendario[]>(clave, (actual) =>
          actual?.map((e) => {
            if (e.tipo !== 'VISITA' || e.id !== `visita-${id}`) return e
            return {
              ...e,
              estadoVisita: estado,
              raw: { ...(e.raw as VisitaConContexto), estado },
            }
          }),
        )
      }

      return { anteriores }
    },

    onError: (_error, _id, contexto) => {
      for (const [clave, datos] of contexto?.anteriores ?? []) {
        queryClient.setQueryData(clave, datos)
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: CLAVE_TAREAS })
      queryClient.invalidateQueries({ queryKey: CLAVE_VISITAS })

      // Marcar realizada inserta una interacción llamando a la API directo, sin
      // pasar por `useCrearInteraccion`, así que hay que repetir acá lo que ese
      // hook invalida: el timeline, la ficha del lead —el trigger le movió las
      // fechas de contacto—, el listado y los conteos por lead.
      if (estado === 'REALIZADA') {
        queryClient.invalidateQueries({ queryKey: ['interacciones'] })
        queryClient.invalidateQueries({ queryKey: ['lead'] })
        queryClient.invalidateQueries({ queryKey: ['leads'] })
        queryClient.invalidateQueries({ queryKey: ['interacciones-por-lead'] })
      }
    },
  })
}

export function useMarcarRealizada() {
  return useCambiarEstadoVisita(marcarRealizada, 'REALIZADA')
}

export function useCancelarVisita() {
  return useCambiarEstadoVisita(cancelarVisita, 'CANCELADA')
}

/**
 * Alta de visita.
 *
 * Sin optimismo: la fila que vuelve trae la dirección y el lead resueltos por
 * el join, y adivinarlos en el cache daría más problemas que ventaja.
 */
export function useCrearVisita() {
  const queryClient = useQueryClient()

  return useMutation<unknown, Error, CrearVisitaInput>({
    mutationFn: crearVisita,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CLAVE_TAREAS })
      queryClient.invalidateQueries({ queryKey: CLAVE_VISITAS })
    },
  })
}

export function useEliminarVisita() {
  const queryClient = useQueryClient()

  return useMutation<void, Error, string>({
    mutationFn: eliminarVisita,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CLAVE_TAREAS })
      queryClient.invalidateQueries({ queryKey: CLAVE_VISITAS })
    },
  })
}
