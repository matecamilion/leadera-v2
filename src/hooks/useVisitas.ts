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
import { sincronizarConGoogle } from '../lib/api/googleCalendar'
import type { EstadoVisita, Visita } from '../types/database'

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

    // Va en onSuccess y no en onSettled: onSettled corre también cuando la
    // mutación falló, y ahí el estado no cambió. Una visita cancelada le
    // reescribe el título al evento a "(Cancelada)" en vez de borrarlo.
    onSuccess: (_datos, id) => {
      sincronizarConGoogle({ tipo: 'visita', accion: 'editar', registro_id: id })
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

  // El tipo pasa de `unknown` a `Visita`: `crearVisita` siempre devolvió la
  // fila, y el id es lo único con lo que el sync puede ubicarla.
  return useMutation<Visita, Error, CrearVisitaInput>({
    mutationFn: crearVisita,
    onSuccess: (creada) => {
      queryClient.invalidateQueries({ queryKey: CLAVE_TAREAS })
      queryClient.invalidateQueries({ queryKey: CLAVE_VISITAS })
      sincronizarConGoogle({ tipo: 'visita', accion: 'crear', registro_id: creada.id })
    },
  })
}

export function useEliminarVisita() {
  const queryClient = useQueryClient()

  // `eliminarVisita` devuelve el `google_event_id` de la fila borrada: mismo
  // motivo que en tareas, después del DELETE ese id no existe más.
  return useMutation<string | null, Error, string>({
    mutationFn: eliminarVisita,
    onSuccess: (googleEventId, id) => {
      queryClient.invalidateQueries({ queryKey: CLAVE_TAREAS })
      queryClient.invalidateQueries({ queryKey: CLAVE_VISITAS })
      if (googleEventId) {
        sincronizarConGoogle({
          tipo: 'visita',
          accion: 'borrar',
          registro_id: id,
          google_event_id: googleEventId,
        })
      }
    },
  })
}
