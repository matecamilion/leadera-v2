import { useQuery } from '@tanstack/react-query'
import {
  contarLeads,
  contarLeadsNuevos,
  hayLeads,
  listarLeads,
  type FiltroDelDia,
  type FiltroEstado,
  type ListarLeadsResult,
  type OrdenLeads,
} from '../lib/api/leads'
import type { FiltroRol } from '../lib/api/rolLead'
import { anteriorDelMismoUsuario, claves } from '../lib/queryKeys'
import { useUid } from './useUid'

/** Filas por página del listado de leads. */
export const LEADS_POR_PAGINA = 20

export function useLeads(
  estado: FiltroEstado | undefined,
  busqueda: string,
  page: number,
  delDia?: FiltroDelDia,
  rol?: FiltroRol,
  orden: OrdenLeads = 'prioridad',
) {
  const uid = useUid()
  return useQuery<ListarLeadsResult>({
    // `delDia` gana sobre el estado (ver `aplicarFiltros`), así que ocupa su
    // lugar en la clave. Sigue colgando de `claves.leads.raiz`: registrar una
    // interacción invalida esto y el lead sale del corte, igual que en Mi día.
    //
    // El rol no pisa a nadie: se combina con todo lo demás, así que va aparte.
    // El orden también: sin él en la clave, cambiarlo mostraría la página
    // cacheada con el orden anterior.
    queryKey: claves.leads.listado(
      uid,
      delDia ?? estado ?? 'todos',
      rol ?? 'todos',
      busqueda,
      orden,
      page,
    ),
    queryFn: () =>
      listarLeads({ estado, delDia, rol, busqueda, orden, page, pageSize: LEADS_POR_PAGINA }),
    enabled: !!uid,
    // Al paginar o tipear mantenemos la tabla anterior visible en vez de volver
    // al skeleton: evita que la lista parpadee en cada tecla.
    placeholderData: anteriorDelMismoUsuario(uid),
  })
}

/** Total sin filtro de estado, para el contador del chip "Todos". */
export function useTotalLeads(busqueda: string, rol?: FiltroRol) {
  const uid = useUid()
  return useQuery({
    queryKey: claves.leads.total(uid, rol ?? 'todos', busqueda),
    queryFn: () => contarLeads(busqueda, rol),
    enabled: !!uid,
    placeholderData: anteriorDelMismoUsuario(uid),
  })
}

/**
 * ¿La cuenta tiene algún lead? Sólo se pregunta cuando el contador de la
 * pantalla ya dio 0 (`habilitado`): las cuentas con trabajo no pagan la consulta.
 *
 * `staleTime: 0` a propósito: un lead puede llegar sin que el usuario lo cree
 * (una consulta aceptada), así que cada vez que se monta se vuelve a preguntar.
 * Crear o borrar uno la invalida por colgar de `claves.leads.raiz`.
 */
export function useHayLeads(habilitado: boolean) {
  const uid = useUid()
  return useQuery<boolean>({
    queryKey: claves.leads.hay(uid),
    queryFn: hayLeads,
    enabled: !!uid && habilitado,
    staleTime: 0,
  })
}

/**
 * Leads nuevos, para el badge del menú. Se refresca al volver a la pestaña
 * (la app lo tiene apagado por defecto) y cada vez que algo invalida `leads`.
 */
export function useLeadsNuevos() {
  const uid = useUid()
  return useQuery<number>({
    queryKey: claves.leads.nuevos(uid),
    queryFn: contarLeadsNuevos,
    enabled: !!uid,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  })
}
