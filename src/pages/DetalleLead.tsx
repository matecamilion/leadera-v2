import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ESTILOS } from '../components/leads/estilosEstado'
import { BadgeEncuesta } from '../components/leads/ConsultaDelLead'
import { IconoCerrar, IconoChevronAbajo } from '../components/leads/Iconos'
import { LineaMetricasLead } from '../components/leads/LineaMetricasLead'
import { CLASES_ACCION_SECUNDARIA } from '../components/leads/clasesAccion'
import { ModalCambiarEstado } from '../components/leads/ModalCambiarEstado'
import { ModalEditarContacto } from '../components/leads/ModalEditarContacto'
import { ModalEliminarLead } from '../components/leads/ModalEliminarLead'
import { ModalNuevaInteraccion } from '../components/leads/ModalNuevaInteraccion'
import { ModalNuevaTarea } from '../components/tareas/ModalNuevaTarea'
import { ModalNuevaVisita } from '../components/tareas/ModalNuevaVisita'
import { MenuDesplegable, type ItemMenu } from '../components/comunes/MenuDesplegable'
import { TooltipAyuda } from '../components/comunes/TooltipAyuda'
import { useAuth } from '../contexts/AuthContext'
import { useRolesPorLead } from '../hooks/useOperacionesPorLead'
import { TabsDetalleLead } from '../components/leads/TabsDetalleLead'
import {
  useActualizarContacto,
  useActualizarEstado,
  useEliminarLead,
  useLead,
  useNombreAgente,
} from '../hooks/useLead'
import { hoyComoClave } from '../lib/calendario'
import { etiquetaEstado, type EstadoLead } from '../lib/etiquetasLead'
import { etiquetaRol } from '../lib/api/rolLead'
import { useUiStore } from '../stores/ui'

type ModalAbierto =
  | 'estado'
  | 'contacto'
  | 'interaccion'
  | 'tarea'
  | 'visita'
  | 'eliminar'
  | null

export default function DetalleLead() {
  const { id = '' } = useParams()
  const navigate = useNavigate()

  const { data: lead, isPending, isError, error } = useLead(id)
  const mostrarAviso = useUiStore((s) => s.mostrarAviso)
  const [modal, setModal] = useState<ModalAbierto>(null)
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)

  // El mismo cálculo que el listado, para un solo lead. Antes de los returns
  // tempranos: es un hook.
  const rolDe = useRolesPorLead(id ? [id] : [])
  const rolLead = rolDe(id)
  const { profile } = useAuth()
  const asignado = useNombreAgente(lead?.asignado_a)

  const cambioEstado = useActualizarEstado(id)
  const cambioContacto = useActualizarContacto(id)
  const borrado = useEliminarLead()

  if (isPending) return <Skeleton />

  if (isError) {
    return (
      <Aviso
        titulo="No pudimos cargar el lead"
        detalle={error instanceof Error ? error.message : 'Probá de nuevo en un momento.'}
      />
    )
  }

  // `null` cubre tanto "no existe" como "RLS lo tapa": para el usuario es lo
  // mismo, y separarlos filtraría si el id pertenece a otra inmobiliaria.
  if (!lead) {
    return (
      <Aviso
        titulo="No encontramos este lead"
        detalle="Puede que lo hayan eliminado o que no tengas permiso para verlo."
      />
    )
  }

  const nombreCompleto = `${lead.nombre} ${lead.apellido ?? ''}`.trim()

  const itemsMas: ItemMenu[] = [
    { label: '+ Tarea', onSelect: () => setModal('tarea') },
    { label: '+ Propiedad', to: `/propiedades/nueva?propietario=${lead.id}` },
    { label: '+ Operación', to: `/operaciones/nueva?lead=${lead.id}` },
    { label: 'Cambiar estado', onSelect: () => setModal('estado') },
    ...(profile?.rol === 'ASISTENTE'
      ? []
      : [{ label: 'Eliminar lead', onSelect: () => setModal('eliminar'), peligro: true }]),
  ]

  return (
    <div className="mx-auto box-border max-w-[900px]">
      {errorGeneral && (
        <div
          role="alert"
          className="mb-5 flex items-start gap-3 rounded-lg border border-peligro-borde bg-peligro-soft px-4 py-3 text-[0.9rem] text-peligro-ink"
        >
          <span className="flex-1">{errorGeneral}</span>
          <button
            type="button"
            aria-label="Cerrar el aviso"
            onClick={() => setErrorGeneral(null)}
            className="shrink-0 rounded p-0.5 hover:bg-peligro-borde"
          >
            <IconoCerrar className="size-4" />
          </button>
        </div>
      )}

      {/* ---------------------------- ENCABEZADO ---------------------------- */}
      <header className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="m-0 text-pagina font-semibold text-balance break-words text-ink">
            {nombreCompleto}
          </h1>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <BotonEstadoLead estado={lead.estado} onClick={() => setModal('estado')} />
            <TooltipAyuda etiqueta="los estados del lead">
              Caliente, Tibio y Frío marcan qué tan cerca está de cerrar. Ganado
              ya cerró, Inactivo dejó de responder, y Nuevo es el que todavía
              nadie clasificó. Lo actualizás vos a mano: no se recalcula solo.
            </TooltipAyuda>
            <BadgeEncuesta leadId={lead.id} />
          </div>

          {(asignado.data || rolLead) && (
            <p className="m-0 mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-ink-3">
              {asignado.data && <span>Asignado a {asignado.data}</span>}
              {asignado.data && rolLead && <span aria-hidden>·</span>}
              {rolLead && (
                <span className="inline-flex items-center gap-1.5">
                  {etiquetaRol(rolLead)}
                  <TooltipAyuda etiqueta="el rol del lead">
                    Se calcula solo, no hace falta cargarlo. Es vendedor si es
                    propietario de alguna propiedad o si alquila una. Es comprador
                    si tiene una búsqueda cargada o si compra en una venta de otro
                    propietario.
                  </TooltipAyuda>
                </span>
              )}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2 sm:shrink-0 sm:justify-end">
          <button
            type="button"
            onClick={() => setModal('interaccion')}
            className={CLASES_ACCION_PRINCIPAL}
          >
            Registrar interacción
          </button>
          <button type="button" onClick={() => setModal('visita')} className={CLASES_ACCION}>
            Coordinar visita
          </button>
          <div className="min-w-0 flex-1 sm:flex-none">
            <MenuDesplegable
              etiqueta="Más acciones"
              alinear="derecha"
              claseBoton={`${CLASES_ACCION} w-full`}
              boton={
                <>
                  Más
                  <IconoChevronAbajo className="size-3.5" />
                </>
              }
              items={itemsMas}
            />
          </div>
        </div>
      </header>

      <LineaMetricasLead lead={lead} />

      {/* Los dos modales que se abren desde adentro de las tabs se siguen
          montando acá: uno solo por pantalla. Las tabs sólo llevan el
          disparador hasta donde vive el botón. */}
      <TabsDetalleLead
        lead={lead}
        leadId={lead.id}
        onNuevaInteraccion={() => setModal('interaccion')}
        onEditarContacto={() => setModal('contacto')}
        onNuevaTarea={() => setModal('tarea')}
      />

      {/* ---------------------------- MODALES ---------------------------- */}
      <ModalCambiarEstado
        abierto={modal === 'estado'}
        nombreLead={lead.nombre}
        guardando={cambioEstado.isPending}
        error={cambioEstado.error instanceof Error ? cambioEstado.error.message : null}
        onCerrar={() => {
          cambioEstado.reset()
          setModal(null)
        }}
        onElegir={(estado) =>
          cambioEstado.mutate(estado, {
            onSuccess: () => {
              setModal(null)
              mostrarAviso('Estado actualizado.')
            },
            onError: (e) => setErrorGeneral(e.message),
          })
        }
      />

      <ModalEditarContacto
        abierto={modal === 'contacto'}
        lead={lead}
        guardando={cambioContacto.isPending}
        error={cambioContacto.error instanceof Error ? cambioContacto.error.message : null}
        onCerrar={() => {
          cambioContacto.reset()
          setModal(null)
        }}
        onGuardar={(contacto) =>
          cambioContacto.mutate(contacto, {
            onSuccess: () => {
              setModal(null)
              mostrarAviso('Contacto actualizado.')
            },
            onError: (e) => setErrorGeneral(e.message),
          })
        }
      />

      <ModalNuevaInteraccion
        abierto={modal === 'interaccion'}
        leadId={lead.id}
        nombreLead={nombreCompleto}
        onCerrar={() => setModal(null)}
        onCreada={() => mostrarAviso('Interacción registrada.')}
      />

      {/* Montado sólo cuando se abre: así arranca con la fecha de hoy y los
          campos limpios en cada alta, sin necesidad de resetearlos a mano. */}
      {modal === 'tarea' && (
        <ModalNuevaTarea
          fechaInicial={hoyComoClave()}
          leadFijo={{ id: lead.id, nombre: lead.nombre, apellido: lead.apellido }}
          onCerrar={() => setModal(null)}
        />
      )}

      {/* Mismo criterio que la tarea: montado sólo al abrirse. */}
      {modal === 'visita' && (
        <ModalNuevaVisita
          fechaInicial={hoyComoClave()}
          leadFijo={{ id: lead.id, nombre: lead.nombre, apellido: lead.apellido }}
          onCerrar={() => setModal(null)}
          onCreada={() => mostrarAviso('Visita agendada.')}
        />
      )}

      <ModalEliminarLead
        abierto={modal === 'eliminar'}
        nombreLead={lead.nombre}
        eliminando={borrado.isPending}
        error={borrado.error instanceof Error ? borrado.error.message : null}
        onCancelar={() => {
          borrado.reset()
          setModal(null)
        }}
        onConfirmar={() =>
          borrado.mutate(lead.id, {
            // Borrado desde la ficha: no hay a dónde volver, así que al listado.
            // El aviso va por el store porque la ficha se desmonta al navegar.
            onSuccess: () => {
              mostrarAviso('Lead eliminado.')
              navigate('/leads', { replace: true })
            },
          })
        }
      />
    </div>
  )
}

/** Acciones secundarias del encabezado: en mobile se reparten la fila bajo "Registrar interacción". */
const CLASES_ACCION = `${CLASES_ACCION_SECUNDARIA} flex-1 sm:flex-none`

const CLASES_ACCION_PRINCIPAL = [
  'inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg',
  'bg-primary px-4 py-2.5 text-[0.9rem] font-semibold whitespace-nowrap text-primary-contrast',
  'transition-colors hover:bg-primary-dark sm:min-h-10 sm:w-auto motion-reduce:transition-none',
].join(' ')

/** El estado del lead: punto con el color de la temperatura, texto neutro; abre el cambio de estado. */
function BotonEstadoLead({
  estado,
  onClick,
}: {
  estado: EstadoLead | null
  onClick: () => void
}) {
  const nombre = etiquetaEstado(estado)
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Estado: ${nombre}. Cambiar el estado del lead`}
      className="group inline-flex cursor-pointer items-center gap-2 rounded-md text-cuerpo font-medium text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <span
        aria-hidden
        className={`size-2 shrink-0 rounded-full bg-current ${ESTILOS[estado ?? 'NUEVO']}`}
      />
      <span className="decoration-ink-4 underline-offset-4 group-hover:underline">{nombre}</span>
      <IconoChevronAbajo className="size-3.5 text-ink-3" />
    </button>
  )
}

/**
 * Placeholder inerte, para las secciones que todavía no tienen pantalla.
 *
 * Ya no lo usa nadie —Propiedad y Operación pasaron a ser links reales— pero se
 * conserva para el próximo caso. Va exportado porque `noUnusedLocals` rechaza
 * una función de módulo sin usar; si aparece un segundo consumidor, conviene
 * mudarlo a `components/comunes/`.
 */
export function BotonProximamente({ label }: { label: string }) {
  return (
    <button
      type="button"
      disabled
      title="Próximamente"
      className="inline-flex flex-1 cursor-not-allowed items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-3.5 py-2 text-[0.82rem] font-semibold whitespace-nowrap text-ink opacity-55 lg:flex-none"
    >
      {label}
    </button>
  )
}

function Aviso({ titulo, detalle }: { titulo: string; detalle: string }) {
  return (
    <div className="mx-auto max-w-[900px]">
      <div className="rounded-[16px] border border-dashed border-border bg-surface px-6 py-14 text-center">
        <p className="text-sm font-medium text-ink">{titulo}</p>
        <p className="mt-1 text-sm text-ink-3">{detalle}</p>
        <Link
          to="/leads"
          className="mt-5 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-contrast hover:bg-primary-dark"
        >
          Volver a leads
        </Link>
      </div>
    </div>
  )
}

function Skeleton() {
  return (
    <div aria-busy="true" aria-label="Cargando el lead" className="mx-auto max-w-[900px]">
      <div className="mb-6 h-24 animate-pulse rounded-lg bg-surface-2 motion-reduce:animate-none" />
      <div className="mb-5 h-10 animate-pulse rounded-md bg-surface-2 motion-reduce:animate-none" />
      <div className="h-48 animate-pulse rounded-[16px] bg-surface-2 motion-reduce:animate-none" />
    </div>
  )
}
