/**
 * ¿Corresponde decir "no tenés leads asignados todavía"?
 *
 * Sí cuando se está mirando lo asignado (`mios`), no hay ninguno y el pool sí
 * tiene leads: ahí la lista vacía no es una cuenta vacía sino un asistente a
 * quien todavía no le asignaron nada, y hay que decirlo y ofrecer el pool.
 *
 * `hayLeadsEnElPool` es `undefined` mientras se averigua: sin la respuesta no
 * se dice nada, para no parpadear un mensaje que después se retira. Si el pool
 * también está vacío, la cuenta está vacía y le toca `EstadoSinLeads`.
 */
export function sinLeadsAsignados({
  mios,
  cantidadAsignados,
  hayLeadsEnElPool,
}: {
  mios: boolean
  cantidadAsignados: number | undefined
  hayLeadsEnElPool: boolean | undefined
}): boolean {
  return mios && cantidadAsignados === 0 && hayLeadsEnElPool === true
}
