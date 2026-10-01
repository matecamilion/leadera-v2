import { Link } from 'react-router-dom'
import { useResumenConsultas } from '../../hooks/useConsultas'
import type { Consulta } from '../../lib/api/consultas'
import { BloquePuntaje, ChipEspera } from '../consultas/RespuestasConsulta'
import { resumenCorto } from '../consultas/respuestas'
import { minutosDesde, UMBRAL_URGENTE_MIN, useAhora } from '../consultas/urgencia'
import { IconoConversacion } from '../leads/Iconos'
import { SeccionCard } from './SeccionCard'

function nombre(c: Consulta): string {
  return `${c.nombre} ${c.apellido ?? ''}`.trim()
}

/**
 * Consultas por revisar, en Mi día. Misma anatomía que las filas de la
 * bandeja —puntaje, resumen, espera—, en chico.
 *
 * Se monta solo si hay algo: pendientes que me tocan (las mismas que cuenta el
 * badge) o gente que volvió a consultar en los últimos días.
 */
export function SeccionConsultas() {
  const { data } = useResumenConsultas()
  const ahora = useAhora()
  if (!data || (data.totalPendientes === 0 && data.volvieron.length === 0)) return null

  const { pendientes, totalPendientes, volvieron } = data
  // Sobre las 3 que se muestran: el resumen no trae el conteo por espera, y
  // agregarlo sería tocar la query. Alcanza para avisar que hay que ir ya.
  const urgentes = pendientes.filter((c) => minutosDesde(c.created_at, ahora) >= UMBRAL_URGENTE_MIN).length

  return (
    <SeccionCard
      icono={<IconoConversacion className="size-4" />}
      tono="brand"
      titulo="Consultas por revisar"
      subtitulo="Llegaron por tu link de consultas"
      badge={totalPendientes > 0 ? String(totalPendientes) : undefined}
      verTodos={{
        ruta: '/consultas',
        texto: totalPendientes > 0 ? 'Revisar ahora →' : 'Ver bandeja →',
      }}
    >
      {urgentes > 0 && (
        <p className="m-0 mb-1.5 inline-flex rounded-full bg-badge-caliente-bg px-2.5 py-0.5 text-[0.74rem] font-semibold text-caliente">
          {urgentes === 1 ? '1 espera' : `${urgentes} esperan`} hace más de 4 h
        </p>
      )}

      {pendientes.length > 0 && (
        <ul className="m-0 list-none divide-y divide-border p-0">
          {pendientes.map((c) => (
            <li key={c.id}>
              <Link
                to="/consultas"
                className="flex items-center gap-3 py-2.5 hover:bg-background focus-visible:outline-2 focus-visible:outline-primary"
              >
                <BloquePuntaje temperatura={c.temperatura} puntaje={c.puntaje} chico />
                <div className="min-w-0 flex-1">
                  <p className="m-0 truncate text-[0.88rem] font-semibold text-ink">{nombre(c)}</p>
                  <p className="m-0 truncate text-[0.76rem] text-ink-3">
                    {resumenCorto(c.respuestas, c.propiedad) || 'Sin respuestas'}
                  </p>
                </div>
                <ChipEspera minutos={minutosDesde(c.created_at, ahora)} />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {volvieron.length > 0 && (
        <div className={pendientes.length > 0 ? 'mt-2 border-t border-border pt-2.5' : ''}>
          <p className="m-0 mb-1 text-[0.76rem] font-semibold text-info">Volvieron a consultar</p>
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
            {volvieron.map((v) => (
              <li key={v.id} className="truncate text-[0.82rem]">
                {v.lead_id ? (
                  <Link to={`/leads/${v.lead_id}`} className="font-semibold text-primary hover:underline">
                    {nombre(v)}
                  </Link>
                ) : (
                  <span className="font-semibold text-ink">{nombre(v)}</span>
                )}
                <span className="text-ink-3">&nbsp;· {v.propiedad ? `por ${v.propiedad.direccion}` : 'link general'}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </SeccionCard>
  )
}
