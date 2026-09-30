import { supabase } from '../supabase'
import { interpretarErrorSupabase } from '../errores'
import type { Database } from '../../types/database'

/**
 * Modelo de gestión: el flag por inmobiliaria y el resumen de la semana.
 *
 * Todo lo del modelo va detrás de `inmobiliarias.modelo_gestion_activo`, que
 * nace en false: ninguna cuenta ve nada hasta que se prende a mano.
 */

export type ResumenGestion =
  Database['public']['Functions']['resumen_gestion']['Returns'][number]

/**
 * Las ventanas que pide el front. La función SQL acepta además 'mes', que va a
 * ir en Estadísticas; `database.ts` tipa `p_periodo` como string suelto, así
 * que la unión se declara acá.
 */
export type PeriodoGestion = 'dia' | 'semana'

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
 * Las métricas del agente logueado en el día o la semana (miércoles a martes)
 * en curso, hora argentina. La ventana, `dia_actual` y los conteos los arma la
 * base; ver la migración `20260930120000_resumen_gestion_periodos`.
 *
 * No se manda `p_referencia`: "hoy" lo decide el reloj de la base, no el del
 * navegador, que puede estar corrido.
 */
export async function obtenerResumenGestion(periodo: PeriodoGestion): Promise<ResumenGestion> {
  const mensaje =
    periodo === 'dia' ? 'No se pudo cargar el resumen del día.' : 'No se pudo cargar el resumen de la semana.'

  const { data, error } = await supabase.rpc('resumen_gestion', { p_periodo: periodo })

  if (error) throw new Error(interpretarErrorSupabase(error, mensaje))

  const fila = data?.[0]
  if (!fila) throw new Error(mensaje)

  return fila
}
