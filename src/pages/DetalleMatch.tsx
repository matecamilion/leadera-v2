import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AvatarLead } from '../components/leads/AvatarLead'
import { BadgeEstado } from '../components/leads/BadgeEstado'
import { BadgeEstadoPropiedad } from '../components/propiedades/BadgeEstadoPropiedad'
import { EmailLink, TelefonoConAcciones } from '../components/comunes/AccionesContacto'
import {
  IconoCasa,
  IconoCerrar,
  IconoChat,
  IconoCheck,
  IconoFlechaAtras,
  IconoLupa,
} from '../components/leads/Iconos'
import { useDetalleMatch } from '../hooks/useBusqueda'
import { compararCriterios, type FilaComparacion } from '../lib/api/detalleMatch'
import { etiquetaTipo, formatearPrecio } from '../lib/api/propiedades'
import { linkWhatsApp } from '../lib/telefono'

/**
 * Mismos cortes de color que el badge de score de la lista de origen, para que
 * el número se lea igual de los dos lados.
 */
function estilosScore(pct: number): string {
  if (pct >= 75) return 'bg-brand-soft text-primary'
  if (pct >= 40) return 'bg-badge-tibio-bg text-badge-tibio-ink'
  return 'bg-badge-frio-bg text-frio'
}

/**
 * El detalle de una coincidencia: por qué esta propiedad le sirve a este lead.
 *
 * Se llega desde las dos listas que ya muestran coincidencias —la de la
 * operación de COMPRA y la de Mi día—, que hasta ahora linkeaban directo a la
 * ficha de la propiedad. Esta pantalla es el paso del medio: qué pide la
 * búsqueda, qué ofrece la propiedad, criterio por criterio, y a quién llamar.
 *
 * El `score_pct` viene por query string desde la card de origen y NO se
 * recalcula: el número lo calcula el RPC, y recalcularlo acá abriría la puerta
 * a que los dos digan cosas distintas. Si se entra sin él —un link pegado a
 * mano— la pantalla funciona igual, sólo que sin el badge.
 */
export default function DetalleMatch() {
  const { busquedaId = '', propiedadId = '' } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()

  const { data, isPending, isError, error } = useDetalleMatch(busquedaId, propiedadId)

  const scoreCrudo = params.get('score')
  const score = scoreCrudo != null && scoreCrudo !== '' ? Number(scoreCrudo) : null
  const scoreValido = score != null && Number.isFinite(score)

  /** Vuelve de donde vino; sin historial, a Mi día. */
  function volver() {
    if (window.history.length > 1) navigate(-1)
    else navigate('/mi-dia')
  }

  if (isPending) return <Skeleton />

  if (isError) {
    return (
      <Aviso
        titulo="No pudimos cargar la coincidencia"
        detalle={error instanceof Error ? error.message : 'Probá de nuevo en un momento.'}
      />
    )
  }

  // `null` no es un error: la búsqueda o la propiedad ya no están, o RLS las
  // tapa. Para el usuario es lo mismo y la salida es la misma.
  if (!data) {
    return (
      <Aviso
        titulo="Esta coincidencia ya no está vigente"
        detalle="La búsqueda o la propiedad se dieron de baja, o no tenés permiso para verlas."
      />
    )
  }

  const { busqueda, propiedad } = data
  const filas = compararCriterios(busqueda, propiedad)
  const lead = busqueda.lead

  const nombreLead = lead ? `${lead.nombre} ${lead.apellido ?? ''}`.trim() : null

  // El mensaje deja el chat escrito, sin enviar. La zona sale de la propiedad y
  // no de la búsqueda: es la que el lead va a ir a ver.
  const mensaje = nombreLead
    ? `Hola ${lead?.nombre}! Tengo una propiedad en ${propiedad.zona ?? propiedad.direccion} ` +
      `que coincide con lo que buscás: ${propiedad.direccion}.`
    : ''
  const whatsapp = lead?.telefono ? linkWhatsApp(lead.telefono, mensaje) : ''

  return (
    <div className="mx-auto max-w-[900px]">
      <header className="mb-6">
        <button
          type="button"
          onClick={volver}
          className="mb-3 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[0.85rem] font-semibold text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink motion-reduce:transition-none"
        >
          <IconoFlechaAtras className="size-4" />
          Volver
        </button>

        <p className="mb-1 text-xs leading-tight font-bold tracking-[0.05em] text-primary uppercase">
          Coincidencia encontrada
        </p>
        <h1 className="m-0 text-[1.6rem] leading-tight font-bold text-balance text-ink">
          {propiedad.direccion}
        </h1>

        {/* `tipo` y `estado` van acá y no en la tabla de abajo: el RPC los usa
            como filtros duros, no como criterios que puntúen. Una propiedad que
            no los pasa nunca llega a esta pantalla, así que como fila siempre
            dirían que sí y sumarían ruido. */}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="text-[0.9rem] text-ink-3">
            {etiquetaTipo(propiedad.tipo)}
            {propiedad.zona ? ` · ${propiedad.zona}` : ''}
          </span>
          <span className="text-[0.9rem] font-semibold text-ink tabular-nums">
            {formatearPrecio(propiedad.precio, propiedad.moneda)}
          </span>
          <BadgeEstadoPropiedad estado={propiedad.estado} />
        </div>

        {nombreLead && (
          <p className="mt-1.5 text-[0.9rem] text-ink-3">
            Para lo que busca {nombreLead}
          </p>
        )}
      </header>

      {/* ------------------------- COMPARACIÓN ------------------------- */}
      <section className="mb-5 overflow-hidden rounded-[16px] border border-border bg-surface">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
          <h2 className="m-0 text-xs font-bold tracking-[0.05em] text-primary uppercase">
            Criterio por criterio
          </h2>
          {/* El mismo número que ya vio en la card que lo trajo hasta acá. */}
          {scoreValido && (
            <span
              className={`rounded-full px-2.5 py-1 text-[0.78rem] font-bold ${estilosScore(score)}`}
            >
              {score}% de coincidencia
            </span>
          )}
        </header>

        {/* Encabezado de las dos columnas. Se esconde en pantallas angostas,
            donde cada fila se apila y las etiquetas de adentro alcanzan. */}
        <div className="hidden border-b border-border bg-surface-2 px-5 py-2.5 min-[640px]:grid min-[640px]:grid-cols-[1fr_auto_1fr] min-[640px]:gap-4">
          <span className="flex items-center gap-1.5 text-[0.78rem] font-bold text-ink-3 uppercase">
            <IconoCasa className="size-3.5" />
            La propiedad
          </span>
          <span className="w-6" />
          <span className="flex items-center gap-1.5 text-[0.78rem] font-bold text-ink-3 uppercase">
            <IconoLupa className="size-3.5" />
            Lo que busca
          </span>
        </div>

        <ul className="divide-y divide-border">
          {filas.map((fila) => (
            <FilaCriterio key={fila.criterio} fila={fila} />
          ))}
        </ul>
      </section>

      {/* ---------------------------- EL LEAD ---------------------------- */}
      {lead && (
        <section className="mb-5 rounded-[16px] border border-border bg-surface p-5">
          <h2 className="mb-3 text-xs font-bold tracking-[0.05em] text-primary uppercase">
            Quién la está buscando
          </h2>

          <div className="flex flex-wrap items-center gap-3">
            <AvatarLead
              nombre={lead.nombre}
              apellido={lead.apellido}
              estado={lead.estado}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[1.05rem] font-bold text-ink">{nombreLead}</span>
                <BadgeEstado estado={lead.estado} />
              </div>

              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[0.85rem] text-ink-3">
                {lead.telefono ? (
                  <TelefonoConAcciones
                    telefono={lead.telefono}
                    nombre={nombreLead ?? undefined}
                    conIcono
                  />
                ) : (
                  <span>Sin teléfono</span>
                )}
                {lead.email && <EmailLink email={lead.email} />}
              </div>
            </div>
          </div>

          {/* Un WhatsApp con el mensaje ya escrito: el agente lo revisa y
              manda. No se envía solo. */}
          {whatsapp && (
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-[0.85rem] font-semibold text-white transition-colors hover:bg-primary-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
            >
              <IconoChat className="size-4" />
              Escribirle por WhatsApp
            </a>
          )}
        </section>
      )}

      {/* ---------------------------- ACCIONES ---------------------------- */}
      <div className="flex flex-wrap gap-2">
        <Link to={`/propiedades/${propiedad.id}`} className={CLASES_ACCION}>
          Ver propiedad completa
        </Link>
        {lead && (
          <Link to={`/leads/${lead.id}`} className={CLASES_ACCION}>
            Ver lead
          </Link>
        )}
        {/* Al tab de interacciones de su ficha: el modal de alta vive en
            `DetalleLead` y montarlo también acá duplicaría el mismo formulario
            en dos pantallas por un atajo. */}
        {lead && (
          <Link to={`/leads/${lead.id}`} className={CLASES_ACCION}>
            Registrar interacción
          </Link>
        )}
      </div>
    </div>
  )
}

const CLASES_ACCION = [
  'inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface',
  'px-4 py-2.5 text-[0.85rem] font-semibold text-ink transition-colors',
  'hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2',
  'focus-visible:outline-primary motion-reduce:transition-none',
].join(' ')

/**
 * Una fila de la comparación.
 *
 * En pantallas anchas van las dos columnas con la marca en el medio; en
 * angostas se apila, con el nombre del criterio y la marca arriba y los dos
 * valores etiquetados debajo.
 */
function FilaCriterio({ fila }: { fila: FilaComparacion }) {
  return (
    <li className="px-5 py-3.5">
      <div className="mb-2 flex items-center gap-2 min-[640px]:hidden">
        <Marca cumple={fila.cumple} />
        <span className="text-[0.85rem] font-semibold text-ink-2">{fila.criterio}</span>
      </div>

      <div className="grid gap-1.5 min-[640px]:grid-cols-[1fr_auto_1fr] min-[640px]:items-center min-[640px]:gap-4">
        <span className="min-w-0">
          <span className="text-[0.72rem] font-semibold text-ink-4 uppercase min-[640px]:hidden">
            La propiedad{' '}
          </span>
          <span className="text-[0.9rem] text-ink">{fila.detallePropiedad}</span>
        </span>

        <span className="hidden min-[640px]:flex min-[640px]:flex-col min-[640px]:items-center">
          <Marca cumple={fila.cumple} />
          <span className="mt-0.5 text-[0.68rem] font-semibold text-ink-4 uppercase">
            {fila.criterio}
          </span>
        </span>

        <span className="min-w-0">
          <span className="text-[0.72rem] font-semibold text-ink-4 uppercase min-[640px]:hidden">
            Busca{' '}
          </span>
          <span
            className={`text-[0.9rem] ${fila.cumple == null ? 'text-ink-4 italic' : 'text-ink'}`}
          >
            {fila.detalleBusqueda}
          </span>
        </span>
      </div>
    </li>
  )
}

/**
 * Check, cruz, o guión.
 *
 * El guión es "sin preferencia": la búsqueda no pidió nada en ese campo, así
 * que no hay nada que cumplir ni que fallar. Marcarlo con cruz sería contar en
 * contra de la propiedad algo que el lead nunca pidió.
 */
function Marca({ cumple }: { cumple: boolean | null }) {
  if (cumple == null) {
    return (
      <span
        aria-label="Sin preferencia"
        title="Sin preferencia"
        className="grid size-6 shrink-0 place-items-center rounded-full bg-surface-2 text-[0.8rem] font-bold text-ink-4"
      >
        –
      </span>
    )
  }

  return cumple ? (
    <span
      aria-label="Cumple"
      title="Cumple"
      className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-soft text-primary"
    >
      <IconoCheck className="size-3.5" />
    </span>
  ) : (
    <span
      aria-label="No cumple"
      title="No cumple"
      className="grid size-6 shrink-0 place-items-center rounded-full bg-peligro-soft text-peligro-ink"
    >
      <IconoCerrar className="size-3.5" />
    </span>
  )
}

function Aviso({ titulo, detalle }: { titulo: string; detalle: string }) {
  return (
    <div className="mx-auto max-w-[900px]">
      <div className="rounded-[16px] border border-dashed border-border bg-surface px-5 py-12 text-center">
        <h1 className="m-0 text-[1.15rem] font-bold text-ink">{titulo}</h1>
        <p className="mt-1.5 text-[0.9rem] text-ink-3">{detalle}</p>
        <Link
          to="/mi-dia"
          className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-[0.85rem] font-semibold text-white transition-colors hover:bg-primary-dark motion-reduce:transition-none"
        >
          Volver a Mi día
        </Link>
      </div>
    </div>
  )
}

function Skeleton() {
  return (
    <div aria-busy="true" aria-label="Cargando la coincidencia" className="mx-auto max-w-[900px]">
      <div className="mb-2 h-8 w-64 max-w-full animate-pulse rounded-lg bg-surface-2 motion-reduce:animate-none" />
      <div className="mb-6 h-5 w-48 max-w-full animate-pulse rounded bg-surface-2 motion-reduce:animate-none" />
      <div className="mb-5 h-80 animate-pulse rounded-[16px] bg-surface-2 motion-reduce:animate-none" />
      <div className="h-32 animate-pulse rounded-[16px] bg-surface-2 motion-reduce:animate-none" />
    </div>
  )
}
