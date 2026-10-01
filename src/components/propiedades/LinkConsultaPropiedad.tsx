import { useId, useState, type ReactNode } from 'react'
import { useMiLink } from '../../hooks/useLinkConsulta'
import {
  etiquetaEstado,
  etiquetaTipo,
  formatearPrecio,
  type EstadoPropiedad,
  type TipoPropiedad,
} from '../../lib/api/propiedades'
import { AjustesLink } from '../consultas/AjustesLink'
import { BotonesCompartir } from '../consultas/BotonesCompartir'
import { copiarTexto, urlDelLink, urlVisible } from '../consultas/compartir'
import { IconoCerrar } from '../leads/Iconos'

interface Propiedad {
  id: string
  tipo: TipoPropiedad
  zona: string | null
  precio: number | null
  moneda: string
  estado: EstadoPropiedad
}

/**
 * El botón de la fila de acciones. El link se crea recién la primera vez que
 * se abre el panel; mientras tanto el botón muestra que está trabajando.
 */
export function BotonLinkConsultas({
  propiedadId,
  abierto,
  onAlternar,
}: {
  propiedadId: string
  abierto: boolean
  onAlternar: () => void
}) {
  const link = useMiLink(propiedadId, abierto)
  const cargando = abierto && link.isPending
  return (
    <button
      type="button"
      onClick={onAlternar}
      aria-expanded={abierto}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3.5 py-2 text-[0.82rem] font-semibold whitespace-nowrap text-ink transition-colors hover:bg-background motion-reduce:transition-none"
    >
      {cargando ? (
        <span className="size-4 animate-spin rounded-full border-2 border-border border-t-primary motion-reduce:animate-none" />
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12Z" />
          <path d="M8.5 10.5h7M8.5 13.5h4.5" />
        </svg>
      )}
      Link de consultas
    </button>
  )
}

/** El texto del posteo: tipo, zona y precio; nunca la dirección (igual que la página pública). */
function textoSugerido(p: Propiedad, url: string): string {
  const enZona = p.zona ? ` en ${p.zona}` : ''
  const lugar = `${etiquetaTipo(p.tipo)}${enZona}`
  if (p.estado !== 'DISPONIBLE') {
    // Solo el tipo en minúscula: la zona es un nombre propio.
    return `¿Buscás algo parecido a este ${etiquetaTipo(p.tipo).toLowerCase()}${enZona}? Contame qué necesitás y te ayudo: ${url}`
  }
  const precio = p.precio != null ? ` · ${formatearPrecio(p.precio, p.moneda)}` : ''
  return `${lugar}${precio}. ¿Te interesa? Dejame tu consulta acá y te respondo enseguida: ${url}`
}

/**
 * El panel del link de una propiedad: a todo el ancho de la tarjeta, debajo
 * del header, en mobile y en desktop.
 */
export function PanelLinkPropiedad({ propiedad, onCerrar }: { propiedad: Propiedad; onCerrar: () => void }) {
  const link = useMiLink(propiedad.id, true)
  const idTexto = useId()

  return (
    <section
      aria-label="Link de consultas de esta propiedad"
      className="mb-6 rounded-2xl bg-brand-softer px-4 py-4 sm:px-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="m-0 text-[0.95rem] font-bold text-ink">Link de consultas</h2>
          <p className="m-0 mt-0.5 text-[0.8rem] text-ink-3">
            Pegalo en el posteo: quien consulte llega a tu bandeja con la propiedad ya identificada.
          </p>
        </div>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar el panel del link"
          className="-mt-1 -mr-1 inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-ink-3 hover:bg-surface hover:text-ink"
        >
          <IconoCerrar className="size-4" />
        </button>
      </div>

      {link.isPending ? (
        <div aria-busy="true" aria-label="Creando el link" className="mt-4 h-24 animate-pulse rounded-xl bg-surface motion-reduce:animate-none" />
      ) : link.isError ? (
        <p role="alert" className="mt-4 mb-0 rounded-lg bg-peligro-soft px-3.5 py-2.5 text-[0.84rem] text-peligro-ink">
          {link.error.message}
        </p>
      ) : (
        <Contenido propiedad={propiedad} slug={link.data.slug} idTexto={idTexto}>
          <AjustesLink link={link.data} tipo="propiedad" />
          <p className="m-0 mt-3 text-[0.76rem] text-ink-3 tabular-nums">
            {link.data.visitas === 1 ? '1 visita' : `${link.data.visitas} visitas`}
            {!link.data.activo && ' · pausado'}
          </p>
        </Contenido>
      )}
    </section>
  )
}

function Contenido({
  propiedad,
  slug,
  idTexto,
  children,
}: {
  propiedad: Propiedad
  slug: string
  idTexto: string
  children: ReactNode
}) {
  const url = urlDelLink(slug)
  // Editable y no se guarda: se arma de nuevo cada vez a partir de la propiedad.
  const [texto, setTexto] = useState(() => textoSugerido(propiedad, url))
  const [copiado, setCopiado] = useState(false)

  async function copiarPosteo() {
    setCopiado(await copiarTexto(texto))
    window.setTimeout(() => setCopiado(false), 2000)
  }

  const disponible = propiedad.estado === 'DISPONIBLE'

  return (
    <>
      <div className="mt-3.5 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <p className="m-0 min-w-0 flex-1 truncate text-[0.92rem] font-semibold text-ink" title={url}>
          {urlVisible(slug)}
        </p>
        <BotonesCompartir url={url} titulo={etiquetaTipo(propiedad.tipo)} texto={texto.replace(url, '').trim()} ancho />
      </div>

      {!disponible && (
        <p className="m-0 mt-3 rounded-lg bg-surface px-3.5 py-2.5 text-[0.82rem] text-ink-2">
          Está <strong className="font-semibold">{etiquetaEstado(propiedad.estado)}</strong>: quien
          abra el link va a ver que ya no está disponible y te va a dejar igual lo que busca.
        </p>
      )}

      <div className="mt-3.5">
        <label htmlFor={idTexto} className="block text-[0.8rem] font-semibold text-ink">
          Texto para el posteo
        </label>
        <textarea
          id={idTexto}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={4}
          className="mt-1.5 block w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-[0.88rem] leading-relaxed text-ink focus:border-primary focus:outline-2 focus:outline-offset-0 focus:outline-primary"
        />
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={copiarPosteo}
            className={[
              'inline-flex min-h-[44px] w-full items-center justify-center rounded-lg border px-3.5 text-[0.86rem] font-semibold transition-colors motion-reduce:transition-none sm:min-h-[38px] sm:w-auto',
              copiado
                ? 'border-primary bg-brand-soft text-primary-dark'
                : 'border-border bg-surface text-ink-2 hover:border-primary/50 hover:text-primary',
            ].join(' ')}
          >
            {copiado ? 'Texto copiado' : 'Copiar texto'}
          </button>
          <span aria-live="polite" className="sr-only">
            {copiado ? 'Texto copiado' : ''}
          </span>
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-surface px-3.5 py-3">{children}</div>
    </>
  )
}
