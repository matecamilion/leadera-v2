import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  crearPropiedad,
  listarPropiedades,
  listarPropiedadesPorLead,
  listarPropiedadesRecientes,
  type CrearPropiedadInput,
  type FiltrosPropiedad,
  type ListarPropiedadesResult,
  crearPropiedadConOperacion,
  type TipoOperacionDePropiedad,
} from '../lib/api/propiedades'
import { anteriorDelMismoUsuario, claves } from '../lib/queryKeys'
import { useUid } from './useUid'

/** Filas por página del listado de propiedades. */
export const PROPIEDADES_POR_PAGINA = 20

/**
 * Los filtros viajan como objeto y no como argumentos sueltos: con seis, el
 * orden posicional se vuelve una trampa. React Query hashea la clave de forma
 * determinística, así que un objeto nuevo con el mismo contenido no dispara
 * refetch.
 *
 * El segmento `'listado'` separa esta clave de la de `'por-lead'`
 * —tienen distinto largo, pero nombrarlas evita el tipo de colisión que ya nos
 * mordió una vez en `operaciones-por-lead`—.
 */
export function usePropiedades(filtros: FiltrosPropiedad, page: number) {
  const uid = useUid()
  return useQuery<ListarPropiedadesResult>({
    queryKey: claves.propiedades.listado(uid, filtros, page),
    queryFn: () =>
      listarPropiedades({ ...filtros, page, pageSize: PROPIEDADES_POR_PAGINA }),
    enabled: !!uid,
    // Al paginar o tipear mantenemos la tabla anterior visible en vez de volver
    // al skeleton: evita que la lista parpadee en cada tecla.
    placeholderData: anteriorDelMismoUsuario(uid),
  })
}

/**
 * Propiedades de un lead. Cuelga de `claves.propiedades.raiz`, así que `useCrearPropiedad`
 * ya la invalida: dar de alta una propiedad refresca la tab de la ficha.
 */
export function usePropiedadesPorLead(leadId: string | undefined) {
  const uid = useUid()
  return useQuery({
    queryKey: claves.propiedades.porLead(uid, leadId),
    queryFn: () => listarPropiedadesPorLead(leadId as string),
    enabled: !!uid && Boolean(leadId),
  })
}

export function useCrearPropiedad() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CrearPropiedadInput) => crearPropiedad(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: claves.propiedades.raiz })
    },
  })
}

/**
 * Alta de propiedad y su operación en una sola transacción.
 *
 * Invalida las dos familias de claves porque puede tocar las dos tablas, y la
 * de operaciones por lead porque el alta puede volver a la ficha del
 * propietario: sin eso la operación recién creada no aparece hasta que expire
 * el cache. Mismo criterio que tenían por separado `useCrearPropiedad` y
 * `useCrearOperacion`.
 */
export function useCrearPropiedadConOperacion() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      propiedad,
      tipoOperacion,
    }: {
      propiedad: CrearPropiedadInput
      tipoOperacion: TipoOperacionDePropiedad | null
    }) => crearPropiedadConOperacion(propiedad, tipoOperacion),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: claves.propiedades.raiz })
      queryClient.invalidateQueries({ queryKey: claves.operaciones.raiz })
      queryClient.invalidateQueries({ queryKey: claves.operacionesPorLead.raiz })
    },
  })
}

/**
 * Las últimas propiedades cargadas, para el resumen de Mi día.
 *
 * Hook aparte y no `usePropiedades` con otra página: el listado ordena por
 * `estado` antes que por fecha, así que sus primeras filas no son las más
 * recientes. El porqué largo está en `listarPropiedadesRecientes`.
 *
 * La clave cuelga de `claves.propiedades.raiz`, así que `useCrearPropiedad` y
 * `useCrearPropiedadConOperacion` ya la invalidan sin wiring extra.
 */
export function usePropiedadesRecientes(limit = 3) {
  const uid = useUid()
  return useQuery<ListarPropiedadesResult>({
    queryKey: claves.propiedades.recientes(uid, limit),
    queryFn: () => listarPropiedadesRecientes(limit),
    enabled: !!uid,
  })
}
