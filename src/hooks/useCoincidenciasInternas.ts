import { useQuery } from '@tanstack/react-query'
import {
  buscarCoincidenciasInternas,
  type CoincidenciaInterna,
  type EstadoPropiedad,
} from '../lib/api/propiedades'

/**
 * Coincidencias de la MISMA inmobiliaria.
 *
 * Sólo dispara si la propiedad está DISPONIBLE: buscar compradores para algo
 * ya vendido o pausado no tiene sentido y sería una query al pedo.
 */
export function useCoincidenciasInternas(
  propiedadId: string | undefined,
  estado: EstadoPropiedad | undefined,
) {
  return useQuery<CoincidenciaInterna[]>({
    queryKey: ['coincidencias-internas', propiedadId],
    queryFn: () => buscarCoincidenciasInternas(propiedadId as string),
    enabled: Boolean(propiedadId) && estado === 'DISPONIBLE',
  })
}
