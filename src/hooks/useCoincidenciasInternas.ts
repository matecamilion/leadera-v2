import { useQuery } from '@tanstack/react-query'
import {
  buscarCoincidenciasInternas,
  type CoincidenciaInterna,
  type EstadoPropiedad,
} from '../lib/api/propiedades'
import { claves } from '../lib/queryKeys'
import { useUid } from './useUid'

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
  const uid = useUid()
  return useQuery<CoincidenciaInterna[]>({
    queryKey: claves.coincidenciasInternas.dePropiedad(uid, propiedadId),
    queryFn: () => buscarCoincidenciasInternas(propiedadId as string),
    enabled: !!uid && Boolean(propiedadId) && estado === 'DISPONIBLE',
  })
}
