import type { RolAgente } from './api/auth'
import { agenteDeAtribucion } from './atribucionLead'

/**
 * El equipo que comparte un calendario: el agente (o dueño que hace de agente)
 * y los asistentes que lo asisten.
 *
 * Un asistente no tiene calendario propio: opera el de su agente. Por eso el
 * calendario, la atribución y los permisos de las tarjetas se miden contra el
 * equipo y no contra el usuario logueado. Es el mismo conjunto que usa la base
 * (`private.mi_equipo_ids()`, `coalesce(asiste_a, id)`), así que lo que el
 * cliente pide es lo que la RLS deja ver.
 */
export interface EquipoCalendario {
  /** El agente (o dueño) cuyo calendario es. Para un asistente, `asiste_a`. */
  duenoCalendario: string
  /** El dueño del calendario y sus asistentes, sin repetidos; el dueño primero. */
  equipoIds: string[]
}

/**
 * Arma el equipo a partir del perfil y de los ids de quienes asisten al agente.
 *
 * Siempre incluye al dueño del calendario y al propio usuario, aunque
 * `asistentesIds` venga vacío o incompleto (una lectura de `profiles` que la RLS
 * recorta): peor caso, el usuario ve lo suyo y lo del agente, que es lo que
 * recibe todo lo que cargue cualquier asistente.
 *
 * Un dueño o agente sin asistentes queda con `equipoIds = [su id]`, o sea, el
 * comportamiento de antes.
 */
export function armarEquipoCalendario(
  perfil: { id: string; asiste_a: string | null },
  asistentesIds: readonly string[],
): EquipoCalendario {
  const duenoCalendario = agenteDeAtribucion(perfil)
  const equipoIds = [...new Set([duenoCalendario, perfil.id, ...asistentesIds])]
  return { duenoCalendario, equipoIds }
}

/**
 * A quién queda asignada una tarea o visita nueva.
 *
 * Un asistente no tiene calendario propio: lo que carga queda a nombre de su
 * agente, sin importar lo que mande el formulario. `creado_por` no pasa por acá
 * y sigue siendo el usuario real. Dueño y agente respetan la elección
 * (`pedido`) y, sin ella, quedan para sí mismos.
 */
export function asignadoDeAlta(
  perfil: { id: string; asiste_a: string | null; rol: RolAgente },
  pedido?: string | null,
): string {
  if (perfil.rol === 'ASISTENTE') return agenteDeAtribucion(perfil)
  return pedido || perfil.id
}

/** ¿Es de alguien del equipo? Para tareas y visitas: lo creó o lo tiene asignado. */
export function esDelEquipo(
  fila: { creado_por: string; asignado_a: string },
  equipoIds: readonly string[],
): boolean {
  return equipoIds.includes(fila.creado_por) || equipoIds.includes(fila.asignado_a)
}

/**
 * Identidad estable del equipo para las claves de React Query: dos usuarios del
 * mismo equipo comparten el mismo conjunto, pero un equipo que crece (entra un
 * asistente) cambia de clave y no sirve datos de la composición anterior.
 */
export function claveDeEquipo(equipo: EquipoCalendario): string {
  return `${equipo.duenoCalendario}:${[...equipo.equipoIds].sort().join(',')}`
}
