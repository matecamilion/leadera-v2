import { useAuth } from '../../contexts/AuthContext'
import { useEquipo } from '../../hooks/useEquipo'
import { useAsignarLead, useNombreAgente } from '../../hooks/useLead'
import type { Lead } from '../../lib/api/leads'
import { etiquetaRol } from '../../lib/api/equipo'
import { opcionesDeAsignacion } from '../../lib/opcionesAsignacion'
import { MenuDesplegable } from '../comunes/MenuDesplegable'
import { IconoCheck, IconoUsuarios } from './Iconos'

/**
 * "Asignado a" de la ficha: quién lleva el lead.
 *
 * Dueño y agente lo cambian desde un menú con el agente del lead y sus
 * asistentes activos. El asistente solo lo ve (la regla real es de la base;
 * esto solo evita ofrecerle algo que no puede hacer). Si no hay a quién
 * reasignar —una cuenta sin asistentes— también queda en texto.
 *
 * Debajo, "Cartera de {agente}" solo cuando el lead es de un agente y lo
 * trabaja otro: `agente_id` es de quién es el lead, `asignado_a` quién lo lleva.
 */
export function AsignadoA({ lead }: { lead: Lead }) {
  const { profile } = useAuth()
  const rol = profile?.rol
  const puedeAsignar = rol === 'DUENO' || rol === 'AGENTE'

  const asignado = useNombreAgente(lead.asignado_a)
  const agente = useNombreAgente(lead.agente_id)
  // Un asistente no gestiona equipo: no se le pide la lista.
  const equipo = useEquipo(puedeAsignar ? rol : undefined, profile?.id)
  const asignar = useAsignarLead(lead.id)

  const opciones = puedeAsignar
    ? opcionesDeAsignacion({
        agenteId: lead.agente_id,
        agenteNombre: agente.data,
        miembros: equipo.data ?? [],
      })
    : []
  const hayAQuienAsignar = opciones.length > 1

  const nombre = asignado.data
  // Quien no puede cambiarlo y no tiene el nombre (la RLS puede no dejarle
  // leer el perfil de otro miembro) no ve la fila: ocultar-si-no-hay.
  if (!nombre && !hayAQuienAsignar) return null

  const etiqueta = nombre ?? 'otro miembro'
  const mostrarCartera = lead.agente_id !== lead.asignado_a && !!agente.data

  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-center gap-1.5 text-[0.82rem] text-ink-3">
        <IconoUsuarios className="size-4 shrink-0" />
        {hayAQuienAsignar ? (
          <MenuDesplegable
            etiqueta={`Asignado a ${etiqueta}. Cambiar a quién está asignado`}
            claseBoton={`inline-flex min-w-0 items-center gap-1 rounded-sm text-left text-[0.82rem] text-ink-3 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
              asignar.isPending ? 'opacity-60' : ''
            }`}
            boton={
              <>
                <span className="truncate">Asignado a {etiqueta}</span>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                  className="shrink-0"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </>
            }
            items={opciones.map((o) => ({
              label: o.rol ? `${o.nombre} · ${etiquetaRol(o.rol)}` : o.nombre,
              icono:
                o.id === lead.asignado_a ? (
                  <IconoCheck className="size-4 text-primary" />
                ) : (
                  <span aria-hidden className="size-4" />
                ),
              // El actual no se vuelve a guardar, y una asignación a la vez.
              onSelect: () => {
                if (!asignar.isPending && o.id !== lead.asignado_a) asignar.mutate(o.id)
              },
            }))}
          />
        ) : (
          <span className="truncate">Asignado a {etiqueta}</span>
        )}
      </div>

      {mostrarCartera && (
        <p className="m-0 ml-[1.375rem] text-[0.74rem] text-ink-3">Cartera de {agente.data}</p>
      )}

      {asignar.isError && (
        <p role="alert" className="m-0 ml-[1.375rem] mt-1 text-[0.78rem] font-semibold text-peligro-ink">
          {asignar.error.message}
        </p>
      )}
    </div>
  )
}
