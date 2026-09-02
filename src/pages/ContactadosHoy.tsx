import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FilaLead } from '../components/dashboard/ListaLeads'
import { IconoCheck, IconoFlechaAtras } from '../components/leads/Iconos'
import { ModalNuevaInteraccion } from '../components/leads/ModalNuevaInteraccion'
import { etiquetaTipoInteraccion } from '../lib/api/interacciones'
import { useContactadosHoy } from '../hooks/useDashboard'
import { useUiStore } from '../stores/ui'
import type { DetalleInteraccion } from '../lib/api/dashboard'
import type { Lead } from '../lib/api/leads'

export default function ContactadosHoy() {
  const { data, isPending, isError, error } = useContactadosHoy()
  const mostrarAviso = useUiStore((s) => s.mostrarAviso)
  // Un lead ya contactado puede sumar otra interacción del mismo día: la fila
  // se queda donde está y `enLugarDelTiempo` pasa a mostrar la nueva.
  const [leadARegistrar, setLeadARegistrar] = useState<Lead | null>(null)

  return (
    <div className="mx-auto max-w-[1120px]">
      <Link
        to="/mi-dia"
        className="inline-flex items-center gap-1.5 text-[0.85rem] font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <IconoFlechaAtras className="size-4" />
        Volver a Mi día
      </Link>

      <header className="mt-4 mb-6 flex flex-wrap items-center gap-3">
        <span
          aria-hidden
          className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-badge-ganado-bg text-primary-dark"
        >
          <IconoCheck className="size-[18px]" />
        </span>
        <div>
          <h1 className="m-0 text-[1.6rem] leading-tight font-bold text-ink">
            Contactados hoy
          </h1>
          <p className="mt-1 text-[0.85rem] text-ink-3">
            Los leads que ya tuvieron una interacción registrada hoy.
          </p>
        </div>

        {data && data.length > 0 && (
          <span className="rounded-full bg-badge-ganado-bg px-2.5 py-0.5 text-[0.72rem] font-bold text-primary-dark">
            {data.length} {data.length === 1 ? 'lead' : 'leads'}
          </span>
        )}
      </header>

      {isPending && <Skeleton />}

      {isError && (
        <p
          role="alert"
          className="rounded-lg border border-peligro-borde bg-peligro-soft px-4 py-3 text-[0.9rem] text-peligro-ink"
        >
          {error instanceof Error
            ? error.message
            : 'No pudimos cargar los contactados de hoy.'}
        </p>
      )}

      {data &&
        (data.length === 0 ? (
          <p className="rounded-[14px] border border-dashed border-border bg-surface-2 px-4 py-10 text-center text-[0.88rem] text-ink-3">
            Todavía no registraste ninguna interacción hoy. Las que cargues van a
            aparecer acá.
          </p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-[14px] border border-border bg-surface">
            {data.map(({ lead, interaccion }) => (
              <FilaLead
                key={lead.id}
                lead={lead}
                onRegistrar={setLeadARegistrar}
                enLugarDelTiempo={<Contacto interaccion={interaccion} />}
              />
            ))}
          </ul>
        ))}

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

/** Con qué y a qué hora se contactó al lead. Reemplaza la columna de tiempos. */
function Contacto({ interaccion }: { interaccion: DetalleInteraccion }) {
  return (
    <span className="font-semibold text-primary-dark">
      {etiquetaTipoInteraccion(interaccion.tipo)}
      {' · '}
      <span className="tabular-nums">{interaccion.hora}</span>
    </span>
  )
}

function Skeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Cargando los contactados de hoy"
      className="divide-y divide-border overflow-hidden rounded-[14px] border border-border bg-surface"
    >
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <div className="size-10 shrink-0 animate-pulse rounded-full bg-surface-2 motion-reduce:animate-none" />
          <div className="flex-1">
            <div className="h-4 w-40 animate-pulse rounded bg-surface-2 motion-reduce:animate-none" />
            <div className="mt-1.5 h-3 w-28 animate-pulse rounded bg-surface-2 motion-reduce:animate-none" />
          </div>
        </div>
      ))}
    </div>
  )
}
