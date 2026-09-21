import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { interpretarErrorSupabase } from '../errores'

/**
 * El opt-in del reporte semanal por email, en `profiles.reporte_semanal_activo`.
 *
 * Query propia y no un campo más del `profile` de `AuthContext`: ese se lee una
 * sola vez por sesión y lo consume media app, así que refrescarlo entero para
 * un booleano movería más de lo necesario. Acá el toggle tiene su propia
 * entrada de cache y se invalida sola.
 *
 * Las consultas van por el cliente sin tipar: la columna todavía no está en
 * `src/types/database.ts`, que se regenera con `npx supabase gen types`.
 *
 * Esto es sólo el interruptor. El envío del mail llega en la etapa siguiente.
 */
export async function obtenerReporteSemanal(): Promise<boolean> {
  const { data: userData, error: errorUser } = await supabase.auth.getUser()
  if (errorUser || !userData.user) throw new Error('Tu sesión expiró. Volvé a entrar.')

  const { data, error } = await (supabase as SupabaseClient)
    .from('profiles')
    .select('reporte_semanal_activo')
    .eq('id', userData.user.id)
    .maybeSingle()

  if (error) {
    throw new Error(interpretarErrorSupabase(error, 'No se pudo leer tu preferencia de reporte.'))
  }

  return (data as { reporte_semanal_activo: boolean } | null)?.reporte_semanal_activo === true
}

/**
 * Prende o apaga el reporte. Devuelve lo que quedó guardado, no lo que se pidió.
 *
 * El grant de UPDATE de `profiles` es por columna —sólo nombre, apellido, meta
 * y esta— y la policy `profiles_update_propio` acota a la fila del agente, así
 * que nadie puede cambiarse el rol ni la inmobiliaria por esta puerta.
 */
export async function actualizarReporteSemanal(activo: boolean): Promise<boolean> {
  const { data: userData, error: errorUser } = await supabase.auth.getUser()
  if (errorUser || !userData.user) throw new Error('Tu sesión expiró. Volvé a entrar.')

  const { data, error } = await (supabase as SupabaseClient)
    .from('profiles')
    .update({ reporte_semanal_activo: activo })
    .eq('id', userData.user.id)
    .select('reporte_semanal_activo')

  if (error) {
    throw new Error(interpretarErrorSupabase(error, 'No se pudo cambiar el reporte semanal.'))
  }
  // Un UPDATE que RLS bloquea vuelve 200 con lista vacía, no error. Mismo
  // chequeo que `actualizarMetaMensual`.
  const filas = data as { reporte_semanal_activo: boolean }[] | null
  if (!filas || filas.length === 0) {
    throw new Error('No tenés permiso para cambiar esta preferencia.')
  }

  return filas[0].reporte_semanal_activo === true
}
