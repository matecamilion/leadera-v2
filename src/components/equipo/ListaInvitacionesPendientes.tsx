import { etiquetaRol } from '../../lib/api/equipo'
import { formatearFecha } from '../../lib/formatoFecha'
import type { InvitacionPendiente } from '../../lib/api/invitaciones'

/** Días que le quedan a una invitación antes de vencer. */
function diasParaVencer(iso: string): number {
  const ms = new Date(iso).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / 86_400_000))
}

/**
 * Invitaciones generadas que todavía nadie usó.
 *
 * No se muestra el token: quien mira esta lista no necesita el link de otro, y
 * dejarlo a la vista convertiría el secreto de la invitación en algo que ve
 * todo el equipo. Quien la generó ya lo copió al crearla.
 */
export function ListaInvitacionesPendientes({
  invitaciones,
}: {
  invitaciones: InvitacionPendiente[]
}) {
  if (invitaciones.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-surface-2 px-4 py-10 text-center text-[0.88rem] text-ink-3">
        No hay invitaciones pendientes. Las que generes aparecen acá hasta que alguien las use.
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-3">
      {invitaciones.map((inv) => {
        const dias = diasParaVencer(inv.expira_at)
        const porVencer = dias <= 1

        return (
          <li
            key={inv.id}
            className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-surface p-4"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[0.68rem] font-bold text-ink-2 uppercase">
                  {etiquetaRol(inv.rol)}
                </span>
                {inv.asisteA && (
                  <span className="text-[0.8rem] text-ink-2">asiste a: {inv.asisteA}</span>
                )}
              </div>
              <p className="mt-1.5 text-[0.8rem] text-ink-3">
                Generada por {inv.creadaPor} el {formatearFecha(inv.created_at)}
              </p>
            </div>

            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-[0.72rem] font-semibold whitespace-nowrap ${
                porVencer ? 'bg-warm-soft text-badge-tibio-ink' : 'bg-surface-2 text-ink-3'
              }`}
            >
              {dias === 0
                ? 'Vence hoy'
                : dias === 1
                  ? 'Vence mañana'
                  : `Vence en ${dias} días`}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
