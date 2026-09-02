import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  completarTarea,
  crearTarea,
  crearTareaRecurrente,
  descompletarTarea,
  eliminarSerie,
  eliminarTarea,
  listarSeguimientosComoEventos,
  listarTareas,
  type CrearTareaInput,
  type SeguimientoLead,
} from '../lib/api/tareas'
import { listarVisitas, type VisitaConContexto } from '../lib/api/visitas'
import { claveDia } from '../lib/calendario'
import type { EstadoTarea, EstadoVisita, Recurrencia, Tarea } from '../types/database'

/** Todo lo del calendario cuelga de esta clave, para invalidarlo de una. */
export const CLAVE_TAREAS = ['tareas'] as const

export interface EventoCalendario {
  id: string
  /** `YYYY-MM-DD` del día en que cae, en hora local. */
  fecha: string
  tipo: 'TAREA' | 'SEGUIMIENTO' | 'VISITA'
  titulo: string
  /** Sólo para TAREA. */
  completada?: boolean
  /** `HH:MM`, si tiene hora puntual. */
  hora?: string | null
  /** Para SEGUIMIENTO, y para VISITA cuando tiene lead: a dónde linkea. */
  leadId?: string
  /** Sólo para VISITA. */
  estadoVisita?: EstadoVisita
  raw: Tarea | SeguimientoLead | VisitaConContexto
}

function tareaAEvento(t: Tarea): EventoCalendario {
  return {
    id: `tarea-${t.id}`,
    fecha: t.fecha,
    tipo: 'TAREA',
    titulo: t.titulo,
    completada: t.estado === 'COMPLETADA',
    // `time` de Postgres llega como `HH:MM:SS`; en pantalla alcanza HH:MM.
    hora: t.hora ? t.hora.slice(0, 5) : null,
    raw: t,
  }
}

function seguimientoAEvento(s: SeguimientoLead): EventoCalendario {
  const cuando = new Date(s.fecha_proximo_seguimiento)
  return {
    id: `seguimiento-${s.id}`,
    // La columna es `timestamptz`: el día de la grilla es el local, no el UTC.
    fecha: claveDia(cuando),
    tipo: 'SEGUIMIENTO',
    titulo: `Seguimiento: ${s.nombre} ${s.apellido ?? ''}`.trim(),
    hora: `${String(cuando.getHours()).padStart(2, '0')}:${String(cuando.getMinutes()).padStart(2, '0')}`,
    leadId: s.id,
    raw: s,
  }
}

function visitaAEvento(v: VisitaConContexto): EventoCalendario {
  const direccion = v.propiedad?.direccion ?? 'Propiedad'
  return {
    id: `visita-${v.id}`,
    fecha: v.fecha,
    tipo: 'VISITA',
    titulo: `Visita: ${direccion}`,
    // `time` de Postgres llega como `HH:MM:SS`; en pantalla alcanza HH:MM.
    hora: v.hora ? v.hora.slice(0, 5) : null,
    leadId: v.lead?.id,
    estadoVisita: v.estado,
    raw: v,
  }
}

/**
 * Eventos del mes visible: tareas propias, seguimientos de leads y visitas a
 * propiedades, en una sola lista con forma común.
 *
 * Las tres fuentes van en la misma query key para que el calendario se pinte de
 * una vez y no en saltos.
 */
export function useEventosCalendario(desde: string, hasta: string) {
  return useQuery<EventoCalendario[]>({
    queryKey: [...CLAVE_TAREAS, 'eventos', desde, hasta],
    queryFn: async () => {
      const [tareas, seguimientos, visitas] = await Promise.all([
        listarTareas(desde, hasta),
        listarSeguimientosComoEventos(desde, hasta),
        listarVisitas(desde, hasta),
      ])
      return [
        ...tareas.map(tareaAEvento),
        ...seguimientos.map(seguimientoAEvento),
        ...visitas.map(visitaAEvento),
      ]
    },
    // Al cambiar de mes se mantiene el calendario anterior en vez de saltar al
    // skeleton: navegar entre meses se siente continuo.
    placeholderData: (anterior) => anterior,
  })
}

interface ContextoOptimista {
  anteriores: [readonly unknown[], EventoCalendario[] | undefined][]
}

/**
 * Marca o desmarca una tarea con actualización optimista.
 *
 * Tildar un checkbox y esperar el round-trip para verlo tildado se siente roto,
 * así que se cambia en el cache primero. Si el server rechaza —RLS, red— se
 * restaura el snapshot y el tilde vuelve solo. Mismo patrón que el drag del
 * Kanban de operaciones.
 */
function useCambiarCompletada(accion: (id: string) => Promise<void>, completada: boolean) {
  const queryClient = useQueryClient()

  return useMutation<void, Error, string, ContextoOptimista>({
    mutationFn: accion,

    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: CLAVE_TAREAS })

      // Puede haber varios meses cacheados; se tocan todos los que tengan la tarea.
      const anteriores = queryClient.getQueriesData<EventoCalendario[]>({
        queryKey: CLAVE_TAREAS,
      })

      const estado: EstadoTarea = completada ? 'COMPLETADA' : 'PENDIENTE'

      for (const [clave] of anteriores) {
        queryClient.setQueryData<EventoCalendario[]>(clave, (actual) =>
          actual?.map((e) => {
            if (e.tipo !== 'TAREA' || e.id !== `tarea-${id}`) return e
            // También el `raw`: el panel del día lee `tarea.estado` de ahí, así
            // que tocar sólo `completada` movía el chip del calendario y dejaba
            // el checkbox sin marcar hasta que respondiera el server.
            return {
              ...e,
              completada,
              raw: { ...(e.raw as Tarea), estado, completada_en: completada ? new Date().toISOString() : null },
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
    },
  })
}

export function useCompletarTarea() {
  return useCambiarCompletada(completarTarea, true)
}

export function useDescompletarTarea() {
  return useCambiarCompletada(descompletarTarea, false)
}

export interface CrearInput {
  tarea: CrearTareaInput
  /** Si viene, la tarea se repite hasta `hasta`. */
  repeticion?: { recurrencia: Recurrencia; hasta: string }
}

/**
 * Alta de tarea, suelta o recurrente.
 *
 * Sin optimismo: una recurrente genera N filas cuyas fechas las decide el
 * server, así que adivinarlas en el cache daría más problemas que ventaja.
 */
export function useCrearTarea() {
  const queryClient = useQueryClient()

  return useMutation<{ ocurrencias: number }, Error, CrearInput>({
    mutationFn: async ({ tarea, repeticion }) => {
      if (!repeticion) {
        await crearTarea(tarea)
        return { ocurrencias: 1 }
      }
      const { ocurrencias } = await crearTareaRecurrente(
        tarea,
        repeticion.recurrencia,
        repeticion.hasta,
      )
      return { ocurrencias }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CLAVE_TAREAS })
    },
  })
}

export function useEliminarTarea() {
  const queryClient = useQueryClient()

  return useMutation<void, Error, string>({
    mutationFn: eliminarTarea,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CLAVE_TAREAS })
    },
  })
}

export function useEliminarSerie() {
  const queryClient = useQueryClient()

  return useMutation<number, Error, string>({
    mutationFn: eliminarSerie,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CLAVE_TAREAS })
    },
  })
}
