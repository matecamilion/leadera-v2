/**
 * De quién es un lead nuevo y quién lo lleva, según quién lo carga.
 *
 * `agente_id` es de quién es el lead (la cartera); `asignado_a`, quién lo
 * trabaja. Un asistente carga leads de su agente: `profiles.asiste_a` es el
 * agente y el asistente queda como quien lo lleva. Dueño y agente no asisten a
 * nadie (`asiste_a` es null), así que son las dos cosas a la vez.
 *
 * La base lo normaliza igual con un trigger; mandarlo bien desde acá hace que
 * el front no dependa de él.
 */
export function atribucionDeAlta(perfil: { id: string; asiste_a: string | null }): {
  agente_id: string
  asignado_a: string
} {
  return { agente_id: perfil.asiste_a ?? perfil.id, asignado_a: perfil.id }
}
