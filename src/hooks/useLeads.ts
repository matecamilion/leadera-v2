import { useQuery } from '@tanstack/react-query'
import {
  contarLeads,
  listarLeads,
  type FiltroDelDia,
  type FiltroEstado,
  type ListarLeadsResult,
} from '../lib/api/leads'
import type { FiltroRol } from '../lib/api/rolLead'

/** Filas por página del listado de leads. */
export const LEADS_POR_PAGINA = 20

export function useLeads(
  estado: FiltroEstado | undefined,
  busqueda: string,
  page: number,
  delDia?: FiltroDelDia,
  rol?: FiltroRol,
) {
  return useQuery<ListarLeadsResult>({
    // `delDia` gana sobre el estado (ver `aplicarFiltros`), así que ocupa su
    // lugar en la clave. Sigue colgando de ['leads']: registrar una
    // interacción invalida esto y el lead sale del corte, igual que en Mi día.
    //
    // El rol no pisa a nadie: se combina con todo lo demás, así que va aparte.
    queryKey: ['leads', delDia ?? estado ?? 'todos', rol ?? 'todos', busqueda, page],
    queryFn: () =>
      listarLeads({ estado, delDia, rol, busqueda, page, pageSize: LEADS_POR_PAGINA }),
    // Al paginar o tipear mantenemos la tabla anterior visible en vez de volver
    // al skeleton: evita que la lista parpadee en cada tecla.
    placeholderData: (anterior) => anterior,
  })
}

/** Total sin filtro de estado, para el contador del chip "Todos". */
export function useTotalLeads(busqueda: string, rol?: FiltroRol) {
  return useQuery({
    queryKey: ['leads', 'total', rol ?? 'todos', busqueda],
    queryFn: () => contarLeads(busqueda, rol),
    placeholderData: (anterior) => anterior,
  })
}
