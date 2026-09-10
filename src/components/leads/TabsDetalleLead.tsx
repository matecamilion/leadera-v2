import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  useActualizarInteraccion,
  useEliminarInteraccion,
  useInteraccionesPorLead,
} from '../../hooks/useInteracciones'
import { useAuth } from '../../contexts/AuthContext'
import { useOperacionesPorLead } from '../../hooks/useOperacion'
import {
  useCompletarTarea,
  useDescompletarTarea,
  useEliminarTarea,
  useTareasPorLead,
} from '../../hooks/useTareas'
import { usePropiedadesPorLead } from '../../hooks/usePropiedades'
import { ModalConfirmarEliminar } from '../comunes/ModalConfirmarEliminar'
import { ItemTarea } from '../tareas/ItemTarea'
import { ListaOperacionesCompacta } from '../operaciones/ListaOperacionesCompacta'
import { PropiedadesCards } from '../propiedades/PropiedadesCards'
import { IconoCalendario, IconoCasa } from './Iconos'
import { ModalEditarInteraccion } from './ModalEditarInteraccion'
import { ResumenLead } from './ResumenLead'
import { TimelineInteracciones } from './TimelineInteracciones'
import { mensajeDeGuardado } from '../../lib/mensajesDeError'
import { useUiStore } from '../../stores/ui'
import type { Interaccion } from '../../lib/api/interacciones'
import type { Lead } from '../../lib/api/leads'
import type { PropiedadConPropietario } from '../../lib/api/propiedades'
import type { Tarea } from '../../types/database'

type Tab = 'resumen' | 'interacciones' | 'operaciones' | 'propiedades' | 'tareas'

interface TabsDetalleLeadProps {
  /** La fila que `DetalleLead` ya tiene cargada; la usa el Resumen. */
  lead: Lead
  leadId: string
  /** Abre el alta de interacción. El modal lo monta `DetalleLead`. */
  onNuevaInteraccion: () => void
  /** Abre la edición de contacto, para el botón que vive en el Resumen. */
  onEditarContacto: () => void
  /** Abre el alta de tarea con este lead ya fijo. El modal lo monta `DetalleLead`. */
  onNuevaTarea: () => void
}

/**
 * Shell de tabs de la ficha.
 *
 * Arranca en Resumen, que es la lectura de un vistazo: en qué anda el
 * seguimiento y qué busca el lead. Las otras tres muestran el conteo real de lo
 * que hay del otro lado.
 */
export function TabsDetalleLead({
  lead,
  leadId,
  onNuevaInteraccion,
  onEditarContacto,
  onNuevaTarea,
}: TabsDetalleLeadProps) {
  const [activa, setActiva] = useState<Tab>('resumen')
  const { data: interacciones, isPending, error } = useInteraccionesPorLead(leadId)
  const operaciones = useOperacionesPorLead(leadId)
  const propiedades = usePropiedadesPorLead(leadId)
  // Misma clave que el panel del Resumen: si el agente ya pasó por ahí, esto
  // no dispara un request nuevo.
  const tareas = useTareasPorLead(leadId)
  const { profile } = useAuth()

  const mostrarAviso = useUiStore((s) => s.mostrarAviso)
  // Qué interacción está en el modal, y cuál de los dos. La fila se guarda
  // entera —y no sólo el id— porque el modal necesita sus valores actuales
  // para precargarse.
  const [enEdicion, setEnEdicion] = useState<Interaccion | null>(null)
  const [enBorrado, setEnBorrado] = useState<Interaccion | null>(null)
  const edicion = useActualizarInteraccion(leadId)
  const borrado = useEliminarInteraccion(leadId)

  // `n` es opcional: Resumen no es una lista de nada, así que un "(0)" al lado
  // mentiría sobre lo que hay adentro.
  const tabs: { id: Tab; label: string; n?: number }[] = [
    { id: 'resumen', label: 'Resumen' },
    { id: 'interacciones', label: 'Interacciones', n: interacciones?.length ?? 0 },
    { id: 'operaciones', label: 'Operaciones', n: operaciones.data?.length ?? 0 },
    { id: 'propiedades', label: 'Propiedades', n: propiedades.data?.length ?? 0 },
    { id: 'tareas', label: 'Tareas', n: tareas.data?.length ?? 0 },
  ]

  return (
    <section>
      {/* Scrollea de costado en pantallas angostas en vez de estirar la
          página: las cuatro tabs suman más de 390px y, al ser items de un
          flex, no encogen. Mismo recurso —y misma forma de esconder la
          barra— que los chips de filtro del listado de leads. */}
      <div
        role="tablist"
        aria-label="Secciones del lead"
        className="mb-5 flex overflow-x-auto border-b-2 border-border [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((tab) => {
          const activo = activa === tab.id
          return (
            <button
              key={tab.id}
              role="tab"
              type="button"
              aria-selected={activo}
              onClick={() => setActiva(tab.id)}
              className={[
                '-mb-0.5 shrink-0 border-b-2 px-4.5 py-2.5 text-[0.83rem] font-semibold',
                'transition-colors motion-reduce:transition-none',
                'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary',
                activo
                  ? 'border-primary text-primary'
                  : 'border-transparent text-ink-3 hover:text-ink',
              ].join(' ')}
            >
              {tab.label}
              {tab.n !== undefined && ` (${tab.n})`}
            </button>
          )
        })}
      </div>

      <div className="min-h-[200px]">
        {activa === 'resumen' && (
          <ResumenLead
            lead={lead}
            leadId={leadId}
            onEditarContacto={onEditarContacto}
            // Los "Ver todas" del resumen son saltos de tab, no navegación:
            // el estado ya vive acá, así que alcanza con pasarle el setter.
            onIrATab={setActiva}
          />
        )}

        {activa === 'interacciones' && (
          <>
            <div className="mb-4 flex justify-end">
              <button
                type="button"
                onClick={onNuevaInteraccion}
                className="inline-flex items-center gap-1.5 rounded-md border-2 border-primary bg-brand-softer px-4.5 py-2.5 text-[0.85rem] font-extrabold tracking-[0.04em] text-primary uppercase transition-colors hover:bg-primary-dark hover:text-white motion-reduce:transition-none"
              >
                + Nueva interacción
              </button>
            </div>

            <TimelineInteracciones
              interacciones={interacciones ?? []}
              cargando={isPending}
              error={error instanceof Error ? error.message : null}
              onEditar={(interaccion) => {
                edicion.reset()
                setEnEdicion(interaccion)
              }}
              onEliminar={(interaccion) => {
                borrado.reset()
                setEnBorrado(interaccion)
              }}
            />
          </>
        )}

        {activa === 'operaciones' && (
          <ListaOperacionesCompacta
            operaciones={operaciones.data ?? []}
            cargando={operaciones.isPending}
            error={operaciones.error instanceof Error ? operaciones.error.message : null}
            textoVacio="Este lead todavía no tiene operaciones."
          />
        )}

        {activa === 'tareas' && (
          <PanelTareas
            leadId={leadId}
            miId={profile?.id ?? ''}
            onNuevaTarea={onNuevaTarea}
          />
        )}

        {activa === 'propiedades' && (
          <PanelPropiedades
            leadId={leadId}
            propiedades={propiedades.data ?? []}
            cargando={propiedades.isPending}
            error={
              propiedades.error instanceof Error ? propiedades.error.message : null
            }
          />
        )}
      </div>

      {/* ---------------------------- MODALES ----------------------------
          Montados sólo con una fila elegida: así el <dialog> arranca con los
          datos de esa interacción y no con los de la anterior. */}
      {enEdicion && (
        <ModalEditarInteraccion
          abierto
          interaccion={enEdicion}
          guardando={edicion.isPending}
          // El error va adentro del modal: con el <dialog> abierto, cualquier
          // banner de la página queda detrás del backdrop.
          error={
            edicion.error
              ? mensajeDeGuardado(edicion.error, 'No se pudo guardar la interacción.')
              : null
          }
          onCerrar={() => {
            edicion.reset()
            setEnEdicion(null)
          }}
          onGuardar={(campos) => {
            // Sin cambios no se llama a la base: un guardado vacío contra una
            // fila fuera de ventana daría un error que no aporta nada.
            if (Object.keys(campos).length === 0) {
              setEnEdicion(null)
              return
            }
            edicion.mutate(
              { id: enEdicion.id, campos },
              {
                onSuccess: () => {
                  setEnEdicion(null)
                  mostrarAviso('Interacción actualizada.')
                },
              },
            )
          }}
        />
      )}

      {enBorrado && (
        <ModalConfirmarEliminar
          abierto
          titulo="Eliminar interacción"
          descripcion="¿Eliminar esta interacción? Esta acción no se puede deshacer."
          eliminando={borrado.isPending}
          error={
            borrado.error
              ? mensajeDeGuardado(borrado.error, 'No se pudo eliminar la interacción.')
              : null
          }
          onCancelar={() => {
            borrado.reset()
            setEnBorrado(null)
          }}
          onConfirmar={() =>
            borrado.mutate(enBorrado.id, {
              onSuccess: () => {
                setEnBorrado(null)
                mostrarAviso('Interacción eliminada.')
              },
            })
          }
        />
      )}
    </section>
  )
}

/**
 * Todas las tareas del lead, completables y borrables desde acá.
 *
 * El panel del Resumen muestra las mismas filas; esta tab es la lista entera,
 * con el alta arriba. Comparten hook y clave de cache, así que tildar en un
 * lado se ve en el otro sin wiring extra.
 */
function PanelTareas({
  leadId,
  miId,
  onNuevaTarea,
}: {
  leadId: string
  miId: string
  onNuevaTarea: () => void
}) {
  const { data, isPending, isError, error } = useTareasPorLead(leadId)

  const completar = useCompletarTarea()
  const descompletar = useDescompletarTarea()
  const borrar = useEliminarTarea()

  // Mismo reparto que en /tareas: el estado actual decide qué mutación corre.
  function alternarCompletada(tarea: Tarea) {
    const mutacion = tarea.estado === 'COMPLETADA' ? descompletar : completar
    mutacion.mutate(tarea.id)
  }

  const idCambiando =
    completar.isPending || descompletar.isPending
      ? ((completar.variables ?? descompletar.variables) ?? null)
      : null

  const tareas = data ?? []

  return (
    <>
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={onNuevaTarea}
          className="inline-flex items-center gap-1.5 rounded-md border-2 border-primary bg-brand-softer px-4.5 py-2.5 text-[0.85rem] font-extrabold tracking-[0.04em] text-primary uppercase transition-colors hover:bg-primary-dark hover:text-white motion-reduce:transition-none"
        >
          + Nueva tarea
        </button>
      </div>

      {isPending ? (
        <div aria-busy="true" aria-label="Cargando tareas" className="space-y-3">
          {Array.from({ length: 2 }, (_, i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-xl bg-surface-2 motion-reduce:animate-none"
            />
          ))}
        </div>
      ) : isError ? (
        <p
          role="alert"
          className="rounded-lg border border-peligro-borde bg-peligro-soft px-4 py-3 text-[0.9rem] text-peligro-ink"
        >
          {error instanceof Error ? error.message : 'No pudimos cargar las tareas.'}
        </p>
      ) : tareas.length === 0 ? (
        <EstadoVacio
          icono={<IconoCalendario className="size-10" />}
          titulo="Sin tareas"
          detalle="Este lead todavía no tiene ninguna tarea asociada."
        />
      ) : (
        <ul className="space-y-2">
          {tareas.map((tarea) => (
            <ItemTarea
              key={tarea.id}
              tarea={tarea}
              miId={miId}
              cambiando={idCambiando === tarea.id}
              eliminando={borrar.isPending && borrar.variables === tarea.id}
              onAlternarCompletada={alternarCompletada}
              onEliminar={(t) => borrar.mutate(t.id)}
            />
          ))}
        </ul>
      )}
    </>
  )
}

/**
 * Propiedades de las que el lead es propietario.
 *
 * Reusa las cards del listado de Propiedades sin la columna de propietario:
 * acá todas dirían el mismo nombre.
 */
function PanelPropiedades({
  leadId,
  propiedades,
  cargando,
  error,
}: {
  leadId: string
  propiedades: PropiedadConPropietario[]
  cargando: boolean
  error: string | null
}) {
  if (cargando) {
    return (
      <div aria-busy="true" aria-label="Cargando propiedades" className="space-y-3">
        {Array.from({ length: 2 }, (_, i) => (
          <div
            key={i}
            className="h-32 animate-pulse rounded-xl bg-surface-2 motion-reduce:animate-none"
          />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <p
        role="alert"
        className="rounded-lg border border-peligro-borde bg-peligro-soft px-4 py-3 text-[0.9rem] text-peligro-ink"
      >
        {error}
      </p>
    )
  }

  if (propiedades.length === 0) {
    return (
      <EstadoVacio
        icono={<IconoCasa className="size-10" />}
        titulo="Sin propiedades"
        detalle="Este lead todavía no figura como propietario de ninguna propiedad."
        accion={
          <Link
            to={`/propiedades/nueva?propietario=${leadId}`}
            className="inline-flex items-center gap-1.5 rounded-md border-2 border-primary bg-brand-softer px-4.5 py-2.5 text-[0.85rem] font-extrabold tracking-[0.04em] text-primary uppercase transition-colors hover:bg-primary-dark hover:text-white motion-reduce:transition-none"
          >
            + Nueva propiedad
          </Link>
        }
      />
    )
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Link
          to={`/propiedades/nueva?propietario=${leadId}`}
          className="inline-flex items-center gap-1.5 rounded-md border-2 border-primary bg-brand-softer px-4.5 py-2.5 text-[0.85rem] font-extrabold tracking-[0.04em] text-primary uppercase transition-colors hover:bg-primary-dark hover:text-white motion-reduce:transition-none"
        >
          + Nueva propiedad
        </Link>
      </div>

      <PropiedadesCards propiedades={propiedades} ocultarPropietario />
    </>
  )
}

function EstadoVacio({
  icono,
  titulo,
  detalle,
  accion,
}: {
  icono: ReactNode
  titulo: string
  detalle: string
  /** Qué ofrecerle al usuario para salir del vacío. */
  accion?: ReactNode
}) {
  return (
    <div className="rounded-[16px] border border-dashed border-border bg-background px-5 py-10 text-center text-ink-3">
      <div className="mb-2 flex justify-center text-ink-3">{icono}</div>
      <h3 className="mb-1.5 font-semibold text-ink-2">{titulo}</h3>
      <p className="text-[0.9rem]">{detalle}</p>
      {accion && <div className="mt-4 flex justify-center">{accion}</div>}
    </div>
  )
}
