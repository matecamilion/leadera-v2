import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  IconoCalendario,
  IconoCasa,
  IconoFlechaAtras,
  IconoLapiz,
  IconoLupa,
  IconoTacho,
} from '../components/leads/Iconos'
import { ModalConfirmarEliminar } from '../components/comunes/ModalConfirmarEliminar'
import { ModalEditarOperacion } from '../components/operaciones/ModalEditarOperacion'
import { SeccionCoincidencias } from '../components/operaciones/SeccionCoincidencias'
import { BadgeEstadoOperacion } from '../components/operaciones/BadgeEstadoOperacion'
import { BadgeTipoOperacion } from '../components/operaciones/BadgeTipoOperacion'
import { ChipBusquedaVinculada } from '../components/operaciones/ChipBusquedaVinculada'
import { ChipLeadOperacion } from '../components/operaciones/ChipLeadOperacion'
import { ChipPropiedadVinculada } from '../components/operaciones/ChipPropiedadVinculada'
import { GrupoEstadoOperacion } from '../components/operaciones/GrupoEstadoOperacion'
import { StepperOperacion } from '../components/operaciones/StepperOperacion'
import { TimelineEventos } from '../components/operaciones/TimelineEventos'
import {
  useActualizarEstadoOperacion,
  useActualizarOperacion,
  useActualizarSeguimientoOperacion,
  useEliminarOperacion,
  useEventosOperacion,
  useOperacion,
} from '../hooks/useOperacion'
import { useCoincidenciasBusqueda, useGuardarBusqueda } from '../hooks/useBusqueda'
import {
  esBloqueada,
  etiquetaEstadoOperacion,
  etiquetaTipoOperacion,
  formatearMonto,
} from '../lib/api/operaciones'
import { formatearFecha } from '../lib/formatoFecha'
import { esMomentoPasado, hoyComoMinimoLocal } from '../lib/calendario'
import { mensajeDeGuardado } from '../lib/mensajesDeError'
import { useUiStore } from '../stores/ui'

type ModalAbierto = 'editar' | 'eliminar' | null

export default function DetalleOperacion() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const mostrarAviso = useUiStore((s) => s.mostrarAviso)
  const { data: operacion, isPending, isError, error } = useOperacion(id)
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const [modal, setModal] = useState<ModalAbierto>(null)

  const leadId = operacion?.lead_id ?? null
  const propiedadId = operacion?.propiedad_id ?? null

  const cambioEstado = useActualizarEstadoOperacion(id, leadId, propiedadId)
  const seguimiento = useActualizarSeguimientoOperacion(id, leadId, propiedadId)
  const edicion = useActualizarOperacion(id, leadId, propiedadId)
  const borrado = useEliminarOperacion(leadId, propiedadId)
  const guardarCriterios = useGuardarBusqueda()
  const eventos = useEventosOperacion(id)

  // Sólo las COMPRA con búsqueda cargada puntúan propiedades. El hook queda
  // apagado en el resto: `enabled` mira el id, que acá es null.
  const coincidencias = useCoincidenciasBusqueda(
    operacion?.tipo === 'COMPRA' ? operacion.busqueda_id : null,
  )

  if (isPending) return <Skeleton />

  if (isError) {
    return (
      <Aviso
        titulo="No pudimos cargar la operación"
        detalle={error instanceof Error ? error.message : 'Probá de nuevo en un momento.'}
      />
    )
  }

  // `null` cubre tanto "no existe" como "RLS la tapa": para el usuario es lo
  // mismo, y separarlos filtraría si el id pertenece a otra inmobiliaria.
  if (!operacion) {
    return (
      <Aviso
        titulo="No encontramos esta operación"
        detalle="Puede que la hayan eliminado o que no tengas permiso para verla."
      />
    )
  }

  const esCompra = operacion.tipo === 'COMPRA'

  // La base congela las cerradas y las canceladas (trigger
  // `operaciones_proteger_cerrada` + policy `operaciones_delete`). Acá apagamos
  // la UI para no ofrecer algo que va a rebotar; el control real es el de allá.
  const bloqueada = esBloqueada(operacion.estado)
  const etiquetaDelEstado = etiquetaEstadoOperacion(operacion.estado)

  return (
    <div className="mx-auto box-border max-w-[900px]">
      <Link
        to="/operaciones"
        className="mb-3 inline-flex w-fit items-center gap-1.5 text-[0.9rem] font-bold text-primary transition-colors hover:text-primary-dark motion-reduce:transition-none"
      >
        <IconoFlechaAtras className="size-4" />
        Volver a operaciones
      </Link>

      {errorGeneral && (
        <p
          role="alert"
          className="mb-5 rounded-lg border border-peligro-borde bg-peligro-soft px-4 py-3 text-[0.9rem] text-peligro-ink"
        >
          {errorGeneral}
        </p>
      )}

      {/* ------------------------------ HERO ------------------------------ */}
      <div className="mb-4 flex flex-col gap-4 rounded-[14px] border border-border bg-surface p-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="mb-1 text-xs leading-tight font-bold tracking-[0.05em] text-primary uppercase">
            Ficha de operación
          </p>

          <h1 className="m-0 text-[1.35rem] leading-tight font-bold text-ink">
            {operacion.titulo || 'Sin título'}
          </h1>

          <div className="mt-2 mb-2 flex flex-wrap gap-1.5">
            <BadgeTipoOperacion tipo={operacion.tipo} />
            <BadgeEstadoOperacion estado={operacion.estado} />
          </div>

          <div className="flex flex-wrap items-center gap-4 text-[0.82rem] text-ink-3">
            {/* El vínculo del hero sigue al tipo: propiedad para VENTA y
                ALQUILER, búsqueda para COMPRA. */}
            {!esCompra && operacion.propiedad && (
              <span className="flex items-center gap-1.5">
                <IconoCasa className="size-4 shrink-0" />
                {operacion.propiedad.direccion}
                {operacion.propiedad.zona ? ` · ${operacion.propiedad.zona}` : ''}
              </span>
            )}
            {esCompra && operacion.busqueda && (
              <span className="flex items-center gap-1.5">
                <IconoLupa className="size-4 shrink-0" />
                Búsqueda
                {operacion.busqueda.zona ? ` en ${operacion.busqueda.zona}` : ''}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <IconoCalendario className="size-4 shrink-0" />
              {formatearFecha(operacion.created_at)}
            </span>
            {operacion.monto != null && (
              <span className="font-bold text-ink">
                {formatearMonto(operacion.monto, operacion.moneda)}
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-3 lg:items-end">
          <GrupoEstadoOperacion
            actual={operacion.estado}
            guardando={cambioEstado.isPending}
            error={
              cambioEstado.error instanceof Error ? cambioEstado.error.message : null
            }
            onCambiar={(estado) =>
              cambioEstado.mutate(estado, {
                // Mensaje neutro y no uno por estado ("Operación cerrada.",
                // "Operación cancelada.", …): el estado nuevo ya queda pintado
                // en el propio grupo de chips, así que el aviso sólo tiene que
                // confirmar que la escritura llegó.
                onSuccess: () => mostrarAviso('Estado actualizado.'),
                onError: (e) => setErrorGeneral(e.message),
              })
            }
          />

          {/* Una operación cerrada o cancelada no se edita: en vez de dejar el
              botón puesto para que la base lo rechace, se explica por qué no
              está. Sigue pudiendo cambiarse el estado con los botones de arriba,
              que es justamente el camino para reabrirla. */}
          {bloqueada ? (
            <p className="max-w-[280px] text-[0.78rem] leading-snug text-ink-3 lg:text-right">
              Operación {etiquetaDelEstado.toLowerCase()} — no editable. Para
              corregirla, reabrila cambiándole el estado.
            </p>
          ) : (
            <button
              type="button"
              onClick={() => {
                edicion.reset()
                setModal('editar')
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3.5 py-2 text-[0.82rem] font-semibold text-ink transition-colors hover:bg-background motion-reduce:transition-none"
            >
              <IconoLapiz className="size-4" />
              Editar
            </button>
          )}
        </div>
      </div>

      <StepperOperacion estado={operacion.estado} />

      {/* ------------------------------ FICHA ------------------------------ */}
      <div className="mb-4 rounded-[14px] border border-border bg-surface px-6 py-5">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Dato label="Monto" destacado>
            {formatearMonto(operacion.monto, operacion.moneda)}
          </Dato>
          <Dato label="Tipo">{etiquetaTipoOperacion(operacion.tipo)}</Dato>
          <Dato label="Estado">
            <BadgeEstadoOperacion estado={operacion.estado} />
          </Dato>
          <Dato label="Fecha creación">{formatearFecha(operacion.created_at)}</Dato>
          <SeguimientoEditable
            valor={operacion.fecha_proximo_seguimiento}
            guardando={seguimiento.isPending}
            onGuardar={(fecha) =>
              seguimiento.mutate(fecha, { onError: (e) => setErrorGeneral(e.message) })
            }
          />
          <Dato label="Fecha cierre" atenuadoSiVacio={!operacion.fecha_cierre}>
            {operacion.fecha_cierre ? formatearFecha(operacion.fecha_cierre) : 'Sin fecha'}
          </Dato>
        </dl>

        {operacion.notas && (
          <p className="mt-5 border-t border-border pt-4 text-[0.9rem] leading-relaxed text-ink-2">
            {operacion.notas}
          </p>
        )}
      </div>

      {!esCompra && operacion.propiedad && (
        <Seccion titulo="Propiedad vinculada">
          <ChipPropiedadVinculada propiedad={operacion.propiedad} />
        </Seccion>
      )}

      {esCompra && operacion.busqueda && (
        <Seccion titulo="Búsqueda asociada">
          <ChipBusquedaVinculada busqueda={operacion.busqueda} />
        </Seccion>
      )}

      <Seccion titulo="Lead">
        <ChipLeadOperacion lead={operacion.lead} />
      </Seccion>

      {/* Sólo COMPRA y sólo con búsqueda: sin criterios cargados no hay nada
          que puntuar, y la sección vacía sería ruido en VENTA y ALQUILER. */}
      {esCompra && operacion.busqueda_id && (
        <Seccion
          titulo="Propiedades que coinciden"
          contador={coincidencias.data?.length}
        >
          <SeccionCoincidencias
            coincidencias={coincidencias.data ?? []}
            cargando={coincidencias.isPending}
            error={
              coincidencias.error instanceof Error ? coincidencias.error.message : null
            }
          />
        </Seccion>
      )}

      <Seccion titulo="Historial de eventos" contador={eventos.data?.length}>
        <TimelineEventos
          eventos={eventos.data ?? []}
          cargando={eventos.isPending}
          errorCarga={eventos.error instanceof Error ? eventos.error.message : null}
        />
      </Seccion>

      {/* ---------------------------- ELIMINAR ---------------------------- */}
      <div className="mt-10 flex flex-wrap items-center justify-end gap-3 border-t border-border pt-6">
        {bloqueada ? (
          // Cancelar en vez de borrar: una operación cerrada es parte del
          // historial del que salen las métricas del mes. Borrarla las cambia
          // hacia atrás.
          <p className="text-[0.8rem] text-ink-3">
            Las operaciones cerradas o canceladas no se eliminan, para no perder
            el historial.
          </p>
        ) : (
          <button
            type="button"
            onClick={() => {
              borrado.reset()
              setModal('eliminar')
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-caliente bg-transparent px-3.5 py-[7px] text-[0.8rem] font-medium text-caliente opacity-65 transition hover:bg-hot-soft hover:opacity-100 motion-reduce:transition-none"
          >
            <IconoTacho className="size-4" />
            Eliminar operación
          </button>
        )}
      </div>

      {/* ---------------------------- MODALES ---------------------------- */}
      <ModalEditarOperacion
        abierto={modal === 'editar'}
        operacion={operacion}
        guardando={edicion.isPending || guardarCriterios.isPending}
        // Los dos errores se muestran dentro del modal y no en el banner de la
        // página: con el <dialog> abierto, el banner queda detrás del backdrop.
        error={
          edicion.error
            ? mensajeDeGuardado(edicion.error, 'No se pudo guardar la operación.')
            : guardarCriterios.error
              ? mensajeDeGuardado(
                  guardarCriterios.error,
                  'La operación se guardó, pero no se pudieron guardar los criterios de búsqueda.',
                )
              : null
        }
        onCerrar={() => {
          edicion.reset()
          guardarCriterios.reset()
          setModal(null)
        }}
        onGuardar={(campos, criterios) => {
          guardarCriterios.reset()
          edicion.mutate(campos, {
            onSuccess: async (actualizada) => {
              // Los criterios se guardan después de la operación: si el tipo
              // acaba de pasar a COMPRA, la búsqueda se cuelga de la fila ya
              // actualizada. Un fallo acá no invalida la edición, que ya quedó
              // guardada; el modal se deja abierto para reintentar sólo esto.
              if (criterios && actualizada.lead_id) {
                try {
                  await guardarCriterios.mutateAsync({
                    operacionId: actualizada.id,
                    leadId: actualizada.lead_id,
                    criterios,
                  })
                } catch {
                  // El mensaje sale por `guardarCriterios.error`, arriba.
                  return
                }
              }
              setModal(null)
              mostrarAviso('Operación actualizada.')
            },
          })
        }}
      />

      <ModalConfirmarEliminar
        abierto={modal === 'eliminar'}
        titulo="Eliminar operación"
        descripcion={`Se va a eliminar "${operacion.titulo || 'esta operación'}". Esta acción no se puede deshacer.`}
        nombre={operacion.titulo ?? undefined}
        eliminando={borrado.isPending}
        error={borrado.error instanceof Error ? borrado.error.message : null}
        onCancelar={() => {
          borrado.reset()
          setModal(null)
        }}
        onConfirmar={() =>
          borrado.mutate(operacion.id, {
            onSuccess: () => {
              // El aviso vive en el store: la ficha se desmonta con la
              // navegación y no podría mostrarlo ella misma.
              mostrarAviso('Operación eliminada.')
              navigate('/operaciones', { replace: true })
            },
          })
        }
      />
    </div>
  )
}

function Seccion({
  titulo,
  contador,
  children,
}: {
  titulo: string
  contador?: number
  children: ReactNode
}) {
  return (
    <section className="mt-6">
      <h2 className="mb-3 flex flex-wrap items-center gap-2 text-[0.95rem] font-bold text-ink">
        {titulo}
        {contador != null && contador > 0 && (
          <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-bold text-primary">
            {contador}
          </span>
        )}
      </h2>
      {children}
    </section>
  )
}

function Dato({
  label,
  children,
  destacado = false,
  atenuadoSiVacio = false,
}: {
  label: string
  children: ReactNode
  destacado?: boolean
  atenuadoSiVacio?: boolean
}) {
  return (
    <div>
      <dt className="text-xs font-semibold text-ink-3 uppercase">{label}</dt>
      <dd
        className={`mt-0.5 font-bold ${destacado ? 'text-[1.15rem]' : 'text-[0.95rem]'} ${
          atenuadoSiVacio ? 'text-ink-4' : 'text-ink'
        }`}
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
          to="/operaciones"
          className="mt-5 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark"
        >
          Volver a operaciones
        </Link>
      </div>
    </div>
  )
}

function Skeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Cargando la operación"
      className="mx-auto max-w-[900px]"
    >
      <div className="mb-4 h-40 animate-pulse rounded-[14px] bg-surface-2 motion-reduce:animate-none" />
      <div className="mb-4 h-24 animate-pulse rounded-[14px] bg-surface-2 motion-reduce:animate-none" />
      <div className="h-40 animate-pulse rounded-[14px] bg-surface-2 motion-reduce:animate-none" />
    </div>
  )
}

/**
 * Próximo seguimiento de la operación: se muestra como un dato más y se edita
 * en el lugar.
 *
 * La columna existía desde antes pero ningún formulario la escribía. Se agenda
 * hacia adelante, igual que el de leads, y el corte es por día: programarlo
 * para hoy más tarde es válido.
 */
function SeguimientoEditable({
  valor,
  guardando,
  onGuardar,
}: {
  valor: string | null
  guardando: boolean
  onGuardar: (fecha: string | null) => void
}) {
  const [editando, setEditando] = useState(false)
  const [borrador, setBorrador] = useState('')

  // Contra el reloj y no contra el día, igual que el resto de los campos de
  // próximo seguimiento de la app: agendar para una hora de hoy que ya pasó no
  // significa nada.
  const pasado = !!borrador && esMomentoPasado(borrador)

  function abrir() {
    // El valor guardado es un ISO con zona; el input lo quiere local y sin ella.
    setBorrador(valor ? paraInputLocal(valor) : '')
    setEditando(true)
  }

  function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (pasado) return
    onGuardar(borrador ? new Date(borrador).toISOString() : null)
    setEditando(false)
  }

  return (
    <div>
      <dt className="text-xs font-semibold text-ink-3 uppercase">Próx. seguimiento</dt>

      {editando ? (
        <form onSubmit={guardar} className="mt-1 flex flex-wrap items-center gap-2">
          <input
            type="datetime-local"
            aria-label="Fecha del próximo seguimiento"
            value={borrador}
            min={hoyComoMinimoLocal()}
            onChange={(e) => setBorrador(e.target.value)}
            aria-invalid={pasado || undefined}
            className={`rounded-lg border bg-surface px-2.5 py-1.5 text-[0.85rem] text-ink focus:outline-none ${
              pasado ? 'border-peligro-ink' : 'border-border focus:border-primary'
            }`}
          />
          <button
            type="submit"
            disabled={pasado || guardando}
            className="rounded-lg bg-primary px-3 py-1.5 text-[0.8rem] font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-55 motion-reduce:transition-none"
          >
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
          <button
            type="button"
            onClick={() => setEditando(false)}
            className="rounded-lg border border-border px-3 py-1.5 text-[0.8rem] font-semibold text-ink-2 transition-colors hover:bg-background motion-reduce:transition-none"
          >
            Cancelar
          </button>
          {pasado && (
            <span role="alert" className="basis-full text-[0.78rem] text-peligro-ink">
              El seguimiento no puede ser una fecha pasada.
            </span>
          )}
        </form>
      ) : (
        <dd
          className={`mt-0.5 flex flex-wrap items-center gap-2 text-[0.95rem] font-bold ${
            valor ? 'text-ink' : 'text-ink-4'
          }`}
        >
          {valor ? formatearFecha(valor) : 'Sin fecha'}
          <button
            type="button"
            onClick={abrir}
            className="text-[0.78rem] font-semibold text-primary hover:underline"
          >
            {valor ? 'Cambiar' : 'Agendar'}
          </button>
        </dd>
      )}
    </div>
  )
}

/** ISO con zona → `YYYY-MM-DDTHH:mm` local, que es lo que lee el input. */
function paraInputLocal(iso: string): string {
  const f = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${f.getFullYear()}-${p(f.getMonth() + 1)}-${p(f.getDate())}T${p(f.getHours())}:${p(f.getMinutes())}`
}
