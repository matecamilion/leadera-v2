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
import { asignadoAPorDefecto } from '../lib/alcanceLeads'
import { anteriorDelMismoUsuario, claves } from '../lib/queryKeys'
import { useAuth } from '../contexts/AuthContext'
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
  mios = false,
) {
  const uid = useUid()
  // Con "Míos" se filtra por `asignado_a`; sin él, lo que la RLS deje ver.
  const asignadoA = mios ? uid : undefined
  // `mios` sale del rol (ver `resolverMios`): hasta que el perfil llega no se
  // sabe si el default es Míos, y pedir antes sería mostrar el pool y corregirlo.
  const { profile } = useAuth()
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
      mios ? 'mios' : 'todos',
      busqueda,
      orden,
      page,
    ),
    queryFn: () =>
      listarLeads({ estado, delDia, rol, asignadoA, busqueda, orden, page, pageSize: LEADS_POR_PAGINA }),
    enabled: !!uid && !!profile,
    // Al paginar o tipear mantenemos la tabla anterior visible en vez de volver
    // al skeleton: evita que la lista parpadee en cada tecla.
    placeholderData: anteriorDelMismoUsuario(uid),
  })
}

/** Total sin filtro de estado, para el contador del chip "Todos". */
export function useTotalLeads(busqueda: string, rol?: FiltroRol, mios = false, habilitado = true) {
  const uid = useUid()
  const asignadoA = mios ? uid : undefined
  const { profile } = useAuth()
  return useQuery({
    queryKey: claves.leads.total(uid, rol ?? 'todos', mios ? 'mios' : 'todos', busqueda),
    queryFn: () => contarLeads(busqueda, rol, asignadoA),
    enabled: !!uid && !!profile && habilitado,
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
 *
 * Para un asistente cuenta solo lo que tiene asignado; para el resto, igual
 * que siempre. Espera al perfil: sin el rol no se sabe qué contar.
 */
export function useLeadsNuevos() {
  const uid = useUid()
  const { profile } = useAuth()
  const asignadoA = asignadoAPorDefecto(profile?.rol, uid)
  return useQuery<number>({
    queryKey: claves.leads.nuevos(uid, asignadoA ? 'mios' : 'todos'),
    queryFn: () => contarLeadsNuevos(asignadoA),
    enabled: !!uid && !!profile,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  })
}
