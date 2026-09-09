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

/** Filas por página del listado de propiedades. */
export const PROPIEDADES_POR_PAGINA = 20

/**
 * Los filtros viajan como objeto y no como argumentos sueltos: con seis, el
 * orden posicional se vuelve una trampa. React Query hashea la clave de forma
 * determinística, así que un objeto nuevo con el mismo contenido no dispara
 * refetch.
 *
 * El segmento `'listado'` separa esta clave de `['propiedades', 'por-lead', id]`
 * —tienen distinto largo, pero nombrarlas evita el tipo de colisión que ya nos
 * mordió una vez en `operaciones-por-lead`—.
 */
export function usePropiedades(filtros: FiltrosPropiedad, page: number) {
  return useQuery<ListarPropiedadesResult>({
    queryKey: ['propiedades', 'listado', filtros, page],
    queryFn: () =>
      listarPropiedades({ ...filtros, page, pageSize: PROPIEDADES_POR_PAGINA }),
    // Al paginar o tipear mantenemos la tabla anterior visible en vez de volver
    // al skeleton: evita que la lista parpadee en cada tecla.
    placeholderData: (anterior) => anterior,
  })
}

/**
 * Propiedades de un lead. Cuelga de `['propiedades']`, así que `useCrearPropiedad`
 * ya la invalida: dar de alta una propiedad refresca la tab de la ficha.
 */
export function usePropiedadesPorLead(leadId: string | undefined) {
  return useQuery({
    queryKey: ['propiedades', 'por-lead', leadId],
    queryFn: () => listarPropiedadesPorLead(leadId as string),
    enabled: Boolean(leadId),
  })
}

export function useCrearPropiedad() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CrearPropiedadInput) => crearPropiedad(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['propiedades'] })
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
      queryClient.invalidateQueries({ queryKey: ['propiedades'] })
      queryClient.invalidateQueries({ queryKey: ['operaciones'] })
      queryClient.invalidateQueries({ queryKey: ['operaciones-por-lead'] })
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
 * La clave cuelga de `['propiedades']`, así que `useCrearPropiedad` y
 * `useCrearPropiedadConOperacion` ya la invalidan sin wiring extra.
 */
export function usePropiedadesRecientes(limit = 3) {
  return useQuery<ListarPropiedadesResult>({
    queryKey: ['propiedades', 'recientes', limit],
    queryFn: () => listarPropiedadesRecientes(limit),
  })
}
