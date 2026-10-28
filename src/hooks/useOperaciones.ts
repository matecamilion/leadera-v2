import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  crearOperacion,
  listarBusquedasDeLead,
  listarOperaciones,
  listarOperacionesEnCurso,
  type CrearOperacionInput,
  type EstadoOperacion,
  type ListarOperacionesResult,
  type TipoOperacion,
} from '../lib/api/operaciones'
import { obtenerBusquedaLibreDeLead, type BusquedaLibre } from '../lib/api/busquedas'
import { anteriorDelMismoUsuario, claves } from '../lib/queryKeys'
import { useUid } from './useUid'

/** Filas por página del listado de operaciones. */
export const OPERACIONES_POR_PAGINA = 20

export function useOperaciones(
  tipo: TipoOperacion | undefined,
  estado: EstadoOperacion | undefined,
  busqueda: string,
  page: number,
) {
  const uid = useUid()
  return useQuery<ListarOperacionesResult>({
    queryKey: claves.operaciones.listado(uid, tipo ?? 'todos', estado ?? 'todos', busqueda, page),
    queryFn: () =>
      listarOperaciones({
        tipo,
        estado,
        busqueda,
        page,
        pageSize: OPERACIONES_POR_PAGINA,
      }),
    enabled: !!uid,
    // Al paginar, filtrar o tipear mantenemos la tabla anterior visible en vez
    // de volver al skeleton: evita que la lista parpadee en cada búsqueda.
    placeholderData: anteriorDelMismoUsuario(uid),
  })
}

export function useCrearOperacion() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CrearOperacionInput) => crearOperacion(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: claves.operaciones.raiz })
      // La tab de la ficha del lead cuelga de otra clave que `claves.operaciones`
      // no alcanza. Hace falta desde que el alta puede volver a esa ficha: sin
      // esto la operación recién creada no aparece hasta que el cache expira.
      queryClient.invalidateQueries({ queryKey: claves.operacionesPorLead.raiz })
      // Una operación creada con una búsqueda del lead la deja en uso.
      queryClient.invalidateQueries({ queryKey: claves.busquedasDeLead.raiz })
    },
  })
}

/** Búsquedas activas del lead elegido, para el tipo COMPRA. */
export function useBusquedasDeLead(leadId: string | null) {
  const uid = useUid()
  return useQuery({
    queryKey: claves.busquedasDeLead.deLead(uid, leadId),
    queryFn: () => listarBusquedasDeLead(leadId as string),
    enabled: !!uid && Boolean(leadId),
  })
}

/**
 * La búsqueda activa del lead que ninguna operación usa, para precargar el alta.
 *
 * `staleTime` en 0: otra pantalla puede vincularla a una operación, y ofrecer
 * una búsqueda ya en uso rompería el 1 a 1.
 */
export function useBusquedaLibreDeLead(leadId: string | null, tipo: TipoOperacion) {
  const uid = useUid()
  return useQuery<BusquedaLibre | null>({
    queryKey: claves.busquedasDeLead.libre(uid, leadId, tipo),
    queryFn: () => obtenerBusquedaLibreDeLead(leadId as string, tipo),
    enabled: !!uid && Boolean(leadId),
    staleTime: 0,
  })
}

/**
 * Las operaciones abiertas más recientes, para el resumen de Mi día.
 *
 * Hook aparte y no `useOperaciones` con otro `pageSize`: su filtro `estado` es
 * un valor único y acá hace falta el complemento —todo lo que no está cerrado ni
 * cancelado—. El porqué largo está en `listarOperacionesEnCurso`.
 *
 * La clave cuelga de `claves.operaciones.raiz`, así que `useCrearOperacion` y
 * `useCrearPropiedadConOperacion` ya la invalidan sin wiring extra.
 */
export function useOperacionesEnCurso(limit = 3) {
  const uid = useUid()
  return useQuery<ListarOperacionesResult>({
    queryKey: claves.operaciones.enCurso(uid, limit),
    queryFn: () => listarOperacionesEnCurso(limit),
    enabled: !!uid,
  })
}
