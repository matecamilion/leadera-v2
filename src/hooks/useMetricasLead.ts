import { useQuery } from '@tanstack/react-query'
import { obtenerMetricasLead, type MetricasLead } from '../lib/api/leads'
import { claves } from '../lib/queryKeys'
import { useUid } from './useUid'

/**
 * Las minimétricas de un lead. `data === null` = el usuario no ve el lead.
 *
 * La clave cuelga de `claves.lead.detalle`: toda mutación que ya refresca la
 * ficha (interacciones, estado, asignación) refresca esto sin wiring extra. Las
 * de visitas, que no conocen la ficha, invalidan `claves.lead.raiz`.
 */
export function useMetricasLead(leadId: string | undefined) {
  const uid = useUid()
  return useQuery<MetricasLead | null>({
    queryKey: claves.lead.metricas(uid, leadId ?? ''),
    queryFn: () => obtenerMetricasLead(leadId as string),
    enabled: !!uid && Boolean(leadId),
  })
}
