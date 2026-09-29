import { supabase } from '../supabase'
import { interpretarErrorSupabase } from '../errores'
import type { Database } from '../../types/database'

/**
 * Modelo de gestión: el flag por inmobiliaria y el resumen de la semana.
 *
 * Todo lo del modelo va detrás de `inmobiliarias.modelo_gestion_activo`, que
 * nace en false: ninguna cuenta ve nada hasta que se prende a mano.
 */

export type ResumenSemanaGestion =
  Database['public']['Functions']['resumen_semana_gestion']['Returns'][number]

/**
 * Si la inmobiliaria tiene el modelo de gestión prendido.
 *
 * Filtra por id y no confía en que la RLS devuelva una sola fila: el
 * superadmin ve todas las inmobiliarias, y un `maybeSingle()` sin filtro le
 * daría error por filas de más.
 *
 * Nunca tira: ante un error o sin fila devuelve false. Es un flag de una
 * funcionalidad opcional, y que no se pueda leer no puede romper Mi día.
 */
export async function obtenerModeloGestionActivo(inmobiliariaId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('inmobiliarias')
    .select('modelo_gestion_activo')
    .eq('id', inmobiliariaId)
    .maybeSingle()

  if (error) {
    console.error('No se pudo leer el flag del modelo de gestión', error)
    return false
  }

  return data?.modelo_gestion_activo === true
}

/**
 * Las métricas de la semana en curso (miércoles a martes, hora argentina) del
 * agente logueado. La semana y los conteos los arma la base; ver la migración
 * `20260929120000_modelo_gestion_etapa1`.
 */
export async function obtenerResumenSemanaGestion(): Promise<ResumenSemanaGestion> {
  const { data, error } = await supabase.rpc('resumen_semana_gestion')

  if (error) {
    throw new Error(interpretarErrorSupabase(error, 'No se pudo cargar el resumen de la semana.'))
  }

  const fila = data?.[0]
  if (!fila) throw new Error('No se pudo cargar el resumen de la semana.')

  return fila
}
