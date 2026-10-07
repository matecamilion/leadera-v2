import { useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useResumenGestion } from '../../hooks/useModeloGestion'
import type { MetricaGestion, PeriodoGestion } from '../../lib/api/modeloGestion'
import {
  escribirPanel,
  etiquetaDia,
  leerPanel,
  META_DIARIA_VERDES,
  METAS_SEMANALES,
  METRICAS,
} from '../../lib/detalleGestion'
import { calcularRitmo, hoyEnArgentina } from '../../lib/ritmoSemanal'
import { TooltipAyuda } from '../comunes/TooltipAyuda'
import { IconoCheck } from '../leads/Iconos'
import { AnilloProgreso } from './AnilloProgreso'
import { PanelDetalleGestion, TextoRitmo } from './PanelDetalleGestion'
import { SeccionCard } from './SeccionCard'

const CLAVE_VISTA = 'leadera.modelo-gestion.vista'

/**
 * La vista elegida vive en el navegador: es una preferencia de pantalla, no un
 * dato del agente. En try/catch por lo mismo que `AvisoReporteSemanal`: en
 * incógnito o con el sitio bloqueado `localStorage` tira, y eso no puede
 * romper Mi día. Sin storage arranca siempre en Semana.
 */
function leerVista(): PeriodoGestion {
  try {
    return localStorage.getItem(CLAVE_VISTA) === 'dia' ? 'dia' : 'semana'
  } catch {
    return 'semana'
  }
}

function guardarVista(vista: PeriodoGestion): void {
  try {
    localStorage.setItem(CLAVE_VISTA, vista)
  } catch {
    // La próxima vez vuelve a Semana. Es molesto, no roto.
  }
}

const TITULOS: Record<PeriodoGestion, string> = { dia: 'Tu día', semana: 'Tu semana' }

/**
 * El modelo de gestión en Mi día, por día o por semana: actividades verdes,
 * prelistings/prebuyings y nuevos contactos contra sus metas.
 *
 * Las metas son semanales. En Día sólo las reuniones y visitas tienen meta
 * propia (el ritmo diario); los otros dos anillos siguen mostrando la semana y
 * lo de hoy va abajo, en el detalle.
 *
 * Cada anillo tiene un "Ver detalle" que abre el panel con lo que suma a ese
 * número. El panel abierto vive en la URL
 * (`?detalle=…&periodo=…&ref=…`): abrir es un push, así "atrás" lo cierra.
 */
export function TarjetaSemanaGestion() {
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const estadoPanel = leerPanel(params, hoyEnArgentina())
  // Si se abrió desde la tarjeta, cerrar es volver atrás: la entrada del
  // historial que agregó el push se consume. Si vino de un link pegado o de
  // un F5 sin esa marca, volver atrás podría sacar al usuario de la app, así
  // que se sacan los params en el lugar.
  const abiertoDesdeTarjeta =
    (location.state as { desdeTarjeta?: boolean } | null)?.desdeTarjeta === true

  function cerrarPanel() {
    if (abiertoDesdeTarjeta) navigate(-1)
    else setParams(escribirPanel(params, null), { replace: true })
  }

  function cambiarReferencia(referencia: string | null) {
    if (!estadoPanel) return
    // replace: moverse entre períodos no suma entradas al historial, y se
    // conserva la marca de origen para que cerrar siga volviendo atrás.
    setParams(escribirPanel(params, { ...estadoPanel, referencia }), {
      replace: true,
      state: location.state,
    })
  }

  return (
    <>
      <ContenidoTarjeta params={params} />
      <PanelDetalleGestion
        estado={estadoPanel}
        onCerrar={cerrarPanel}
        onCambiarReferencia={cambiarReferencia}
      />
    </>
  )
}

/**
 * La tarjeta en sí. Se piden las dos ventanas siempre: Día necesita también la
 * semana, y así cambiar de vista no pasa por el skeleton. Sólo se monta con el
 * flag prendido, así que las queries arrancan habilitadas.
 */
function ContenidoTarjeta({ params }: { params: URLSearchParams }) {
  const [vista, setVista] = useState<PeriodoGestion>(leerVista)
  const navigate = useNavigate()
  const enlace = (metrica: MetricaGestion) => (
    <EnlaceDetalle metrica={metrica} vista={vista} params={params} />
  )
  // El círculo de cada anillo abre lo mismo que su "Ver detalle": mismo
  // destino y misma marca en el state, así cerrar vuelve atrás igual.
  const tocable = (metrica: MetricaGestion) => ({
    alTocar: () => navigate(destinoDetalle(params, metrica, vista), { state: DESDE_TARJETA }),
    etiquetaAccion: `Ver detalle de ${METRICAS[metrica].nombre}`,
  })
  const semana = useResumenGestion('semana', true)
  const dia = useResumenGestion('dia', true)

  function cambiarVista(nueva: PeriodoGestion) {
    setVista(nueva)
    guardarVista(nueva)
  }

  // La semana hace falta en las dos vistas; el día, sólo en la suya.
  const pendiente = semana.isPending || (vista === 'dia' && dia.isPending)
  if (pendiente) return <Skeleton />

  if (!semana.data || (vista === 'dia' && !dia.data)) {
    return (
      <Marco
        vista={vista}
        onCambiarVista={cambiarVista}
        subtitulo="Reuniones, prelistings y contactos nuevos"
      >
        <p
          role="alert"
          className="mt-2 rounded-lg border border-peligro-borde bg-peligro-soft px-3 py-2 text-[0.8rem] text-peligro-ink"
        >
          {vista === 'dia'
            ? 'No pudimos cargar el resumen de tu día.'
            : 'No pudimos cargar el resumen de tu semana.'}
        </p>
      </Marco>
    )
  }

  const s = semana.data
  const preListingBuyingSemana = s.prelistings + s.prebuyings
  const nuevosCumplido = s.nuevos_contactos >= METAS_SEMANALES.nuevosContactos

  if (vista === 'dia' && dia.data) {
    const d = dia.data
    return (
      <Marco vista={vista} onCambiarVista={cambiarVista} subtitulo={`hoy ${etiquetaDia(d.periodo_inicio)}`}>
        <Anillos>
          <AnilloProgreso
            {...tocable('verdes')}
            etiqueta="Reuniones y visitas"
            ayuda={<AyudaVerdes />}
            valor={d.verdes}
            meta={META_DIARIA_VERDES}
            detalle={
              <>
                <span className="block tabular-nums">
                  Semana {s.verdes} de {METAS_SEMANALES.verdes}
                </span>
                {enlace('verdes')}
              </>
            }
          />
          <AnilloProgreso
            {...tocable('pre')}
            etiqueta="Prelistings / prebuyings"
            ayuda={<AyudaPre />}
            valor={preListingBuyingSemana}
            meta={METAS_SEMANALES.preListingBuying}
            detalle={
              <>
                <HoyYSemana
                  hoy={d.prelistings + d.prebuyings}
                  semana={preListingBuyingSemana}
                  meta={METAS_SEMANALES.preListingBuying}
                />
                {enlace('pre')}
              </>
            }
          />
          <AnilloProgreso
            {...tocable('nuevos')}
            etiqueta="Contactos nuevos"
            ayuda={<AyudaNuevos />}
            valor={s.nuevos_contactos}
            meta={METAS_SEMANALES.nuevosContactos}
            detalle={
              <>
                <HoyYSemana
                  hoy={d.nuevos_contactos}
                  semana={s.nuevos_contactos}
                  meta={METAS_SEMANALES.nuevosContactos}
                />
                {enlace('nuevos')}
              </>
            }
          />
        </Anillos>
      </Marco>
    )
  }

  const ritmoVerdes = calcularRitmo(s.verdes, METAS_SEMANALES.verdes, s.dia_actual, s.dias_totales)
  const ritmoPre = calcularRitmo(
    preListingBuyingSemana,
    METAS_SEMANALES.preListingBuying,
    s.dia_actual,
    s.dias_totales,
  )

  return (
    <Marco
      vista={vista}
      onCambiarVista={cambiarVista}
      subtitulo={`${etiquetaDia(s.periodo_inicio)} → ${etiquetaDia(s.periodo_fin)}`}
    >
      <Anillos>
        <AnilloProgreso
          {...tocable('verdes')}
          etiqueta="Reuniones y visitas"
          ayuda={<AyudaVerdes />}
          valor={s.verdes}
          meta={METAS_SEMANALES.verdes}
          marcaEsperado={ritmoVerdes.esperado}
          alerta={!ritmoVerdes.alDia}
          detalle={
            <>
              <TextoRitmo ritmo={ritmoVerdes} />
              {enlace('verdes')}
            </>
          }
        />
        <AnilloProgreso
          {...tocable('pre')}
          etiqueta="Prelistings / prebuyings"
          ayuda={<AyudaPre />}
          valor={preListingBuyingSemana}
          meta={METAS_SEMANALES.preListingBuying}
          marcaEsperado={ritmoPre.esperado}
          alerta={!ritmoPre.alDia}
          detalle={
            <>
              <span className="block tabular-nums">
                Prelisting {s.prelistings} · Prebuying {s.prebuyings}
              </span>
              <TextoRitmo ritmo={ritmoPre} />
              {enlace('pre')}
            </>
          }
        />
        <AnilloProgreso
          {...tocable('nuevos')}
          etiqueta="Contactos nuevos"
          ayuda={<AyudaNuevos />}
          valor={s.nuevos_contactos}
          meta={METAS_SEMANALES.nuevosContactos}
          detalle={
            <>
              <span className={`block font-semibold ${nuevosCumplido ? 'text-primary' : 'text-ink-3'}`}>
                {nuevosCumplido ? 'Cumplido' : 'Pendiente'}
              </span>
              {enlace('nuevos')}
            </>
          }
        />
      </Anillos>
    </Marco>
  )
}

/**
 * La card con su fila de "Cómo se lee" y el selector, igual en las dos vistas
 * y en el error: si falla sólo el día, se puede volver a la semana.
 */
function Marco({
  vista,
  onCambiarVista,
  subtitulo,
  children,
}: {
  vista: PeriodoGestion
  onCambiarVista: (vista: PeriodoGestion) => void
  subtitulo: string
  children: ReactNode
}) {
  return (
    <SeccionCard icono={<IconoCheck className="size-4" />} tono="brand" titulo={TITULOS[vista]} subtitulo={subtitulo}>
      {/* La ayuda del título va acá y no al lado de "Tu semana": `SeccionCard`
          recibe el título como string y no admite un nodo al lado. Por lo
          mismo el selector va en esta fila y no en el header. */}
      <div className="mt-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 text-[0.75rem] text-ink-3">
          <span>Cómo se lee</span>
          {vista === 'dia' ? (
            <TooltipAyuda etiqueta="tu día">
              Lo que hiciste hoy. Las reuniones y visitas se miden contra el ritmo diario
              ({METAS_SEMANALES.verdes} por semana, unas {META_DIARIA_VERDES} por día).
              Prelistings, prebuyings y contactos nuevos no tienen meta diaria: el anillo
              muestra la semana y abajo, lo de hoy.
            </TooltipAyuda>
          ) : (
            <TooltipAyuda etiqueta="tu semana">
              Mínimos semanales para sostener el negocio. La semana va de miércoles a
              martes. La marca en cada anillo indica cuánto deberías llevar a hoy.
            </TooltipAyuda>
          )}
        </div>
        <SelectorVista vista={vista} onCambiar={onCambiarVista} />
      </div>

      {children}
    </SeccionCard>
  )
}

const OPCIONES_VISTA: { valor: PeriodoGestion; label: string }[] = [
  { valor: 'dia', label: 'Día' },
  { valor: 'semana', label: 'Semana' },
]

/**
 * Día / Semana. Mismo aspecto que las pills de período de `GraficoEvolucion`,
 * pero como botones con `aria-pressed`: cambian los números de la misma card,
 * no muestran otro panel, así que no son pestañas.
 */
function SelectorVista({
  vista,
  onCambiar,
}: {
  vista: PeriodoGestion
  onCambiar: (vista: PeriodoGestion) => void
}) {
  return (
    <div
      role="group"
      aria-label="Período"
      className="flex shrink-0 rounded-lg border border-border bg-surface-2 p-0.5"
    >
      {OPCIONES_VISTA.map((opcion) => {
        const activo = opcion.valor === vista
        return (
          <button
            key={opcion.valor}
            type="button"
            aria-pressed={activo}
            onClick={() => onCambiar(opcion.valor)}
            className={[
              'rounded-md px-2.5 py-1 text-[0.78rem] font-semibold transition-colors motion-reduce:transition-none',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
              activo ? 'bg-primary text-primary-contrast' : 'text-ink-2 hover:bg-surface',
            ].join(' ')}
          >
            {opcion.label}
          </button>
        )
      })}
    </div>
  )
}

/** Tres columnas también en mobile: a 84px los anillos entran en un teléfono
 *  de 360px y se leen como un solo tablero, que es la idea. */
function Anillos({ children }: { children: ReactNode }) {
  return <div className="mt-3 grid grid-cols-3 items-start gap-2 sm:gap-4">{children}</div>
}

function AyudaVerdes() {
  return (
    <TooltipAyuda etiqueta="las reuniones y visitas">
      Visitas y reuniones con clientes, prospectos o colegas, presenciales o por
      videollamada: es la actividad que genera negocios. Mínimo recomendado:{' '}
      {METAS_SEMANALES.verdes} por semana (unas {META_DIARIA_VERDES} por día).
    </TooltipAyuda>
  )
}

function AyudaPre() {
  return (
    <TooltipAyuda etiqueta="los prelistings y prebuyings">
      Reuniones con un propietario para captar su propiedad (prelisting) o con un
      comprador para entender su búsqueda (prebuying). Para que cuenten, al cargar
      una reunión elegí el tipo. Mínimo recomendado: {METAS_SEMANALES.preListingBuying} por
      semana.
    </TooltipAyuda>
  )
}

function AyudaNuevos() {
  return (
    <TooltipAyuda etiqueta="los contactos nuevos">
      Leads propios o referidos que sumaste (origen Referido o Manual). Mínimo
      recomendado: {METAS_SEMANALES.nuevosContactos} por semana.
    </TooltipAyuda>
  )
}

/** "Hoy 1 · semana 2 de 3", para las metas que no se llevan al día. */
function HoyYSemana({ hoy, semana, meta }: { hoy: number; semana: number; meta: number }) {
  return (
    <span className="block tabular-nums">
      <span className="font-semibold text-ink-2">Hoy {hoy}</span> · semana {semana} de {meta}
    </span>
  )
}

/** La marca que distingue "lo abrí desde la tarjeta" de un link pegado o un F5. */
const DESDE_TARJETA = { desdeTarjeta: true } as const

/** El panel de una métrica, en el período que muestra la tarjeta. */
function destinoDetalle(params: URLSearchParams, metrica: MetricaGestion, vista: PeriodoGestion) {
  return { search: `?${escribirPanel(params, { metrica, periodo: vista, referencia: null }).toString()}` }
}

/**
 * "Ver detalle" debajo de cada anillo. Es un link aparte y no el anillo
 * envuelto en un botón: el anillo ya tiene adentro el botón del tooltip, y un
 * interactivo dentro de otro no es válido ni se lee bien.
 *
 * Abre el panel en el período que muestra la tarjeta. Es un push con la marca
 * `desdeTarjeta`, para que cerrar pueda volver atrás.
 */
function EnlaceDetalle({
  metrica,
  vista,
  params,
}: {
  metrica: MetricaGestion
  vista: PeriodoGestion
  params: URLSearchParams
}) {
  return (
    <Link
      to={destinoDetalle(params, metrica, vista)}
      state={DESDE_TARJETA}
      className="mt-1 inline-block rounded-sm text-[0.75rem] font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      Ver detalle
      <span className="sr-only"> de {METRICAS[metrica].nombre.toLowerCase()}</span>
    </Link>
  )
}

/**
 * Mismo skeleton que las secciones de Mi día: barra de título y bloque, del
 * alto de la tarjeta con sus anillos, la fila del selector y el "Ver detalle".
 * Es el mismo en las dos vistas, así la página no salta.
 */
function Skeleton() {
  return (
    <div aria-hidden className="mb-4">
      <div className="mb-3 h-8 w-56 animate-pulse rounded bg-surface-2 motion-reduce:animate-none" />
      <div className="h-[228px] animate-pulse rounded-2xl bg-surface-2 motion-reduce:animate-none sm:h-[256px]" />
    </div>
  )
}
