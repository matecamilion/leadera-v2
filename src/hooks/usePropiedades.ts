import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  crearPropiedad,
  listarPropiedades,
  listarPropiedadesPorLead,
  type CrearPropiedadInput,
  type FiltrosPropiedad,
  type ListarPropiedadesResult,
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
