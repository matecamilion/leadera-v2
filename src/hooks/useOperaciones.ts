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

/** Filas por página del listado de operaciones. */
export const OPERACIONES_POR_PAGINA = 20

export function useOperaciones(
  tipo: TipoOperacion | undefined,
  estado: EstadoOperacion | undefined,
  busqueda: string,
  page: number,
) {
  return useQuery<ListarOperacionesResult>({
    queryKey: ['operaciones', tipo ?? 'todos', estado ?? 'todos', busqueda, page],
    queryFn: () =>
      listarOperaciones({
        tipo,
        estado,
        busqueda,
        page,
        pageSize: OPERACIONES_POR_PAGINA,
      }),
    // Al paginar, filtrar o tipear mantenemos la tabla anterior visible en vez
    // de volver al skeleton: evita que la lista parpadee en cada búsqueda.
    placeholderData: (anterior) => anterior,
  })
}

export function useCrearOperacion() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CrearOperacionInput) => crearOperacion(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operaciones'] })
      // La tab de la ficha del lead cuelga de otra clave que `['operaciones']`
      // no alcanza. Hace falta desde que el alta puede volver a esa ficha: sin
      // esto la operación recién creada no aparece hasta que el cache expira.
      queryClient.invalidateQueries({ queryKey: ['operaciones-por-lead'] })
    },
  })
}

/** Búsquedas activas del lead elegido, para el tipo COMPRA. */
export function useBusquedasDeLead(leadId: string | null) {
  return useQuery({
    queryKey: ['busquedas-de-lead', leadId],
    queryFn: () => listarBusquedasDeLead(leadId as string),
    enabled: Boolean(leadId),
  })
}

/**
 * Las operaciones abiertas más recientes, para el resumen de Mi día.
 *
 * Hook aparte y no `useOperaciones` con otro `pageSize`: su filtro `estado` es
 * un valor único y acá hace falta el complemento —todo lo que no está cerrado ni
 * cancelado—. El porqué largo está en `listarOperacionesEnCurso`.
 *
 * La clave cuelga de `['operaciones']`, así que `useCrearOperacion` y
 * `useCrearPropiedadConOperacion` ya la invalidan sin wiring extra.
 */
export function useOperacionesEnCurso(limit = 3) {
  return useQuery<ListarOperacionesResult>({
    queryKey: ['operaciones', 'en-curso', limit],
    queryFn: () => listarOperacionesEnCurso(limit),
  })
}
