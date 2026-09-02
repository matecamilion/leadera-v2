import { Link } from 'react-router-dom'
import { AvatarLead } from '../leads/AvatarLead'
import { BadgeEstado } from '../leads/BadgeEstado'
import { TelefonoConAcciones } from '../comunes/AccionesContacto'
import { etiquetaOrigen } from '../../lib/api/leads'
import type { LeadPropietario } from '../../lib/api/propiedades'

export function SeccionLeadPropietario({ lead }: { lead: LeadPropietario | null }) {
  if (!lead) {
    return (
      <div className="rounded-[16px] border border-dashed border-border bg-background px-5 py-8 text-center">
        <p className="text-[0.9rem] text-ink-3">Sin lead propietario asociado.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-[16px] border border-border bg-surface p-5">
      <AvatarLead
        nombre={lead.nombre}
        apellido={lead.apellido}
        estado={lead.estado}
        className="size-12 text-base"
      />

      <div className="min-w-0 flex-1">
        <p className="font-bold text-ink">
          {lead.nombre} {lead.apellido ?? ''}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-3 text-[0.82rem] text-ink-3">
          {lead.telefono && (
            <TelefonoConAcciones
              telefono={lead.telefono}
              nombre={`${lead.nombre} ${lead.apellido ?? ''}`.trim()}
              conIcono
            />
          )}
          {lead.origen && <span>{etiquetaOrigen(lead.origen)}</span>}
        </div>
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
