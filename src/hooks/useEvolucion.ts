import { useQuery } from '@tanstack/react-query'
import { obtenerEvolucion } from '../lib/api/perfil'
import type { DiaEvolucion, PeriodoEvolucion } from '../lib/graficoUtils'

export const CLAVE_EVOLUCION = ['perfil', 'evolucion'] as const

export function useEvolucion(periodo: PeriodoEvolucion) {
  return useQuery<DiaEvolucion[]>({
    // El período va en la clave: cambiarlo dispara su propio fetch y cada uno
    // queda cacheado por separado, así volver a un período ya visto es instantáneo.
    queryKey: [...CLAVE_EVOLUCION, periodo],
    queryFn: () => obtenerEvolucion(periodo),
    // Sin `placeholderData` a propósito: al pasar a un período que todavía no
    // está en cache se muestra el skeleton. Un período ya visitado sale del
    // cache y se pinta de una.
  })
}
