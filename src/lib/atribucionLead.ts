import type { RolAgente } from './api/auth'

/**
 * De quién es un lead nuevo y quién lo lleva, según quién lo carga.
 *
 * `agente_id` es de quién es el lead (la cartera); `asignado_a`, quién lo
 * trabaja. Un asistente carga leads de su agente: `profiles.asiste_a` es el
 * agente y el asistente queda como quien lo lleva. Dueño y agente no asisten a
 * nadie (`asiste_a` es null), así que son las dos cosas a la vez.
 *
 * `asignadoA` es la elección del formulario y solo la respeta un dueño o un
 * agente: ellos pueden darle el lead a un asistente suyo. Un asistente no
 * asigna, así que se ignora y el lead queda con él.
 *
 * La base lo normaliza y valida igual con un trigger; mandarlo bien desde acá
 * hace que el front no dependa de él.
 */
export function atribucionDeAlta(
  perfil: { id: string; asiste_a: string | null; rol: RolAgente },
  asignadoA?: string,
): {
  agente_id: string
  asignado_a: string
} {
  const puedeAsignar = perfil.rol === 'DUENO' || perfil.rol === 'AGENTE'
  return {
    agente_id: perfil.asiste_a ?? perfil.id,
    asignado_a: puedeAsignar && asignadoA ? asignadoA : perfil.id,
  }
}
