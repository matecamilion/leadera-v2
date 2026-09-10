import { lazy, Suspense, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { IconoCalendario, IconoFlechaAtras, IconoLapiz, IconoLink, IconoTacho } from '../components/leads/Iconos'
import { ModalConfirmarEliminar } from '../components/comunes/ModalConfirmarEliminar'
import { ModalNuevaVisita } from '../components/tareas/ModalNuevaVisita'
import { BadgeEstadoPropiedad } from '../components/propiedades/BadgeEstadoPropiedad'
import { GaleriaFotos } from '../components/propiedades/GaleriaFotos'
import { GrupoEstadoPropiedad } from '../components/propiedades/GrupoEstadoPropiedad'
import { ModalEditarPropiedad } from '../components/propiedades/ModalEditarPropiedad'
import { SeccionCoincidenciasInternas } from '../components/propiedades/SeccionCoincidenciasInternas'
import { SeccionActividadVisitas } from '../components/propiedades/SeccionActividadVisitas'
import { SeccionLeadPropietario } from '../components/propiedades/SeccionLeadPropietario'
import { SeccionOperacionesVinculadas } from '../components/propiedades/SeccionOperacionesVinculadas'
import { useCoincidenciasInternas } from '../hooks/useCoincidenciasInternas'
import {
  useActualizarEstadoPropiedad,
  useActualizarPropiedad,
  useDetallePropiedad,
  useEliminarPropiedad,
} from '../hooks/useDetallePropiedad'
import {
  etiquetaDisposicion,
  etiquetaTipo,
  formatearExpensas,
  formatearPrecio,
} from '../lib/api/propiedades'
import { claveDia } from '../lib/calendario'
import { mensajeDeGuardado } from '../lib/mensajesDeError'
import { formatearFecha } from '../lib/formatoFecha'
import { useUiStore } from '../stores/ui'

/**
 * @react-pdf/renderer pesa más que todo el resto de la app junta, y la ficha
 * es una acción ocasional. Va en su propio chunk, que recién se baja cuando
 * se abre el detalle de una propiedad. El componente del PDF viaja en ese
 * mismo chunk, porque el botón es quien lo importa.
 */
const BotonExportarFicha = lazy(() =>
  import('../components/propiedades/BotonExportarFicha').then((m) => ({
    default: m.BotonExportarFicha,
  })),
)

type ModalAbierto = 'editar' | 'eliminar' | 'visita' | null

/** Días desde el alta, para el "N días en mercado" del original. */
function diasEnMercado(iso: string): number {
  const alta = new Date(iso)
  if (Number.isNaN(alta.getTime())) return 0
  return Math.max(0, Math.floor((Date.now() - alta.getTime()) / 86_400_000))
}

export default function DetallePropiedad() {
  const { id = '' } = useParams()
  const navigate = useNavigate()

  const { data: propiedad, isPending, isError, error } = useDetallePropiedad(id)
  const mostrarAviso = useUiStore((s) => s.mostrarAviso)
  const [modal, setModal] = useState<ModalAbierto>(null)
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)

  const cambioEstado = useActualizarEstadoPropiedad(id)
  const edicion = useActualizarPropiedad(id)
  const borrado = useEliminarPropiedad()

  const coincidencias = useCoincidenciasInternas(id, propiedad?.estado)

  if (isPending) return <Skeleton />

  if (isError) {
    return (
      <Aviso
        titulo="No pudimos cargar la propiedad"
        detalle={error instanceof Error ? error.message : 'Probá de nuevo en un momento.'}
      />
    )
  }

  // `null` cubre tanto "no existe" como "RLS la tapa": para el usuario es lo
  // mismo, y separarlos filtraría si el id pertenece a otra inmobiliaria.
  if (!propiedad) {
    return (
      <Aviso
        titulo="No encontramos esta propiedad"
        detalle="Puede que la hayan eliminado o que no tengas permiso para verla."
      />
    )
  }

  const dias = diasEnMercado(propiedad.created_at)

  return (
    <div className="mx-auto box-border max-w-[900px]">
      <Link
        to="/propiedades"
        className="mb-3 inline-flex w-fit items-center gap-1.5 text-[0.9rem] font-bold text-primary transition-colors hover:text-primary-dark motion-reduce:transition-none"
      >
        <IconoFlechaAtras className="size-4" />
        Volver a propiedades
      </Link>

      {errorGeneral && (
        <p
          role="alert"
          className="mb-5 rounded-lg border border-peligro-borde bg-peligro-soft px-4 py-3 text-[0.9rem] text-peligro-ink"
        >
          {errorGeneral}
        </p>
      )}

      {/* ------------------------- TARJETA UNIFICADA ------------------------- */}
      <article className="rounded-[16px] border border-border bg-surface p-6">
        <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="mb-1 text-xs leading-tight font-bold tracking-[0.05em] text-primary uppercase">
              Ficha de propiedad
            </p>

            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[0.72rem] font-bold text-ink-2 uppercase">
                {etiquetaTipo(propiedad.tipo)}
              </span>
              <BadgeEstadoPropiedad estado={propiedad.estado} />
            </div>

            <h1 className="m-0 text-[1.35rem] leading-tight font-bold text-ink">
              {propiedad.direccion}
            </h1>

            <div className="mt-2 flex flex-wrap items-center gap-4 text-[0.82rem] text-ink-3">
              {propiedad.zona && <span>{propiedad.zona}</span>}
              <span className="flex items-center gap-1.5">
                <IconoCalendario className="size-4 shrink-0" />
                Publicada {formatearFecha(propiedad.created_at)}
              </span>
              <span>{dias === 1 ? '1 día' : `${dias} días`} en mercado</span>
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-start gap-3 lg:items-end">
            <div className="flex flex-wrap items-start gap-2">
              <button
                type="button"
                onClick={() => setModal('visita')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-[0.82rem] font-semibold whitespace-nowrap text-white transition-colors hover:bg-primary-dark motion-reduce:transition-none"
              >
                <IconoCalendario className="size-4" />
                Agendar visita
              </button>

              <button
                type="button"
                onClick={() => setModal('editar')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3.5 py-2 text-[0.82rem] font-semibold whitespace-nowrap text-ink transition-colors hover:bg-background motion-reduce:transition-none"
              >
                <IconoLapiz className="size-4" />
                Editar
              </button>

              <Suspense fallback={<EsperandoFicha />}>
                {/* Se pasan sólo los campos de la propiedad: el tipo DatosFicha
                    no acepta lead_propietario ni agente_id, así que la ficha no
                    puede terminar con datos de contacto de nadie. */}
                <BotonExportarFicha
                  propiedad={{
                    direccion: propiedad.direccion,
                    zona: propiedad.zona,
                    tipo: propiedad.tipo,
                    precio: propiedad.precio,
                    moneda: propiedad.moneda,
                    ambientes: propiedad.ambientes,
                    metros_cuadrados: propiedad.metros_cuadrados,
                    descripcion: propiedad.descripcion,
                    fotos_urls: propiedad.fotos_urls ?? [],
                  }}
                />
              </Suspense>
            </div>

            <GrupoEstadoPropiedad
              actual={propiedad.estado}
              guardando={cambioEstado.isPending}
              onCambiar={(estado) =>
                cambioEstado.mutate(estado, {
                  onSuccess: () => mostrarAviso('Estado actualizado.'),
                  onError: (e) => setErrorGeneral(e.message),
                })
              }
            />
          </div>
        </header>

        <div className="mb-6">
          <GaleriaFotos propiedadId={propiedad.id} fotos={propiedad.fotos_urls ?? []} />
        </div>

        {/* ---------------------------- FICHA ---------------------------- */}
        <dl className="grid grid-cols-2 gap-4 border-t border-border pt-5 sm:grid-cols-4">
          <Dato label="Precio" destacado>
            {formatearPrecio(propiedad.precio, propiedad.moneda)}
          </Dato>
          <Dato label="Tipo">{etiquetaTipo(propiedad.tipo)}</Dato>
          <Dato label="Ambientes">{propiedad.ambientes ?? '—'}</Dato>
          {/* "Metros totales" es sólo el label: la columna sigue siendo
              `metros_cuadrados`. Antes decía "Superficie", que con los
              cubiertos al lado ya no distingue una cosa de la otra. */}
          <Dato label="Metros totales">
            {propiedad.metros_cuadrados ? `${propiedad.metros_cuadrados} m²` : '—'}
          </Dato>

          {/* Los campos de abajo aparecen sólo si tienen valor: una ficha con
              cinco guiones no informa nada. Mismo criterio que el link de la
              publicación y las observaciones, más abajo. */}
          {propiedad.metros_cubiertos != null && (
            <Dato label="Metros cubiertos">{propiedad.metros_cubiertos} m²</Dato>
          )}
          {propiedad.banos != null && <Dato label="Baños">{propiedad.banos}</Dato>}
          {propiedad.cocheras != null && (
            <Dato label="Cocheras">{propiedad.cocheras}</Dato>
          )}
          {propiedad.disposicion != null && (
            <Dato label="Disposición">
              {etiquetaDisposicion(propiedad.disposicion)}
            </Dato>
          )}
          {propiedad.expensas != null && (
            <Dato label="Expensas">
              {formatearExpensas(propiedad.expensas)}
              <span className="text-[0.75rem] font-normal text-ink-3"> /mes</span>
            </Dato>
          )}
        </dl>

        {propiedad.link_portal && (
          <div className="mt-5 border-t border-border pt-4">
            <span className="text-xs font-semibold text-ink-3 uppercase">Publicación</span>
            <p className="mt-1">
              <a
                href={propiedad.link_portal}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline"
              >
                <IconoLink className="size-4" />
                Ver publicación ↗
              </a>
            </p>
          </div>
        )}

        {propiedad.descripcion && (
          <div className="mt-5 border-t border-border pt-4">
            <span className="text-xs font-semibold text-ink-3 uppercase">Observaciones</span>
            <p className="mt-1 text-[0.9rem] leading-relaxed text-ink-2">
              {propiedad.descripcion}
            </p>
          </div>
        )}
      </article>

      {/* Va primero de las secciones: cuánto se movió la propiedad es lo que
          más rápido se quiere saber al abrir su ficha. */}
      <Seccion titulo="Actividad">
        <SeccionActividadVisitas propiedadId={propiedad.id} />
      </Seccion>

      <Seccion titulo="Lead propietario">
        <SeccionLeadPropietario lead={propiedad.lead_propietario} />
      </Seccion>

      <Seccion titulo="Operaciones vinculadas">
        <SeccionOperacionesVinculadas propiedadId={propiedad.id} />
      </Seccion>

      {/* Sólo tiene sentido buscar interesados para algo que está disponible.
          "Interesados" y no "Compradores": desde que las propiedades tienen
          finalidad, quien matchea puede ser un inquilino y no un comprador. */}
      {propiedad.estado === 'DISPONIBLE' && (
        <Seccion
          titulo="Interesados"
          contador={coincidencias.data?.length}
          nota="De tu inmobiliaria"
        >
          <SeccionCoincidenciasInternas
            coincidencias={coincidencias.data ?? []}
            cargando={coincidencias.isPending}
            error={
              coincidencias.error instanceof Error ? coincidencias.error.message : null
            }
          />
        </Seccion>
      )}

      <div className="mt-10 flex justify-end border-t border-border pt-6">
        <button
          type="button"
          onClick={() => setModal('eliminar')}
          className="inline-flex items-center gap-1.5 rounded-lg border border-peligro-borde bg-transparent px-3.5 py-[7px] text-[0.8rem] font-medium text-peligro-ink opacity-65 transition hover:bg-peligro-soft hover:opacity-100 motion-reduce:transition-none"
        >
          <IconoTacho className="size-4" />
          Eliminar propiedad
        </button>
      </div>

      <ModalEditarPropiedad
        abierto={modal === 'editar'}
        propiedad={propiedad}
        guardando={edicion.isPending}
        error={
          edicion.isError ? mensajeDeGuardado(edicion.error, 'No se pudo guardar.') : null
        }
        onCerrar={() => {
          edicion.reset()
          setModal(null)
        }}
        onGuardar={(campos) =>
          edicion.mutate(campos, {
            onSuccess: () => {
              setModal(null)
              mostrarAviso('Propiedad actualizada.')
            },
            onError: (e) => setErrorGeneral(e.message),
          })
        }
      />

      <ModalConfirmarEliminar
        abierto={modal === 'eliminar'}
        titulo="¿Eliminar esta propiedad?"
        descripcion="Esta acción es permanente. Se pierden también sus fotos y el vínculo con el lead propietario."
        nombre={propiedad.direccion}
        eliminando={borrado.isPending}
        error={borrado.error instanceof Error ? borrado.error.message : null}
        onCancelar={() => {
          borrado.reset()
          setModal(null)
        }}
        onConfirmar={() =>
          borrado.mutate(propiedad.id, {
            onSuccess: () => {
              // El aviso vive en el store: la ficha se desmonta con la
              // navegación y no podría mostrarlo ella misma.
              mostrarAviso('Propiedad eliminada.')
              navigate('/propiedades', { replace: true })
            },
          })
        }
      />

      {modal === 'visita' && (
        // La propiedad va fija: acá el contexto ya la define y elegir otra
        // desde su propia ficha sería un error esperando pasar.
        <ModalNuevaVisita
          propiedadFija={{ id: propiedad.id, direccion: propiedad.direccion }}
          fechaInicial={claveDia(new Date())}
          onCerrar={() => setModal(null)}
        />
      )}
    </div>
  )
}

function Seccion({
  titulo,
  contador,
  nota,
  children,
}: {
  titulo: string
  contador?: number
  nota?: string
  children: ReactNode
}) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 flex flex-wrap items-center gap-2 text-[0.95rem] font-bold text-ink">
        {titulo}
        {contador != null && contador > 0 && (
          <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-bold text-primary">
            {contador}
          </span>
        )}
        {nota && <span className="text-xs font-normal text-ink-3">· {nota}</span>}
      </h2>
      {children}
    </section>
  )
}

function Dato({
  label,
  children,
  destacado = false,
}: {
  label: string
  children: ReactNode
  destacado?: boolean
}) {
  return (
    <div>
      <dt className="text-xs font-semibold text-ink-3 uppercase">{label}</dt>
      <dd
        className={`mt-0.5 font-bold text-ink ${destacado ? 'text-[1.15rem]' : 'text-[0.95rem]'}`}
      >
        {children}
      </dd>
    </div>
  )
}

function Aviso({ titulo, detalle }: { titulo: string; detalle: string }) {
  return (
    <div className="mx-auto max-w-[900px]">
      <div className="rounded-[16px] border border-dashed border-border bg-surface px-6 py-14 text-center">
        <p className="text-sm font-medium text-ink">{titulo}</p>
        <p className="mt-1 text-sm text-ink-3">{detalle}</p>
        <Link
          to="/propiedades"
          className="mt-5 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark"
        >
          Volver a propiedades
        </Link>
      </div>
    </div>
  )
}

function Skeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Cargando la propiedad"
      className="mx-auto max-w-[900px]"
    >
      <div className="mb-7 h-64 animate-pulse rounded-[16px] bg-surface-2 motion-reduce:animate-none" />
      <div className="mb-4 h-24 animate-pulse rounded-[16px] bg-surface-2 motion-reduce:animate-none" />
      <div className="h-32 animate-pulse rounded-[16px] bg-surface-2 motion-reduce:animate-none" />
    </div>
  )
}

/** Placeholder del mismo tamaño que el botón, para que no salte el header. */
function EsperandoFicha() {
  return (
    <span
      aria-hidden
      className="inline-flex h-[38px] w-[140px] animate-pulse rounded-lg bg-surface-2 motion-reduce:animate-none"
    />
  )
}
