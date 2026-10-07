import { useId, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BarraCriterios } from '../components/coincidencias/BarraCriterios'
import { DemandaActiva } from '../components/coincidencias/DemandaActiva'
import {
  ResultadosCompradores,
  type LeadARegistrar,
} from '../components/coincidencias/ResultadosCompradores'
import { BotonError, EstadoError } from '../components/comunes/EstadoError'
import { ModalNuevaInteraccion } from '../components/leads/ModalNuevaInteraccion'
import {
  useBuscarCompradores,
  useDemandaActiva,
  useZonasConocidas,
} from '../hooks/useBusqueda'
import {
  hayCriterioDeOferta,
  mejorBusquedaPorLead,
  type CompradorParaOferta,
  type CriteriosOferta,
} from '../lib/api/busquedas'
import { mensajeDeListado } from '../lib/mensajesDeError'
import {
  OFERTA_VACIA,
  escribirOferta,
  escribirOrden,
  leerOferta,
  leerOrden,
  resumenDeOferta,
  type OrdenOferta,
} from '../lib/ofertaEnUrl'
import { useUiStore } from '../stores/ui'

/**
 * Coincidencias: el agente cuenta qué tiene para ofrecer y la página muestra
 * a qué compradores (o inquilinos) les sirve, con el RPC buscar_compradores.
 *
 * Patrón de portal inmobiliario: barra de búsqueda arriba y resultados a todo
 * el ancho. Los criterios y el orden viven en la URL (`?of_*`, `?orden=`),
 * igual que los filtros de los listados: sobreviven a entrar a una ficha y
 * volver, a un F5, y se pueden compartir.
 */
export default function Coincidencias() {
  const [searchParams, setSearchParams] = useSearchParams()
  const oferta = useMemo(() => leerOferta(searchParams), [searchParams])
  const orden = leerOrden(searchParams)
  const hayOferta = hayCriterioDeOferta(oferta)
  // Lo aplicado como texto: remonta la barra cuando cambia la URL, para que su
  // borrador arranque siempre de lo que se está viendo.
  const claveOferta = escribirOferta(new URLSearchParams(), oferta).toString()

  const [leadARegistrar, setLeadARegistrar] = useState<LeadARegistrar | null>(null)
  const mostrarAviso = useUiStore((s) => s.mostrarAviso)

  const zonas = useZonasConocidas()
  const demanda = useDemandaActiva(!hayOferta)
  // Sin criterios se le pasa la oferta vacía, que deja la query apagada.
  const compradores = useBuscarCompradores(hayOferta ? oferta : OFERTA_VACIA)

  /**
   * Una fila por lead, en el orden elegido, partida en dos grupos: los que
   * coinciden en algo (o no tenían nada que puntuar) y los que no cumplen
   * ningún criterio puntuable, que sólo pasaron los filtros duros.
   */
  const { coinciden, otros } = useMemo(() => {
    const porLead = mejorBusquedaPorLead(compradores.data ?? [])
    const ordenados =
      orden === 'coincidencia'
        ? porLead
        : [...porLead].sort(
            (a, b) => Date.parse(b.busqueda_created_at) - Date.parse(a.busqueda_created_at),
          )
    return {
      coinciden: ordenados.filter((c) => c.score_pct == null || c.score_pct > 0),
      otros: ordenados.filter((c) => c.score_pct === 0),
    }
  }, [compradores.data, orden])

  /** Aplica (o limpia, con null). Con `replace`, igual que los filtros de los listados. */
  function cambiarOferta(criterios: CriteriosOferta | null) {
    setSearchParams(
      (previos) => {
        const proximos = escribirOferta(previos, criterios)
        // Limpiar es empezar de cero: el orden también vuelve al de siempre.
        return criterios ? proximos : escribirOrden(proximos, 'coincidencia')
      },
      { replace: true },
    )
  }

  function cambiarOrden(valor: OrdenOferta) {
    setSearchParams((previos) => escribirOrden(previos, valor), { replace: true })
  }

  const alquiler = oferta.tipoOperacion === 'ALQUILER'
  const quienes = alquiler ? 'inquilinos' : 'compradores'
  const quien = alquiler ? 'inquilino' : 'comprador'

  return (
    <div className="mx-auto w-full max-w-[1400px] text-ink">
      <header className="mb-5">
        <h1 className="m-0 text-[2rem] leading-tight font-bold text-ink">Coincidencias</h1>
        <p className="mt-1 mb-0 text-ink-3">
          Contá qué tenés para ofrecer y te mostramos a quién le sirve.
        </p>
      </header>

      <BarraCriterios
        key={claveOferta}
        aplicados={oferta}
        zonas={zonas.data ?? []}
        onBuscar={cambiarOferta}
      />

      <section aria-label="Resultados" className="mt-5">
        {!hayOferta ? (
          demanda.isPending ? (
            <Skeleton />
          ) : demanda.isError ? (
            <EstadoError
              titulo="No pudimos cargar las búsquedas activas"
              mensaje={mensajeDeListado(demanda.error)}
              accion={<BotonError onClick={() => demanda.refetch()}>Reintentar</BotonError>}
            />
          ) : (
            <DemandaActiva
              demanda={demanda.data}
              onElegirTipo={(tipo) => cambiarOferta({ ...OFERTA_VACIA, tipoPropiedad: tipo })}
              onElegirZona={(zona) => cambiarOferta({ ...OFERTA_VACIA, zona })}
            />
          )
        ) : (
          <>
            <div className="mb-4 flex flex-col gap-3 border-b border-border pb-4 md:flex-row md:items-center md:justify-between">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                {resumenDeOferta(oferta).map((pieza) => (
                  <span
                    key={pieza}
                    className="rounded-full border border-border bg-surface-2 px-2.5 py-0.5 text-[0.8rem] font-medium text-ink-2"
                  >
                    {pieza}
                  </span>
                ))}
                <button
                  type="button"
                  onClick={() => cambiarOferta(null)}
                  className="ml-1 rounded-md px-1.5 py-0.5 text-[0.82rem] font-semibold text-ink-3 underline-offset-2 transition-colors hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
                >
                  Limpiar
                </button>
              </div>

              <div className="flex shrink-0 items-center gap-4">
                <p role="status" className="m-0 text-[0.95rem] font-bold whitespace-nowrap text-ink">
                  {compradores.isPending
                    ? `Buscando ${quienes}…`
                    : compradores.isError
                      ? ''
                      : `${coinciden.length} ${coinciden.length === 1 ? quien : quienes}`}
                </p>
                <label className="flex items-center gap-2 text-[0.85rem] whitespace-nowrap text-ink-3">
                  <span className="sr-only md:not-sr-only">Ordenar por</span>
                  <select
                    value={orden}
                    onChange={(e) =>
                      cambiarOrden(e.target.value === 'reciente' ? 'reciente' : 'coincidencia')
                    }
                    className="h-9 rounded-lg border border-border bg-surface px-2.5 text-[0.85rem] font-semibold text-ink focus:border-primary focus:outline-none"
                  >
                    <option value="coincidencia">Mejor coincidencia</option>
                    <option value="reciente">Búsqueda más reciente</option>
                  </select>
                </label>
              </div>
            </div>

            {compradores.isPending ? (
              <Skeleton />
            ) : compradores.isError ? (
              <EstadoError
                titulo={`No pudimos buscar ${quienes}`}
                mensaje={mensajeDeListado(compradores.error)}
                accion={<BotonError onClick={() => compradores.refetch()}>Reintentar</BotonError>}
              />
            ) : coinciden.length === 0 && otros.length === 0 ? (
              <p className="m-0 rounded-[16px] border border-dashed border-border bg-surface px-5 py-10 text-center text-ink-3">
                Ningún {quien} encaja con esto. Probá sacar la zona o ampliar el precio.
              </p>
            ) : (
              <>
                {coinciden.length > 0 ? (
                  <ResultadosCompradores
                    compradores={coinciden}
                    conPrecio={oferta.precio != null}
                    onRegistrar={setLeadARegistrar}
                  />
                ) : (
                  <p className="m-0 mb-3 rounded-[16px] border border-dashed border-border bg-surface px-5 py-6 text-center text-[0.9rem] text-ink-3">
                    Ningún {quien} coincide en zona ni en características.{' '}
                    {oferta.precio != null
                      ? 'Estos tienen el presupuesto para lo que ofrecés:'
                      : 'Estos buscan lo mismo, pero no coinciden en nada más:'}
                  </p>
                )}

                {otros.length > 0 && (
                  <GrupoOtros
                    // Por búsqueda: cada búsqueda nueva arranca plegada (o abierta si es lo único).
                    key={claveOferta}
                    otros={otros}
                    conPrecio={oferta.precio != null}
                    abiertoDeEntrada={coinciden.length === 0}
                    onRegistrar={setLeadARegistrar}
                  />
                )}
              </>
            )}
          </>
        )}
      </section>

      {/* Montado sólo con un lead elegido, para que el formulario arranque limpio. */}
      {leadARegistrar && (
        <ModalNuevaInteraccion
          abierto
          leadId={leadARegistrar.id}
          nombreLead={`${leadARegistrar.nombre} ${leadARegistrar.apellido ?? ''}`.trim()}
          onCerrar={() => setLeadARegistrar(null)}
          onCreada={() => mostrarAviso('Interacción registrada.')}
        />
      )}
    </div>
  )
}

/**
 * Los que pasaron los filtros duros pero no cumplen ningún criterio puntuable
 * (score 0). Plegados por defecto: son la segunda opción, no la respuesta.
 */
function GrupoOtros({
  otros,
  conPrecio,
  abiertoDeEntrada,
  onRegistrar,
}: {
  otros: CompradorParaOferta[]
  conPrecio: boolean
  abiertoDeEntrada: boolean
  onRegistrar: (lead: LeadARegistrar) => void
}) {
  const id = useId()
  const [abierto, setAbierto] = useState(abiertoDeEntrada)
  const n = otros.length
  // "Presupuesto compatible" sólo es cierto si se ofreció un precio: el RPC
  // filtra por precio sólo cuando viene.
  const titulo = conPrecio
    ? `Otros ${n} con presupuesto compatible, pero distinta zona o características`
    : `Otros ${n} que no coinciden en zona ni características`

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        aria-expanded={abierto}
        aria-controls={`${id}-lista`}
        className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-surface-2 px-4 py-3 text-left text-[0.9rem] font-semibold text-ink-2 transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
      >
        {titulo}
        <span aria-hidden className="text-ink-3">
          {abierto ? '▲' : '▼'}
        </span>
      </button>
      {abierto && (
        <div id={`${id}-lista`} className="mt-3">
          <ResultadosCompradores
            compradores={otros}
            conPrecio={conPrecio}
            onRegistrar={onRegistrar}
          />
        </div>
      )}
    </div>
  )
}

function Skeleton() {
  return (
    <div aria-busy="true" aria-label="Cargando" className="space-y-3">
      {Array.from({ length: 4 }, (_, i) => (
        <div
          key={i}
          className="h-24 animate-pulse rounded-[16px] bg-surface-2 motion-reduce:animate-none"
        />
      ))}
    </div>
  )
}
