import { useQuery } from '@tanstack/react-query'
import { obtenerActividadReciente, type ActividadReciente } from '../lib/api/actividad'

/** Cuántas filas entran en el resumen de Mi día. */
export const ACTIVIDAD_EN_RESUMEN = 8

/**
 * Lo último que hizo el agente, para la sección de Mi día.
 *
 * Clave propia y no colgada de `['leads']`: el feed cruza cinco tablas, así que
 * ninguna invalidación existente lo cubre entero. Se refresca al volver a
 * montar la pantalla, que es cuando el agente lo mira.
 *
 * El límite es fijo y no un parámetro: la clave de cache no lo lleva, así que
 * dos llamadas con límites distintos se pisarían la entrada.
 */
export function useActividadReciente() {
  return useQuery<ActividadReciente[]>({
    queryKey: ['actividad-reciente'],
    queryFn: () => obtenerActividadReciente(ACTIVIDAD_EN_RESUMEN),
  })
}
