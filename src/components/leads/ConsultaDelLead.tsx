import { Link } from 'react-router-dom'
import { useConsultasDeLead } from '../../hooks/useConsultas'
import type { Consulta } from '../../lib/api/consultas'
import { formatearFecha } from '../../lib/formatoFecha'
import { TooltipAyuda } from '../comunes/TooltipAyuda'
import { BloquePuntaje, PastillaEncuesta, RespuestasConsulta } from '../consultas/RespuestasConsulta'

/**
 * La consulta que creó al lead (aceptada a mano o sola), o si no la hay, la
 * primera que quedó vinculada a él. Las demás son las veces que volvió a
 * consultar.
 */
function separar(consultas: Consulta[]): { origen: Consulta | null; otras: Consulta[] } {
  const origen =
    consultas.find((c) => c.estado === 'ACEPTADA' || c.estado === 'AUTO_ACEPTADA') ?? consultas[0] ?? null
  return { origen, otras: consultas.filter((c) => c !== origen) }
}

/** En el header de la ficha, al lado del estado. Nada si el lead no vino de una consulta. */
export function BadgeEncuesta({ leadId }: { leadId: string }) {
  const { data } = useConsultasDeLead(leadId)
  const { origen } = separar(data ?? [])
  if (!origen) return null

  return (
    <>
      <PastillaEncuesta temperatura={origen.temperatura} puntaje={origen.puntaje} />
      <TooltipAyuda etiqueta="el puntaje de la encuesta">
        La calificación de la encuesta del link de consultas. No es el estado del lead: ese lo
        cambiás vos.
      </TooltipAyuda>
    </>
  )
}

function Origen({ consulta: c }: { consulta: Consulta }) {
  return c.propiedad ? (
    <Link to={`/propiedades/${c.propiedad.id}`} className="font-medium text-primary hover:underline">
      {c.propiedad.direccion}
    </Link>
  ) : (
    <>link general</>
  )
}

const COMO_LLEGO: Partial<Record<Consulta['estado'], string>> = {
  AUTO_ACEPTADA: 'Pasó sola a Nuevos por el puntaje',
  ACEPTADA: 'La aceptaron desde la bandeja',
  VINCULADA: 'Ya era lead cuando consultó',
}

/**
 * En la columna de identidad de la ficha: cómo llegó por el link y qué
 * contestó, con la misma lectura que en la bandeja.
 */
export function SeccionConsultaLead({ leadId }: { leadId: string }) {
  const { data } = useConsultasDeLead(leadId)
  const { origen, otras } = separar(data ?? [])
  if (!origen) return null

  const llegoPorLink = origen.estado === 'ACEPTADA' || origen.estado === 'AUTO_ACEPTADA'

  return (
    <section className="border-t border-border p-5">
      <h3 className="m-0 mb-3 text-xs font-bold tracking-[0.05em] text-primary uppercase">
        {llegoPorLink ? 'Llegó por el link de consultas' : 'Consultó por el link'}
      </h3>

      <div className="flex items-start gap-3">
        <BloquePuntaje temperatura={origen.temperatura} puntaje={origen.puntaje} chico />
        <div className="min-w-0 text-[0.82rem]">
          <p className="m-0 text-ink-2">
            {formatearFecha(origen.created_at)}&nbsp;· <Origen consulta={origen} />
          </p>
          {COMO_LLEGO[origen.estado] && (
            <p className="m-0 mt-0.5 text-ink-3">{COMO_LLEGO[origen.estado]}</p>
          )}
        </div>
      </div>

      <div className="mt-3 rounded-lg bg-surface-2 px-3.5 py-3">
        <RespuestasConsulta respuestas={origen.respuestas} angosta />
      </div>

      {otras.length > 0 && (
        <ul className="m-0 mt-3 list-none space-y-1.5 p-0">
          {otras.map((c) => (
            <li key={c.id}>
              <details className="group rounded-lg border border-border">
                <summary className="flex min-h-[40px] cursor-pointer list-none items-center gap-2 px-3 py-2 text-[0.82rem] text-ink-2 [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0 flex-1">
                    Volvió a consultar el {formatearFecha(c.created_at)}
                    <span className="text-ink-3">&nbsp;· {c.puntaje}&nbsp;pts</span>
                  </span>
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                    className="shrink-0 text-ink-3 transition-transform group-open:rotate-180 motion-reduce:transition-none"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </summary>
                <div className="border-t border-border px-3 py-2.5">
                  <p className="m-0 mb-2 text-[0.78rem] text-ink-3">
                    Por <Origen consulta={c} />
                  </p>
                  <RespuestasConsulta respuestas={c.respuestas} angosta />
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
