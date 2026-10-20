import { lazy, Suspense, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { IconoFlechaAtras, IconoLink } from '../components/leads/Iconos'
import { ModalConfirmarEliminar } from '../components/comunes/ModalConfirmarEliminar'
import { ModalNuevaVisita } from '../components/tareas/ModalNuevaVisita'
import { CabeceraPropiedad } from '../components/propiedades/CabeceraPropiedad'
import { GaleriaPortal } from '../components/propiedades/GaleriaPortal'
import { PanelLinkPropiedad } from '../components/propiedades/LinkConsultaPropiedad'
import { ModalEditarPropiedad } from '../components/propiedades/ModalEditarPropiedad'
import { PanelGestionarFotos } from '../components/propiedades/PanelGestionarFotos'
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
import { etiquetaDisposicion, etiquetaTipo, formatearExpensas } from '../lib/api/propiedades'
import { claveDia } from '../lib/calendario'
import { mensajeDeGuardado } from '../lib/mensajesDeError'
import { useUiStore } from '../stores/ui'

/**
 * @react-pdf/renderer pesa más que todo el resto de la app junta, y la ficha
 * es una acción ocasional. Va en su propio chunk, que recién se baja cuando
 * alguien elige "Exportar ficha". El componente del PDF viaja en ese mismo
 * chunk, porque quien lo importa es el exportador.
 */
const BotonExportarFicha = lazy(() =>
  import('../components/propiedades/BotonExportarFicha').then((m) => ({
    default: m.BotonExportarFicha,
  })),
)

/** Con sus fuentes y html-to-image: se baja recién cuando se abre "Crear flyer". */
const PanelCrearImagen = lazy(() => import('../components/propiedades/PanelCrearImagen'))

type ModalAbierto ='editar' | 'eliminar' | 'visita' | null

export default function DetallePropiedad() {
  const { id = '' } = useParams()
  const navigate = useNavigate()

  const { data: propiedad, isPending, isError, error } = useDetallePropiedad(id)
  const mostrarAviso = useUiStore((s) => s.mostrarAviso)
  const [modal, setModal] = useState<ModalAbierto>(null)
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  // El link de consultas se crea recién la primera vez que se abre el panel.
  const [linkAbierto, setLinkAbierto] = useState(false)
  const [imagenAbierta, setImagenAbierta] = useState(false)
  const [fotosAbiertas, setFotosAbiertas] = useState(false)
  // La ficha en PDF se arma una por vez: mientras haya una en curso, se ignora otro pedido.
  const [exportando, setExportando] = useState(false)

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

  return (
    <div className="mx-auto box-border max-w-[900px]">
      <Link
        to="/propiedades"
        className="mb-3 inline-flex w-fit items-center gap-1.5 text-[0.9rem] font-bold text-primary md:mb-2 transition-colors hover:text-primary-dark motion-reduce:transition-none"
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
      <article className="rounded-[16px] border border-border bg-surface p-4 sm:p-6 md:p-5">
        <CabeceraPropiedad
          propiedad={propiedad}
          guardandoEstado={cambioEstado.isPending}
          onCambiarEstado={(estado) =>
            cambioEstado.mutate(estado, {
              onSuccess: () => mostrarAviso('Estado actualizado.'),
              onError: (e) => setErrorGeneral(e.message),
            })
          }
          onAgendarVisita={() => setModal('visita')}
          onEditar={() => setModal('editar')}
          onCrearImagen={() => setImagenAbierta(true)}
          onExportarFicha={() => {
            if (exportando) return
            mostrarAviso('Generando la ficha…')
            setExportando(true)
          }}
          onLinkConsultas={() => setLinkAbierto(true)}
          onEliminar={() => setModal('eliminar')}
        />

        {exportando && (
          <Suspense fallback={null}>
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
              onTerminado={() => setExportando(false)}
              onError={() => {
                setExportando(false)
                mostrarAviso('No se pudo generar la ficha. Probá de nuevo.', 'error')
              }}
            />
          </Suspense>
        )}

        {linkAbierto && (
          <PanelLinkPropiedad propiedad={propiedad} onCerrar={() => setLinkAbierto(false)} />
        )}

        {imagenAbierta && (
          <Suspense
            fallback={
              <div
                aria-busy="true"
                aria-label="Cargando el panel del flyer"
                className="mb-6 h-48 animate-pulse rounded-2xl bg-surface-2 motion-reduce:animate-none"
              />
            }
          >
            <PanelCrearImagen propiedad={propiedad} onCerrar={() => setImagenAbierta(false)} />
          </Suspense>
        )}

        <div className="mb-6">
          <GaleriaPortal
            fotos={propiedad.fotos_urls ?? []}
            onGestionar={() => setFotosAbiertas(true)}
          />
        </div>

        {fotosAbiertas && (
          <div className="mb-6">
            <PanelGestionarFotos
              propiedadId={propiedad.id}
              fotos={propiedad.fotos_urls ?? []}
              onCerrar={() => setFotosAbiertas(false)}
              onCrearFlyer={() => setImagenAbierta(true)}
            />
          </div>
        )}

        {/* ---------------------------- FICHA ---------------------------- */}
        <dl className="grid grid-cols-2 gap-4 border-t border-border pt-5 sm:grid-cols-4">
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
          className="mt-5 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-contrast hover:bg-primary-dark"
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
