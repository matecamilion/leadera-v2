import { useId, useState } from 'react'
import { useMiLink } from '../../hooks/useLinkConsulta'
import { AjustesLink } from './AjustesLink'
import { BotonesCompartir } from './BotonesCompartir'
import { urlDelLink, urlVisible } from './compartir'

const TITULO = 'Consultas'
const TEXTO = 'Contame qué estás buscando y te ayudo a encontrarlo:'

/**
 * El link general, arriba de la bandeja: el que va en la bio de Instagram, las
 * historias o la firma de WhatsApp. Siempre el propio (el del agente al que
 * asiste, para un asistente), aunque el dueño esté filtrando por otro agente.
 */
export function BarraLinkGeneral() {
  const link = useMiLink()
  const [abierto, setAbierto] = useState(false)
  const idPanel = useId()

  if (link.isPending) {
    return <div aria-busy="true" aria-label="Cargando tu link" className="mb-4 h-[76px] animate-pulse rounded-2xl bg-surface-2 motion-reduce:animate-none" />
  }
  if (link.isError) {
    return (
      <p role="alert" className="mb-4 rounded-lg bg-peligro-soft px-4 py-3 text-[0.84rem] text-peligro-ink">
        {link.error.message}
      </p>
    )
  }

  const l = link.data
  const url = urlDelLink(l.slug)

  return (
    <section aria-label="Tu link de consultas" className="mb-4 rounded-2xl bg-brand-softer px-4 py-3.5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="min-w-0 flex-1">
          <p className="m-0 flex items-center gap-2 text-[0.78rem] font-semibold text-primary-dark">
            Tu link de consultas
            {!l.activo && (
              <span className="rounded-full bg-surface px-2 py-0.5 text-[0.7rem] font-semibold text-ink-3">
                Pausado
              </span>
            )}
          </p>
          <p className="m-0 mt-0.5 truncate text-[0.92rem] font-semibold text-ink" title={url}>
            {urlVisible(l.slug)}
          </p>
        </div>
        <BotonesCompartir url={url} titulo={TITULO} texto={TEXTO} ancho />
      </div>

      <div className="mt-2 flex items-center justify-between gap-3">
        <button
          type="button"
          aria-expanded={abierto}
          aria-controls={idPanel}
          onClick={() => setAbierto((a) => !a)}
          className="-ml-1 inline-flex min-h-[36px] items-center gap-1 rounded-md px-1 text-[0.8rem] font-semibold text-primary hover:underline"
        >
          Preguntas y pausa
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
            className={`transition-transform duration-200 motion-reduce:transition-none ${abierto ? 'rotate-180' : ''}`}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        <span className="text-[0.76rem] text-ink-3 tabular-nums">
          {l.visitas === 1 ? '1 visita' : `${l.visitas} visitas`}
        </span>
      </div>

      <div id={idPanel} hidden={!abierto} className="mt-2 rounded-xl bg-surface px-3.5 py-3">
        <AjustesLink link={l} tipo="general" />
      </div>
    </section>
  )
}

/** Para el estado vacío "Bandeja al día": la invitación a compartir el link. */
export function InvitacionCompartir() {
  const link = useMiLink()
  if (!link.data) return null
  return (
    <div className="mt-5 flex flex-col items-center gap-2.5">
      <p className="m-0 text-[0.84rem] text-ink-2">Compartí tu link para que te lleguen consultas.</p>
      <BotonesCompartir url={urlDelLink(link.data.slug)} titulo={TITULO} texto={TEXTO} />
    </div>
  )
}
