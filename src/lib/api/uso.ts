import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { ESTADOS_BLOQUEADOS } from './operaciones'
import type { Plan } from './suscripcion'
import { interpretarErrorSupabase } from '../errores'

/**
 * Cuánto de su plan está usando la inmobiliaria.
 *
 * Existe el RPC `uso_recursos_inmobiliaria()`, que sería el lugar natural para
 * esto, pero hoy no se puede llamar desde el cliente: devuelve "permission
 * denied for schema private" para el rol `authenticated`. Mientras tanto los
 * conteos se hacen acá con `count: 'exact'`, que es lo mismo que ya hace
 * `obtenerCupo` para el cupo de usuarios y da los mismos números —la RLS acota
 * cada tabla a la inmobiliaria de quien pregunta—. Cuando el RPC quede
 * invocable, `contarRecursos` es lo único que hay que reemplazar.
 */

/**
 * Un recurso y su tope.
 *
 * Se modela igual que `CupoEquipo`, y por el mismo motivo: `limite: null` tapa
 * dos situaciones que no significan lo mismo, y `sinTope` es lo que las separa.
 *
 *  - `limite: null, sinTope: true`  → el plan no tiene tope (Agencia Grande).
 *  - `limite: null, sinTope: false` → no se sabe cuál es el tope, porque no hay
 *    plan asociado o no se pudo leer la fila de límites.
 *
 * Tratar el null como 0 haría que la pantalla anunciara "sin lugar" justo en el
 * plan que no tiene ninguno.
 */
export interface UsoDeRecurso {
  usados: number
  limite: number | null
  sinTope: boolean
}

export interface UsoDeRecursos {
  leads: UsoDeRecurso
  propiedades: UsoDeRecurso
  operacionesActivas: UsoDeRecurso
}

interface LimitesDelPlan {
  limite_leads: number | null
  limite_propiedades: number | null
  limite_operaciones_activas: number | null
}

/** Los tres conteos de la inmobiliaria del usuario logueado. */
async function contarRecursos() {
  const contar = (tabla: 'leads' | 'propiedades') =>
    supabase.from(tabla).select('id', { count: 'exact', head: true })

  const [leads, propiedades, operaciones] = await Promise.all([
    contar('leads'),
    contar('propiedades'),
    // "Activa" es lo que no está cerrado. La lista sale de `operaciones.ts` en
    // lugar de repetirse acá: si mañana se agrega un estado terminal, el tablero
    // y este indicador no pueden opinar distinto sobre qué sigue abierto.
    supabase
      .from('operaciones')
      .select('id', { count: 'exact', head: true })
      .not('estado', 'in', `(${ESTADOS_BLOQUEADOS.join(',')})`),
  ])

  const fallo = leads.error ?? propiedades.error ?? operaciones.error
  if (fallo) throw new Error(interpretarErrorSupabase(fallo, 'No se pudo leer el uso del plan.'))

  return {
    leads: leads.count ?? 0,
    propiedades: propiedades.count ?? 0,
    operacionesActivas: operaciones.count ?? 0,
  }
}

/**
 * Los topes del plan, o null si no se pudieron establecer.
 *
 * Devuelve null —"no sé"— y no una fila de ceros cuando la inmobiliaria todavía
 * no tiene plan asociado: sin plan no hay tope que mostrar, pero tampoco hay
 * uno de cero.
 */
async function obtenerLimites(plan: Plan | null): Promise<LimitesDelPlan | null> {
  if (!plan) return null

  // `planes_limites_recursos` todavía no está en `src/types/database.ts`; los
  // tipos se regeneran con `npx supabase gen types`. Hasta entonces la consulta
  // va por el cliente sin tipar, con la forma declarada arriba.
  const { data, error } = await (supabase as SupabaseClient)
    .from('planes_limites_recursos')
    .select('limite_leads, limite_propiedades, limite_operaciones_activas')
    .eq('plan', plan)
    .maybeSingle<LimitesDelPlan>()

  if (error) {
    console.error('No se pudieron leer los límites del plan', error)
    return null
  }

  return data
}

/** Une un conteo con su tope. */
function combinar(usados: number, limite: number | null, hayLimites: boolean): UsoDeRecurso {
  return {
    usados,
    limite,
    sinTope: hayLimites && limite === null,
  }
}

export async function obtenerUsoRecursos(plan: Plan | null): Promise<UsoDeRecursos> {
  const [conteos, limites] = await Promise.all([contarRecursos(), obtenerLimites(plan)])

  const hay = limites !== null

  return {
    leads: combinar(conteos.leads, limites?.limite_leads ?? null, hay),
    propiedades: combinar(conteos.propiedades, limites?.limite_propiedades ?? null, hay),
    operacionesActivas: combinar(
      conteos.operacionesActivas,
      limites?.limite_operaciones_activas ?? null,
      hay,
    ),
  }
}
