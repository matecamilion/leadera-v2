import type { Database } from '../types/database'

type Perfil = Pick<Database['public']['Tables']['profiles']['Row'], 'id' | 'rol' | 'asiste_a'>
type Propiedad = Pick<Database['public']['Tables']['propiedades']['Row'], 'agente_id'>

/** Por qué no puede: la propiedad no tiene agente, o es de otro. */
export type MotivoSinPermiso = 'sin_agente' | 'otro_agente'

export type PermisoEdicion = { puede: true } | { puede: false; motivo: MotivoSinPermiso }

/**
 * ¿Puede este perfil editar la propiedad? Las mismas reglas que la policy
 * `propiedades_update`:
 *
 *  - el DUENO de la inmobiliaria, siempre;
 *  - el agente de la propiedad (`agente_id = id`);
 *  - el ASISTENTE cuyo agente es el `agente_id` de la propiedad.
 *
 * Una propiedad sin agente la ve cualquiera de la inmobiliaria, pero sólo la
 * edita el DUENO.
 *
 * Es una puerta de UI para no ofrecer lo que la base va a rechazar: subir una
 * foto escribe primero en el bucket (que no mira al agente) y recién después en
 * la propiedad, y un rechazo ahí deja el archivo huérfano.
 */
export function puedeEditarPropiedad(perfil: Perfil, propiedad: Propiedad): PermisoEdicion {
  if (perfil.rol === 'DUENO') return { puede: true }
  if (propiedad.agente_id === null) return { puede: false, motivo: 'sin_agente' }
  if (propiedad.agente_id === perfil.id) return { puede: true }
  if (perfil.rol === 'ASISTENTE' && propiedad.agente_id === perfil.asiste_a) {
    return { puede: true }
  }
  return { puede: false, motivo: 'otro_agente' }
}

export const TEXTO_SIN_PERMISO: Record<MotivoSinPermiso, string> = {
  sin_agente: 'Pedile al dueño que te asigne la propiedad para cargar fotos',
  otro_agente: 'Solo la puede editar su agente asignado o el dueño',
}
