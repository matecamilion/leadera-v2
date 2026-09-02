import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  useActualizarInteraccion,
  useEliminarInteraccion,
  useInteraccionesPorLead,
} from '../../hooks/useInteracciones'
import { useOperacionesPorLead } from '../../hooks/useOperacion'
import { usePropiedadesPorLead } from '../../hooks/usePropiedades'
import { ModalConfirmarEliminar } from '../comunes/ModalConfirmarEliminar'
import { ListaOperacionesCompacta } from '../operaciones/ListaOperacionesCompacta'
import { PropiedadesCards } from '../propiedades/PropiedadesCards'
import { IconoCasa } from './Iconos'
import { ModalEditarInteraccion } from './ModalEditarInteraccion'
import { TimelineInteracciones } from './TimelineInteracciones'
import { mensajeDeGuardado } from '../../lib/mensajesDeError'
import { useUiStore } from '../../stores/ui'
import type { Interaccion } from '../../lib/api/interacciones'
import type { PropiedadConPropietario } from '../../lib/api/propiedades'

type Tab = 'interacciones' | 'operaciones' | 'propiedades'

interface TabsDetalleLeadProps {
  leadId: string
  /** Abre el alta de interacción. El modal lo monta `DetalleLead`. */
  onNuevaInteraccion: () => void
}

/**
 * Shell de tabs de la ficha.
 *
 * Arranca en Interacciones. Las tres tabs muestran el conteo real de lo que
 * hay del otro lado.
 */
export function TabsDetalleLead({
  leadId,
  onNuevaInteraccion,
}: TabsDetalleLeadProps) {
  const [activa, setActiva] = useState<Tab>('interacciones')
  const { data: interacciones, isPending, error } = useInteraccionesPorLead(leadId)
  const operaciones = useOperacionesPorLead(leadId)
  const propiedades = usePropiedadesPorLead(leadId)

  const mostrarAviso = useUiStore((s) => s.mostrarAviso)
  // Qué interacción está en el modal, y cuál de los dos. La fila se guarda
  // entera —y no sólo el id— porque el modal necesita sus valores actuales
  // para precargarse.
  const [enEdicion, setEnEdicion] = useState<Interaccion | null>(null)
  const [enBorrado, setEnBorrado] = useState<Interaccion | null>(null)
  const edicion = useActualizarInteraccion(leadId)
  const borrado = useEliminarInteraccion(leadId)

  const tabs: { id: Tab; label: string; n: number }[] = [
    { id: 'interacciones', label: 'Interacciones', n: interacciones?.length ?? 0 },
    { id: 'operaciones', label: 'Operaciones', n: operaciones.data?.length ?? 0 },
    { id: 'propiedades', label: 'Propiedades', n: propiedades.data?.length ?? 0 },
  ]

  return (
    <section>
      <div
        role="tablist"
        aria-label="Secciones del lead"
        className="mb-5 flex border-b-2 border-border"
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
                '-mb-0.5 border-b-2 px-4.5 py-2.5 text-[0.83rem] font-semibold',
                'transition-colors motion-reduce:transition-none',
                'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary',
                activo
                  ? 'border-primary text-primary'
                  : 'border-transparent text-ink-3 hover:text-ink',
              ].join(' ')}
            >
              {tab.label} ({tab.n})
            </button>
          )
        })}
      </div>

      <div className="min-h-[200px]">
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
