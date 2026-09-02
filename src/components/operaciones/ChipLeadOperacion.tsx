import { Link } from 'react-router-dom'
import { AvatarLead } from '../leads/AvatarLead'
import { BadgeEstado } from '../leads/BadgeEstado'
import { TelefonoConAcciones } from '../comunes/AccionesContacto'
import type { OperacionDetalle } from '../../lib/api/operaciones'

type Lead = NonNullable<OperacionDetalle['lead']>

export function ChipLeadOperacion({ lead }: { lead: Lead | null }) {
  if (!lead) {
    return (
      <div className="rounded-[14px] border border-dashed border-border bg-background px-5 py-8 text-center">
        <p className="text-[0.9rem] text-ink-3">Sin lead asociado.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-[14px] border border-border bg-surface p-5">
      <AvatarLead
        nombre={lead.nombre}
        apellido={lead.apellido}
        estado={lead.estado}
        className="size-10 text-sm"
      />

      <div className="min-w-0 flex-1">
        <p className="font-bold text-ink">
          {lead.nombre} {lead.apellido ?? ''}
        </p>
        {lead.telefono && (
          <p className="mt-0.5 flex items-center text-[0.82rem] text-ink-3">
            <TelefonoConAcciones
              telefono={lead.telefono}
              nombre={`${lead.nombre} ${lead.apellido ?? ''}`.trim()}
              conIcono
            />
          </p>
        )}
      </div>

      <BadgeEstado estado={lead.estado} />

      <Link
        to={`/leads/${lead.id}`}
        className="text-[0.85rem] font-semibold text-primary hover:underline"
      >
        Ver lead →
      </Link>
    </div>
  )
}
