import { useQuery } from '@tanstack/react-query'
import { obtenerUsoRecursos, type UsoDeRecursos } from '../lib/api/uso'
import type { Plan } from '../lib/api/suscripcion'

/**
 * Cuánto del plan está usado.
 *
 * Depende del plan porque los topes salen de él: la clave lo incluye para que
 * cambiar de plan no muestre el uso viejo contra los límites nuevos.
 *
 * Se pide siempre, incluso sin plan: los conteos valen igual y la pantalla los
 * muestra sin barra. Los datos son de CRM y cambian todo el tiempo, así que no
 * lleva `staleTime` propio; alcanza con el de la app.
 */
export function useUsoRecursos(plan: Plan | null) {
  return useQuery<UsoDeRecursos>({
    queryKey: ['uso-recursos', plan],
    queryFn: () => obtenerUsoRecursos(plan),
  })
}
