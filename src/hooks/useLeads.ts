import { useQuery } from '@tanstack/react-query'
import {
  contarLeads,
  listarLeads,
  type FiltroEstado,
  type ListarLeadsResult,
} from '../lib/api/leads'

/** Filas por página del listado de leads. */
export const LEADS_POR_PAGINA = 20

export function useLeads(
  estado: FiltroEstado | undefined,
  busqueda: string,
  page: number,
) {
  return useQuery<ListarLeadsResult>({
    queryKey: ['leads', estado ?? 'todos', busqueda, page],
    queryFn: () =>
      listarLeads({ estado, busqueda, page, pageSize: LEADS_POR_PAGINA }),
    // Al paginar o tipear mantenemos la tabla anterior visible en vez de volver
    // al skeleton: evita que la lista parpadee en cada tecla.
    placeholderData: (anterior) => anterior,
  })
}

/** Total sin filtro de estado, para el contador del chip "Todos". */
export function useTotalLeads(busqueda: string) {
  return useQuery({
    queryKey: ['leads', 'total', busqueda],
    queryFn: () => contarLeads(busqueda),
    placeholderData: (anterior) => anterior,
  })
}
