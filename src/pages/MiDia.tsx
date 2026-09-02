import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CardResumen } from '../components/dashboard/CardResumen'
import { ListaLeads } from '../components/dashboard/ListaLeads'
import { SeccionCoincidencias } from '../components/dashboard/SeccionCoincidencias'
import { IconoCheck } from '../components/leads/Iconos'
import { ModalNuevaInteraccion } from '../components/leads/ModalNuevaInteraccion'
import {
  useCoincidenciasDelDia,
  useLeadsDelDia,
  useProgresoDelDia,
} from '../hooks/useDashboard'
import { useAuth } from '../contexts/AuthContext'
import { useUiStore } from '../stores/ui'
import type { ProgresoDia } from '../lib/api/dashboard'
import type { Lead } from '../lib/api/leads'

export default function MiDia() {
  const { profile } = useAuth()
  const { data, isPending, isError, error } = useLeadsDelDia()
  const coincidencias = useCoincidenciasDelDia()
  const progreso = useProgresoDelDia()

  const mostrarAviso = useUiStore((s) => s.mostrarAviso)
  // Sobre qué lead se está registrando. Va antes de los returns tempranos de
  // acá abajo: los hooks no pueden quedar detrás de un `if`.
  const [leadARegistrar, setLeadARegistrar] = useState<Lead | null>(null)

  // `!data` además de `isPending`: el hook deriva de otra query y devuelve las
  // banderas sueltas, así que no es la unión discriminada de react-query.
  if (isPending || !data) return <Skeleton />

  if (isError) {
    return (
      <div className="mx-auto max-w-[1120px]">
        <p
          role="alert"
          className="rounded-lg border border-peligro-borde bg-peligro-soft px-4 py-3 text-[0.9rem] text-peligro-ink"
        >
          {error instanceof Error ? error.message : 'No pudimos cargar tu jornada.'}
        </p>
      </div>
    )
  }

  const { prioritarios, nuevos, seguimientos } = data

  // Lo que se muestra en el hero es lo que hay para hacer hoy. Se suman los
  // totales reales y no los recortes de 10, si no el número mentiría en cuanto
  // una categoría pasa el límite.
  const totalPendientes = prioritarios.total + nuevos.total + seguimientos.total
  const alDia = totalPendientes === 0

  const listaCoincidencias = coincidencias.data ?? []

  return (
    <div className="mx-auto max-w-[1120px]">
      {/* Banda hero; las cards de resumen la pisan por abajo. */}
      <section className="rounded-2xl bg-gradient-to-br from-primary to-sidebar px-5 pt-7 pb-16 sm:px-7 sm:pt-8">
        <h1 className="m-0 text-[1.6rem] leading-tight font-bold text-balance text-white sm:text-[2rem]">
          {alDia ? (
            <>Estás al día{profile ? `, ${profile.nombre}` : ''}</>
          ) : (
            <>
              Hoy te quedan{' '}
              <span className="text-badge-tibio-bg">{totalPendientes}</span>{' '}
              {totalPendientes === 1 ? 'tarea' : 'tareas'}
            </>
          )}
        </h1>
        <p className="mt-2 text-[0.95rem] text-brand-soft sm:text-[1.05rem]">
          {alDia
            ? 'No tenés pendientes urgentes. Buen momento para sumar leads a la cartera.'
            : 'Gestioná tus contactos y hacé crecer tu cartera'}
        </p>
      </section>

      <div className="relative mx-5 -mt-11 mb-7 grid grid-cols-3 gap-2 sm:gap-3">
        <CardResumen
          variante="calientes"
          numero={prioritarios.total}
          label="Prioritarios"
          descripcion="leads prioritarios"
          a="/leads?estado=CALIENTE"
        />
        <CardResumen
          variante="nuevos"
          numero={nuevos.total}
          label="Nuevos"
          descripcion="leads nuevos sin contactar"
          a="/leads?estado=nuevos"
        />
        <CardResumen
          variante="seguimientos"
          numero={seguimientos.total}
          label="Seguim."
          descripcion="seguimientos para hoy"
          a="/leads"
        />
      </div>

      <SeccionProgreso
        data={progreso.data}
        isPending={progreso.isPending}
        isError={progreso.isError}
      />

      {listaCoincidencias.length > 0 && (
        <SeccionCoincidencias coincidencias={listaCoincidencias} />
      )}

      {alDia ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface px-6 py-12 text-center">
          <span
            aria-hidden
            className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-badge-ganado-bg text-primary-dark"
          >
            <IconoCheck className="size-6" />
          </span>
          <h2 className="m-0 text-[1.05rem] font-bold text-ink">
            Estás al día, no tenés pendientes urgentes
          </h2>
          <p className="mt-1.5 text-[0.9rem] text-ink-3">
            Ningún lead prioritario, sin contactar ni con seguimiento para hoy.
          </p>
        </div>
      ) : (
        <>
          <ListaLeads
            titulo="Leads prioritarios"
            subtitulo="Calientes o con el seguimiento vencido"
            textoBadge={prioritarios.leads.length === 1 ? 'urgente' : 'urgentes'}
            variante="prioritarios"
            leads={prioritarios.leads}
            total={prioritarios.total}
            verTodosRuta="/leads?estado=CALIENTE"
            onRegistrar={setLeadARegistrar}
          />

          <ListaLeads
            titulo="Nuevos leads"
            subtitulo="Todavía no tuvieron un primer contacto"
            textoBadge={nuevos.leads.length === 1 ? 'nuevo' : 'nuevos'}
            variante="nuevos"
            leads={nuevos.leads}
            total={nuevos.total}
            verTodosRuta="/leads?estado=nuevos"
            onRegistrar={setLeadARegistrar}
          />

          <ListaLeads
            titulo="Seguimientos"
            subtitulo="Contactos que necesitan un recordatorio hoy"
            textoBadge={seguimientos.leads.length === 1 ? 'pendiente' : 'pendientes'}
            variante="seguimientos"
            leads={seguimientos.leads}
            total={seguimientos.total}
            verTodosRuta="/leads"
            onRegistrar={setLeadARegistrar}
          />
        </>
      )}

      {/* Registrar desde acá no navega: `useCrearInteraccion` invalida
          `['leads']`, del que cuelgan los candidatos del día y los contactados
          de hoy, así que la fila se va de su sección y el progreso avanza sin
          que la pantalla se recargue. */}
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

// ---------------------------------------------------------------------------
// Progreso del día
// ---------------------------------------------------------------------------

interface SeccionProgresoProps {
  data: ProgresoDia | undefined
  isPending: boolean
  isError: boolean
}

/**
 * "Completaste X de Y" con la barra y el detalle desplegable.
 *
 * Va sin `role="progressbar"`: es un resumen de una lista que está justo
 * debajo, no un indicador de una operación en curso. Los números se leen del
 * texto, y la barra queda como refuerzo visual (`aria-hidden`).
 *
 * Si el progreso falla no se rompe la jornada entera: la sección desaparece y
 * el resto de Mi día sigue en pie.
 */
function SeccionProgreso({ data, isPending, isError }: SeccionProgresoProps) {
  if (isError) return null

  if (isPending || !data) {
    return (
      <div className="mb-7 h-[92px] animate-pulse rounded-2xl bg-surface-2 motion-reduce:animate-none" />
    )
  }

  const { completados, total } = data
  // Sin nada agendado no hay progreso que mostrar: una barra al 100% porque el
  // día está vacío se leería como un logro que no pasó.
  if (total === 0) return null

  const porcentaje = Math.round((completados / total) * 100)
  const listo = completados === total

  return (
    <section className="mb-7 rounded-2xl border border-border bg-surface px-5 py-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className={[
              'grid size-10 shrink-0 place-items-center rounded-full',
              listo ? 'bg-badge-ganado-bg text-primary-dark' : 'bg-brand-soft text-primary',
            ].join(' ')}
          >
            <IconoCheck className="size-5" />
          </span>
          <div>
            <h2 className="m-0 text-[0.95rem] font-bold text-ink">Progreso del día</h2>
            <p className="mt-0.5 text-[0.85rem] text-ink-3">
              Completaste{' '}
              <b className="text-ink tabular-nums">
                {completados} de {total}
              </b>
            </p>
          </div>
        </div>

        <Link
          to="/mi-dia/contactados"
          className="rounded-lg px-2 py-1 text-[0.82rem] font-semibold whitespace-nowrap text-primary transition-colors hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
        >
          Ver detalle →
        </Link>
      </div>

      <div
        aria-hidden
        className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500 motion-reduce:transition-none"
          style={{ width: `${porcentaje}%` }}
        />
      </div>
    </section>
  )
}

function Skeleton() {
  return (
    <div aria-busy="true" aria-label="Cargando tu jornada" className="mx-auto max-w-[1120px]">
      <div className="h-[168px] animate-pulse rounded-2xl bg-surface-2 motion-reduce:animate-none" />

      <div className="relative mx-5 -mt-11 mb-7 grid grid-cols-3 gap-2 sm:gap-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={i}
            className="h-[84px] animate-pulse rounded-[14px] bg-surface shadow-md motion-reduce:animate-none"
          />
        ))}
      </div>

      <div className="mb-7 h-[92px] animate-pulse rounded-2xl bg-surface-2 motion-reduce:animate-none" />

      {Array.from({ length: 2 }, (_, seccion) => (
        <div key={seccion} className="mb-8">
          <div className="mb-3 h-8 w-56 animate-pulse rounded bg-surface-2 motion-reduce:animate-none" />
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 5 }, (_, card) => (
              <div
                key={card}
                className="h-[124px] w-[230px] shrink-0 animate-pulse rounded-[14px] bg-surface-2 motion-reduce:animate-none"
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
