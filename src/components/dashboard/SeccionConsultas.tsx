import { Link } from 'react-router-dom'
import { useResumenConsultas } from '../../hooks/useConsultas'
import type { Consulta } from '../../lib/api/consultas'
import { BadgeTemperatura, Chip } from '../consultas/RespuestasConsulta'
import { IconoConversacion } from '../leads/Iconos'
import { SeccionCard } from './SeccionCard'

function nombre(c: Consulta): string {
  return `${c.nombre} ${c.apellido ?? ''}`.trim()
}

/**
 * Consultas por revisar, en Mi día.
 *
 * Se monta solo si hay algo: pendientes que me tocan (las mismas que cuenta el
 * badge) o gente que volvió a consultar en los últimos días. Sin nada, no ocupa
 * lugar —mismo criterio que las coincidencias—.
 */
export function SeccionConsultas() {
  const { data } = useResumenConsultas()
  if (!data || (data.totalPendientes === 0 && data.volvieron.length === 0)) return null

  const { pendientes, totalPendientes, volvieron } = data

  return (
    <SeccionCard
      icono={<IconoConversacion className="size-4" />}
      tono="brand"
      titulo="Consultas por revisar"
      subtitulo="Llegaron por tu link de consultas"
      badge={totalPendientes > 0 ? String(totalPendientes) : undefined}
      verTodos={{ ruta: '/consultas', texto: totalPendientes > 0 ? `Ver todas (${totalPendientes})` : 'Ver bandeja' }}
    >
      {pendientes.length > 0 && (
        <ul className="m-0 list-none divide-y divide-border p-0">
          {pendientes.map((c) => (
            <li key={c.id}>
              <Link
                to="/consultas"
                className="flex items-center gap-3 py-2.5 hover:bg-background focus-visible:outline-2 focus-visible:outline-primary"
              >
                <div className="min-w-0 flex-1">
                  <p className="m-0 truncate text-[0.88rem] font-semibold text-ink">{nombre(c)}</p>
                  <p className="m-0 truncate text-[0.76rem] text-ink-3">
                    {c.propiedad ? `Por ${c.propiedad.direccion}` : 'Link general'}
                    {c.duplicado_otro_agente && ' · ya es lead de otro agente'}
                  </p>
                </div>
                {c.posible_captacion && (
                  <span className="hidden sm:inline-flex">
                    <Chip tono="captacion">Posible captación</Chip>
                  </span>
                )}
                <BadgeTemperatura temperatura={c.temperatura} puntaje={c.puntaje} />
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
