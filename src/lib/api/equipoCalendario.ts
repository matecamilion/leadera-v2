import { supabase } from '../supabase'
import { interpretarErrorSupabase } from '../errores'

/**
 * Ids de los asistentes de un agente (o de un dueño que hace de agente), de su
 * misma inmobiliaria.
 *
 * Incluye a los inactivos a propósito: lo que cargó un asistente antes de darse
 * de baja sigue siendo del calendario del equipo, y la base (`mi_equipo_ids()`)
 * lo cuenta igual. El filtro por inmobiliaria es redundante con la RLS; va para
 * que la consulta no dependa de ella.
 */
export async function listarIdsAsistentesDe(
  duenoCalendario: string,
  inmobiliariaId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('asiste_a', duenoCalendario)
    .eq('inmobiliaria_id', inmobiliariaId)

  if (error) {
    throw new Error(interpretarErrorSupabase(error, 'No se pudo cargar el equipo del calendario.'))
  }
  return (data ?? []).map((f) => f.id)
}
