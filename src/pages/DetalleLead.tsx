import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AvatarLead } from '../components/leads/AvatarLead'
import { BadgeEstado } from '../components/leads/BadgeEstado'
import {
  IconoCalendario,
  IconoCasa,
  IconoCerrar,
  IconoLapiz,
  IconoLink,
  IconoMail,
  IconoTacho,
  IconoTelefono,
} from '../components/leads/Iconos'
import { ModalCambiarEstado } from '../components/leads/ModalCambiarEstado'
import { ModalEditarContacto } from '../components/leads/ModalEditarContacto'
import { ModalEliminarLead } from '../components/leads/ModalEliminarLead'
import { ModalNuevaInteraccion } from '../components/leads/ModalNuevaInteraccion'
import { EmailLink, TelefonoConAcciones } from '../components/comunes/AccionesContacto'
import { TabsDetalleLead } from '../components/leads/TabsDetalleLead'
import {
  useActualizarContacto,
  useActualizarEstado,
  useEliminarLead,
  useLead,
} from '../hooks/useLead'
import { etiquetaOrigen } from '../lib/api/leads'
import { useVisitasDeLead } from '../hooks/useVisitas'
import { formatearFecha } from '../lib/formatoFecha'
import { useUiStore } from '../stores/ui'

type ModalAbierto = 'estado' | 'contacto' | 'interaccion' | 'eliminar' | null

export default function DetalleLead() {
  const { id = '' } = useParams()
  const visitas = useVisitasDeLead(id)
  const navigate = useNavigate()

  const { data: lead, isPending, isError, error } = useLead(id)
  const mostrarAviso = useUiStore((s) => s.mostrarAviso)
  const [modal, setModal] = useState<ModalAbierto>(null)
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)

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

      {/* ---------------------------- HEADER BAND ---------------------------- */}
      <div className="mb-7 flex flex-col items-start gap-4.5 rounded-[16px] border border-border bg-surface p-6 lg:flex-row">
        <AvatarLead nombre={lead.nombre} apellido={lead.apellido} estado={lead.estado} />

        <div className="min-w-0 flex-1">
          <p className="mb-1 text-xs leading-tight font-bold tracking-[0.05em] text-primary uppercase">
            Ficha de lead
          </p>

          <div className="mb-2 flex flex-wrap items-center gap-2.5">
            <h1 className="m-0 text-[1.35rem] leading-tight font-bold text-ink">
              {nombreCompleto}
            </h1>
            <button
              type="button"
              onClick={() => setModal('estado')}
              aria-label="Cambiar el estado del lead"
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
            >
              <BadgeEstado estado={lead.estado} />
              <IconoLapiz className="size-3.5 text-ink-3" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-1.5 text-[0.82rem] text-ink-3">
              {lead.telefono ? (
                <TelefonoConAcciones
                  telefono={lead.telefono}
                  nombre={nombreCompleto}
                  conIcono
                />
              ) : (
                <>
                  <IconoTelefono className="size-4 shrink-0" />
                  Sin teléfono
                </>
              )}
              <button
                type="button"
                title="Editar contacto"
                aria-label="Editar contacto"
                onClick={() => setModal('contacto')}
                className="inline-flex rounded p-0.5 text-ink-3 transition-colors hover:bg-brand-softer hover:text-primary motion-reduce:transition-none"
              >
                <IconoLapiz className="size-3.5" />
              </button>
            </span>

            {/* Sin email no va nada: mismo criterio que el origen y las
                visitas de acá abajo. El teléfono sí muestra "Sin teléfono"
                porque es obligatorio y su ausencia es un dato. */}
            {lead.email && (
              <span className="flex min-w-0 items-center gap-1.5 text-[0.82rem] text-ink-3">
                <IconoMail className="size-4 shrink-0" />
                <EmailLink email={lead.email} />
              </span>
            )}

            <span className="flex items-center gap-1.5 text-[0.82rem] text-ink-3">
              <IconoCalendario className="size-4 shrink-0" />
              Desde {formatearFecha(lead.fecha_ingreso)}
            </span>

            {lead.origen && (
              <span className="flex items-center gap-1.5 text-[0.82rem] text-ink-3">
                <IconoLink className="size-4 shrink-0" />
                {etiquetaOrigen(lead.origen)}
              </span>
            )}

            {/* En cero no se muestra nada: mismo criterio que el origen de acá
                arriba y que los campos opcionales de la ficha de propiedad. */}
            {(visitas.data ?? 0) > 0 && (
              <span className="flex items-center gap-1.5 text-[0.82rem] text-ink-3">
                <IconoCasa className="size-4 shrink-0" />
                {visitas.data} {visitas.data === 1 ? 'visita realizada' : 'visitas realizadas'}
              </span>
            )}
          </div>
        </div>

        <div className="flex w-full shrink-0 flex-wrap items-center gap-2 pt-0.5 lg:w-auto">
          {/* Los tres llevan al alta correspondiente con el lead ya cargado:
              `?propietario` y `?lead` los lee el formulario de destino. */}
          <Link
            to={`/propiedades/nueva?propietario=${lead.id}`}
            className={CLASES_ACCION}
          >
            + Propiedad
          </Link>
          {/* Interacción es el único de los tres que no navega: se carga en un
              modal para no perder el lugar. Los otros dos siguen yendo a su
              alta, que pide bastante más que tres campos. */}
          <button
            type="button"
            onClick={() => setModal('interaccion')}
            className={CLASES_ACCION}
          >
            + Interacción
          </button>
          <Link to={`/operaciones/nueva?lead=${lead.id}`} className={CLASES_ACCION}>
            + Operación
          </Link>
        </div>
      </div>

{lead.descripcion_inicial?.trim() && (
  <div className="mb-7 rounded-[16px] border border-border bg-surface p-5">
    <p className="mb-2 text-xs font-bold tracking-[0.05em] text-primary uppercase">
      Sobre el lead
    </p>

    <p className="m-0 whitespace-pre-wrap text-[0.9rem] leading-relaxed text-ink-2">
      {lead.descripcion_inicial}
    </p>
  </div>
)}

      {/* El botón de la tab de Interacciones abre este mismo modal: uno solo
          por pantalla, montado acá. */}
      <TabsDetalleLead
        leadId={lead.id}
        onNuevaInteraccion={() => setModal('interaccion')}
      />

      {/* ---------------------------- ELIMINAR ---------------------------- */}
      <div className="mt-10 flex justify-end border-t border-border pt-6">
        <button
          type="button"
          onClick={() => setModal('eliminar')}
          className="inline-flex items-center gap-1.5 rounded-lg border border-caliente bg-transparent px-3.5 py-[7px] text-[0.8rem] font-medium text-caliente opacity-65 transition hover:bg-hot-soft hover:opacity-100 motion-reduce:transition-none"
        >
          <IconoTacho className="size-4" />
          Eliminar lead
        </button>
      </div>

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

/** Los tres botones de acción del encabezado comparten el mismo look. */
const CLASES_ACCION = [
  'inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg',
  'border border-border bg-surface px-3.5 py-2',
  'text-[0.82rem] font-semibold whitespace-nowrap text-ink',
  'transition-colors hover:bg-background lg:flex-none motion-reduce:transition-none',
].join(' ')

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
          className="mt-5 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark"
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
      <div className="mb-7 h-32 animate-pulse rounded-[16px] bg-surface-2 motion-reduce:animate-none" />
      <div className="mb-5 h-10 animate-pulse rounded-md bg-surface-2 motion-reduce:animate-none" />
      <div className="h-48 animate-pulse rounded-[16px] bg-surface-2 motion-reduce:animate-none" />
    </div>
  )
}
