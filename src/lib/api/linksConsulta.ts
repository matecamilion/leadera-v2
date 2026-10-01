import { supabase } from '../supabase'
import type { Database } from '../../types/database'
import { interpretarErrorSupabase } from '../errores'

/**
 * El link público de consultas (`/c/:slug`) del agente.
 *
 * `mi_link_consulta` lo devuelve o lo crea: el general sin propiedad, o el de
 * una propiedad de la inmobiliaria. Para un asistente devuelve el del agente
 * al que asiste.
 *
 * Cambiar las preguntas o pausarlo lo puede hacer solo el agente dueño del
 * link (policy `links_consulta_update_propio`). Para cualquier otro, la RLS
 * deja el update sin filas y sin error: por eso se pide la fila de vuelta y se
 * trata el "no volvió nada" como falta de permiso.
 */

export type LinkConsulta = Database['public']['Tables']['links_consulta']['Row']
export type PreguntaOpcional = 'visita' | 'vender' | 'email'

export async function obtenerMiLink(propiedadId?: string): Promise<LinkConsulta> {
  const { data, error } = await supabase.rpc(
    'mi_link_consulta',
    propiedadId ? { p_propiedad_id: propiedadId } : {},
  )
  if (error) throw new Error(interpretarErrorSupabase(error, 'No se pudo obtener el link de consultas.'))
  if (!data) throw new Error('No se pudo obtener el link de consultas.')
  return data as LinkConsulta
}

async function actualizar(
  id: string,
  cambios: { preguntas_off?: PreguntaOpcional[]; activo?: boolean },
): Promise<LinkConsulta> {
  const { data, error } = await supabase
    .from('links_consulta')
    .update(cambios)
    .eq('id', id)
    .select('*')
    .maybeSingle()

  if (error) throw new Error(interpretarErrorSupabase(error, 'No se pudo guardar el cambio.'))
  if (!data) throw new Error('Este link lo maneja el agente al que pertenece.')
  return data
}

export function guardarPreguntas(id: string, preguntasOff: PreguntaOpcional[]): Promise<LinkConsulta> {
  return actualizar(id, { preguntas_off: preguntasOff })
}

export function cambiarActivo(id: string, activo: boolean): Promise<LinkConsulta> {
  return actualizar(id, { activo })
}
