import type { Miembro, RolAgente } from './api/equipo'

/** A quién se le puede asignar un lead, ya listo para mostrar. */
export interface OpcionAsignacion {
  id: string
  nombre: string
  /** `null` si no se sabe (el agente dueño cuando quien mira no lo tiene en su lista). */
  rol: RolAgente | null
}

type MiembroParaOpciones = Pick<Miembro, 'id' | 'nombre' | 'apellido' | 'rol' | 'activo' | 'asisteA'>

/** "Nombre Apellido" sin espacios de más; `null` si no hay nada que mostrar. */
export function nombreAsignado(
  perfil: { nombre: string; apellido?: string | null } | null | undefined,
): string | null {
  if (!perfil) return null
  return `${perfil.nombre} ${perfil.apellido ?? ''}`.trim() || null
}

/**
 * Las opciones del selector "Asignado a": el agente dueño del lead y los
 * asistentes ACTIVOS de ese agente. Nadie más: ni asistentes inactivos ni los
 * de otro agente. Es la misma regla que valida el trigger de la base; esto solo
 * decide qué se ofrece.
 *
 * El agente va primero y siempre, aunque quien mira no lo tenga en su lista de
 * miembros (un agente solo ve a sus asistentes): en ese caso se usa
 * `agenteNombre`.
 */
export function opcionesDeAsignacion({
  agenteId,
  agenteNombre,
  miembros,
}: {
  agenteId: string | null
  agenteNombre: string | null | undefined
  miembros: MiembroParaOpciones[]
}): OpcionAsignacion[] {
  if (!agenteId) return []

  const delAgente = miembros.find((m) => m.id === agenteId)
  const opciones: OpcionAsignacion[] = [
    {
      id: agenteId,
      nombre: delAgente ? (nombreAsignado(delAgente) ?? 'Agente') : (agenteNombre ?? 'Agente'),
      rol: delAgente?.rol ?? null,
    },
  ]

  const asistentes = miembros
    .filter((m) => m.rol === 'ASISTENTE' && m.activo && m.asisteA?.id === agenteId)
    .map((m) => ({ id: m.id, nombre: nombreAsignado(m) ?? 'Asistente', rol: m.rol }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre))

  return [...opciones, ...asistentes]
}
