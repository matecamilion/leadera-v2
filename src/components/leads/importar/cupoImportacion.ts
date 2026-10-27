import type { CupoDeLeads } from '../../../lib/api/importarLeads'

export interface EntradaSegunCupo {
  /** Cuántos entran. Sin tope, todos. */
  entran: number
  /** Cuántos quedan afuera por el límite del plan. */
  quedanAfuera: number
  /** Lugares que quedan en el plan; null si no hay tope. */
  lugares: number | null
  /** Hay tope y no queda ni un lugar. */
  agotado: boolean
}

/**
 * Cuántos de los `aImportar` caben en el plan.
 *
 * Sin tope (`limite` null) entra todo. Con tope, entran los primeros `lugares`:
 * es el orden en que la base los va aceptando.
 */
export function entradaSegunCupo(aImportar: number, cupo: CupoDeLeads): EntradaSegunCupo {
  if (cupo.limite === null) {
    return { entran: aImportar, quedanAfuera: 0, lugares: null, agotado: false }
  }
  const lugares = Math.max(0, cupo.limite - cupo.usados)
  const entran = Math.min(aImportar, lugares)
  return { entran, quedanAfuera: aImportar - entran, lugares, agotado: lugares <= 0 }
}
