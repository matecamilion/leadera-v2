import { useEffect } from 'react'
import { useMetricasLead } from '../../hooks/useMetricasLead'
import { usePropiedadesPorLead } from '../../hooks/usePropiedades'
import type { Lead } from '../../lib/api/leads'
import { diasDesde, textoHace, textoUltimoContacto } from '../../lib/metricasLead'

const cantidad = (n: number, singular: string, plural: string) => `${n} ${n === 1 ? singular : plural}`

/**
 * Cómo viene el lead, en una línea: contactos, interacciones, visitas, propiedades
 * y último contacto. Si la lectura falla o el usuario no ve el lead, no se dibuja
 * nada: son números de contexto, no pueden romper la ficha.
 */
export function LineaMetricasLead({ lead }: { lead: Lead }) {
  const { data, isPending, isError, error } = useMetricasLead(lead.id)
  const propiedades = usePropiedadesPorLead(lead.id)

  useEffect(() => {
    if (isError) console.error('[metricas_lead]', error)
  }, [isError, error])

  if (isPending) {
    return (
      <div
        aria-busy="true"
        aria-label="Cargando las métricas del lead"
        className="mb-6 h-[43px] animate-pulse rounded-lg bg-surface-2 motion-reduce:animate-none"
      />
    )
  }

  if (isError || !data) return null

  const cantidadPropiedades = propiedades.data?.length ?? 0
  const ultimoContacto = lead.fecha_ultimo_contacto_real
    ? `último contacto ${textoHace(diasDesde(lead.fecha_ultimo_contacto_real))}`
    : textoUltimoContacto(null)

  const partes = [
    cantidad(data.contactos_reales, 'contacto', 'contactos'),
    cantidad(data.interacciones_total, 'interacción', 'interacciones'),
    cantidad(data.visitas_realizadas, 'visita', 'visitas'),
    ...(cantidadPropiedades > 0
      ? [`${cantidad(cantidadPropiedades, 'propiedad', 'propiedades')} en cartera`]
      : []),
    ultimoContacto,
  ]

  return (
    <p className="m-0 mb-6 border-y border-border py-3 text-meta text-ink-3 tabular-nums">
      {partes.join(' · ')}
    </p>
  )
}
