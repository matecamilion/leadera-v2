import { etiquetaRol, type Miembro, type RolAgente } from '../../lib/api/equipo'
import { EmailLink } from '../comunes/AccionesContacto'

/** Color del badge según el rol. Clases literales: Tailwind escanea el fuente. */
const COLOR_ROL: Record<RolAgente, string> = {
  DUENO: 'bg-brand-soft text-primary-dark',
  AGENTE: 'bg-cool-soft text-frio',
  ASISTENTE: 'bg-surface-2 text-ink-3',
}

interface TablaMiembrosProps {
  miembros: Miembro[]
  /** Sólo el dueño ve los botones de activar/desactivar. */
  puedeGestionar: boolean
  /** Para no ofrecer desactivarse a uno mismo. */
  miId: string
  cambiandoId: string | null
  onToggleActivo: (miembro: Miembro) => void
}

export function TablaMiembros({
  miembros,
  puedeGestionar,
  miId,
  cambiandoId,
  onToggleActivo,
}: TablaMiembrosProps) {
  if (miembros.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-surface-2 px-4 py-10 text-center text-[0.88rem] text-ink-3">
        Todavía no hay nadie más en tu equipo. Invitá a alguien con el botón de arriba.
      </p>
    )
  }

  return (
    <>
      {/* Escritorio: tabla */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-[0.88rem]">
          <thead>
            <tr className="border-b border-border text-left">
              <Th>Miembro</Th>
              <Th>Email</Th>
              <Th>Rol</Th>
              <Th alineado="derecha">Leads activos</Th>
              <Th>Estado</Th>
              {puedeGestionar && <Th> </Th>}
            </tr>
          </thead>
          <tbody>
            {miembros.map((m) => (
              <tr
                key={m.id}
                className={`border-b border-border last:border-0 ${m.activo ? '' : 'opacity-60'}`}
              >
                <td className="py-3 pr-3">
                  <span className="font-semibold text-ink">
                    {m.nombre} {m.apellido}
                  </span>
                  {m.asisteA && (
                    <span className="mt-0.5 block text-[0.78rem] text-ink-3">
                      asiste a: {m.asisteA.nombre}
                    </span>
                  )}
                </td>
                <td className="py-3 pr-3 text-ink-2">
                  <EmailLink email={m.email} />
                </td>
                <td className="py-3 pr-3">
                  <BadgeRol rol={m.rol} />
                </td>
                <td className="py-3 pr-3 text-right font-semibold text-ink tabular-nums">
                  {m.leadsActivos}
                </td>
                <td className="py-3 pr-3">
                  <BadgeActivo activo={m.activo} />
                </td>
                {puedeGestionar && (
                  <td className="py-3 text-right">
                    <BotonToggle
                      miembro={m}
                      miId={miId}
                      cambiando={cambiandoId === m.id}
                      onToggle={onToggleActivo}
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: cards */}
      <ul className="flex flex-col gap-3 md:hidden">
        {miembros.map((m) => (
          <li
            key={m.id}
            className={`rounded-xl border border-border bg-surface p-4 ${m.activo ? '' : 'opacity-60'}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="m-0 font-semibold text-ink">
                  {m.nombre} {m.apellido}
                </p>
                <p className="mt-0.5 truncate text-[0.8rem] text-ink-3">
                  <EmailLink email={m.email} />
                </p>
                {m.asisteA && (
                  <p className="mt-0.5 text-[0.78rem] text-ink-3">
                    asiste a: {m.asisteA.nombre}
                  </p>
                )}
              </div>
              <BadgeRol rol={m.rol} />
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[0.8rem] text-ink-2">
                <b className="text-ink tabular-nums">{m.leadsActivos}</b> leads activos
              </span>
              <div className="flex items-center gap-2">
                <BadgeActivo activo={m.activo} />
                {puedeGestionar && (
                  <BotonToggle
                    miembro={m}
                    miId={miId}
                    cambiando={cambiandoId === m.id}
                    onToggle={onToggleActivo}
                  />
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}

function Th({
  children,
  alineado = 'izquierda',
}: {
  children: React.ReactNode
  alineado?: 'izquierda' | 'derecha'
}) {
  return (
    <th
      className={`py-2.5 pr-3 text-xs font-semibold text-ink-3 uppercase ${alineado === 'derecha' ? 'text-right' : ''}`}
    >
      {children}
    </th>
  )
}

function BadgeRol({ rol }: { rol: RolAgente }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-1 text-[0.68rem] font-bold uppercase ${COLOR_ROL[rol]}`}
    >
      {etiquetaRol(rol)}
    </span>
  )
}

function BadgeActivo({ activo }: { activo: boolean }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-1 text-[0.68rem] font-bold uppercase ${
        activo ? 'bg-badge-ganado-bg text-primary-dark' : 'bg-surface-2 text-ink-3'
      }`}
    >
      {activo ? 'Activo' : 'Inactivo'}
    </span>
  )
}

/**
 * Nunca sobre uno mismo ni sobre otro dueño: en el primer caso el usuario se
 * dejaría afuera de su propia cuenta, y en el segundo el server lo rechaza
 * igual, así que mejor no ofrecer el botón.
 */
function BotonToggle({
  miembro,
  miId,
  cambiando,
  onToggle,
}: {
  miembro: Miembro
  miId: string
  cambiando: boolean
  onToggle: (m: Miembro) => void
}) {
  if (miembro.rol === 'DUENO' || miembro.id === miId) return null

  return (
    <button
      type="button"
      onClick={() => onToggle(miembro)}
      disabled={cambiando}
      className={[
        'rounded-lg border px-3 py-1.5 text-[0.78rem] font-semibold whitespace-nowrap',
        'transition-colors disabled:opacity-60 motion-reduce:transition-none',
        miembro.activo
          ? 'border-peligro-borde text-peligro-ink hover:bg-peligro-soft'
          : 'border-border text-primary hover:bg-brand-softer',
      ].join(' ')}
    >
      {cambiando ? '…' : miembro.activo ? 'Desactivar' : 'Activar'}
    </button>
  )
}
