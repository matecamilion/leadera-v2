import { useQuery } from '@tanstack/react-query'
import { obtenerEvolucion } from '../lib/api/perfil'
import type { DiaEvolucion, PeriodoEvolucion } from '../lib/graficoUtils'
import { claves } from '../lib/queryKeys'
import { useUid } from './useUid'

export function useEvolucion(periodo: PeriodoEvolucion) {
  const uid = useUid()
  return useQuery<DiaEvolucion[]>({
    // El período va en la clave: cambiarlo dispara su propio fetch y cada uno
    // queda cacheado por separado, así volver a un período ya visto es instantáneo.
    queryKey: claves.perfil.evolucion(uid, periodo),
    queryFn: () => obtenerEvolucion(periodo),
    enabled: !!uid,
    // Sin `placeholderData` a propósito: al pasar a un período que todavía no
    // está en cache se muestra el skeleton. Un período ya visitado sale del
    // cache y se pinta de una.
  })
}
