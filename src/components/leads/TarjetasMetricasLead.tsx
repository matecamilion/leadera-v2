import { useEffect } from 'react'
import { useMetricasLead } from '../../hooks/useMetricasLead'
import type { Lead } from '../../lib/api/leads'
import {
  desgloseInteracciones,
  diasDesde,
  textoEnCartera,
  textoProximaVisita,
  textoUltimoContacto,
} from '../../lib/metricasLead'
import { CardKpi } from '../comunes/CardKpi'
import { IconoCalendario, IconoCasa, IconoChat, IconoTelefono } from './Iconos'

/**
 * Cómo viene el lead, de un vistazo: contactos, interacciones, visitas y
 * antigüedad en la cartera.
 *
 * Arriba del Resumen y a ancho completo. 2×2 en una ficha angosta y cuatro en
 * fila desde 40rem de ancho del contenedor (no de la ventana). Si la lectura
 * falla o el usuario no ve el lead, no se dibuja nada: son números de
 * contexto, no pueden romper la ficha.
 */
export function TarjetasMetricasLead({ lead }: { lead: Lead }) {
  const { data, isPending, isError, error } = useMetricasLead(lead.id)

  useEffect(() => {
    if (isError) console.error('[metricas_lead]', error)
  }, [isError, error])

  if (isPending) {
    return (
      <div
        aria-busy="true"
        aria-label="Cargando las métricas del lead"
        className="@container mb-4"
      >
        <div className="grid grid-cols-2 gap-3 @[40rem]:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-[88px] animate-pulse rounded-2xl bg-surface-2 motion-reduce:animate-none"
            />
          ))}
        </div>
      </div>
    )
  }

  if (isError || !data) return null

  const diasEnCartera = diasDesde(lead.fecha_ingreso)

  return (
    <div className="@container mb-4">
      <div className="grid grid-cols-2 gap-3 @[40rem]:grid-cols-4">
        <CardKpi
          label="Contactos"
          valor={String(data.contactos_reales)}
          contexto={textoUltimoContacto(lead.fecha_ultimo_contacto_real)}
          icono={<IconoTelefono className="size-[18px]" />}
          tono="brand"
        />
        <CardKpi
          label="Interacciones"
          valor={String(data.interacciones_total)}
          contexto={desgloseInteracciones({
            total: data.interacciones_total,
            llamadas: data.llamadas,
            whatsapps: data.whatsapps,
            emails: data.emails,
            reuniones: data.reuniones,
          })}
          icono={<IconoChat className="size-[18px]" />}
          tono="frio"
        />
        <CardKpi
          label="Visitas"
          valor={String(data.visitas_realizadas)}
          contexto={textoProximaVisita({
            fecha: data.proxima_visita_fecha,
            hora: data.proxima_visita_hora,
            agendadas: data.visitas_agendadas,
          })}
          icono={<IconoCasa className="size-[18px]" />}
          tono="tibio"
        />
        <CardKpi
          label="En cartera"
          valor={`${diasEnCartera} ${diasEnCartera === 1 ? 'día' : 'días'}`}
          contexto={textoEnCartera(lead.fecha_ingreso, lead.fecha_primer_contacto_real)}
          icono={<IconoCalendario className="size-[18px]" />}
          tono="neutro"
        />
      </div>
    </div>
  )
}
