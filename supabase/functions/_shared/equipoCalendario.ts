/**
 * Quién es el dueño del calendario de Google y quién pertenece al equipo.
 *
 * Un ASISTENTE no tiene calendario propio: opera el de su agente
 * (`profiles.asiste_a`). Esto resuelve a cuál se empuja un cambio y decide si
 * el asistente puede hacerlo. Es lógica pura, sin base ni red, para poder
 * testear cada caso de rechazo; la lectura de los perfiles vive en la función.
 *
 * La validación se evalúa en CADA request y nunca se cachea: un asistente dado
 * de baja, o un agente desactivado, tiene que perder el acceso en el momento.
 */

export interface PerfilCalendario {
  id: string
  rol: string
  activo: boolean
  asiste_a: string | null
  inmobiliaria_id: string
}

/** El agente al que asiste un asistente: lo que hace falta para validarlo. */
export interface AgenteCalendario {
  id: string
  rol: string
  activo: boolean
  inmobiliaria_id: string
}

/** Por qué se rechaza. Va al log; al cliente le llega siempre un 403 genérico. */
export type MotivoRechazo =
  | 'perfil_inexistente'
  | 'asistente_inactivo'
  | 'asistente_sin_agente'
  | 'agente_inexistente'
  | 'agente_inactivo'
  | 'agente_es_asistente'
  | 'otra_inmobiliaria'

export type Resolucion =
  | { ok: true; duenoCalendario: string }
  | { ok: false; motivo: MotivoRechazo }

/**
 * El dueño del calendario sobre el que opera `usuario`.
 *
 *  - Dueño o agente: él mismo.
 *  - Asistente: su `asiste_a`, siempre que el asistente esté activo y el agente
 *    exista, esté activo, no sea a su vez un asistente y sea de la misma
 *    inmobiliaria. Cualquier otra cosa se rechaza.
 */
export function resolverDuenoCalendario(
  usuario: PerfilCalendario | null,
  agente: AgenteCalendario | null,
): Resolucion {
  if (!usuario) return { ok: false, motivo: 'perfil_inexistente' }
  if (usuario.rol !== 'ASISTENTE') return { ok: true, duenoCalendario: usuario.id }

  if (!usuario.activo) return { ok: false, motivo: 'asistente_inactivo' }
  if (!usuario.asiste_a) return { ok: false, motivo: 'asistente_sin_agente' }
  if (!agente || agente.id !== usuario.asiste_a) return { ok: false, motivo: 'agente_inexistente' }
  if (!agente.activo) return { ok: false, motivo: 'agente_inactivo' }
  if (agente.rol === 'ASISTENTE') return { ok: false, motivo: 'agente_es_asistente' }
  if (agente.inmobiliaria_id !== usuario.inmobiliaria_id) {
    return { ok: false, motivo: 'otra_inmobiliaria' }
  }

  return { ok: true, duenoCalendario: agente.id }
}

/** El dueño del calendario y sus asistentes, sin repetidos y con el dueño primero. */
export function armarEquipoIds(duenoCalendario: string, asistentesIds: readonly string[]): string[] {
  return [...new Set([duenoCalendario, ...asistentesIds])]
}

/** ¿Es del equipo? La creó o la tiene asignada alguien de él. */
export function perteneceAlEquipo(
  fila: { creado_por: string; asignado_a: string },
  equipoIds: readonly string[],
): boolean {
  return equipoIds.includes(fila.creado_por) || equipoIds.includes(fila.asignado_a)
}
