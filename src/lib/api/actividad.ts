import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { etiquetaTipoInteraccion, type TipoInteraccion } from './interacciones'
import { etiquetaTipoOperacion, type TipoOperacion } from './operaciones'
import { interpretarErrorSupabase } from '../errores'

/** Qué clase de cosa pasó. Lo devuelve el RPC en crudo. */
export type TipoActividad =
  | 'INTERACCION'
  | 'TAREA_COMPLETADA'
  | 'VISITA_REALIZADA'
  | 'PROPIEDAD_CREADA'
  | 'OPERACION_CREADA'

/** A qué ficha lleva la fila, o null si el evento no cuelga de ninguna. */
export type EntidadActividad = 'LEAD' | 'OPERACION' | 'PROPIEDAD'

/** Una fila tal como sale de `obtener_actividad_reciente`. */
export interface ActividadReciente {
  tipo: TipoActividad
  /**
   * El enum crudo del evento, cuando lo tiene: `tipo_interaccion` para
   * INTERACCION y `tipo_operacion` para OPERACION_CREADA. El RPC no traduce
   * nada a texto: las etiquetas viven en TS y se aplican acá.
   */
  subtipo: string | null
  titulo: string
  descripcion: string | null
  fecha: string
  entidad_tipo: EntidadActividad | null
  entidad_id: string | null
  /** La fila que originó el evento. Sólo se usa como key de React. */
  origen_id: string
}

const RUTA: Record<EntidadActividad, string> = {
  LEAD: '/leads',
  OPERACION: '/operaciones',
  PROPIEDAD: '/propiedades',
}

/**
 * A dónde navega una fila, o null si no hay a dónde.
 *
 * Una tarea completada puede no colgar de ninguna entidad —es un pendiente
 * suelto del agente—; en ese caso la fila se muestra igual pero sin link, que
 * es preferible a esconderla del feed.
 */
export function rutaDeActividad(item: ActividadReciente): string | null {
  if (!item.entidad_tipo || !item.entidad_id) return null
  return `${RUTA[item.entidad_tipo]}/${item.entidad_id}`
}

/**
 * El texto del renglón principal, armado con las etiquetas que ya existen.
 *
 * Es la contracara de que el RPC devuelva enums crudos: el vocabulario visible
 * sale de `etiquetaTipoInteraccion` y `etiquetaTipoOperacion`, las mismas que
 * usan el timeline del lead y el listado de operaciones, así que agregar un
 * valor al enum se traduce en un solo lugar.
 */
export function tituloDeActividad(item: ActividadReciente): string {
  if (item.tipo === 'INTERACCION') {
    const que = item.subtipo
      ? etiquetaTipoInteraccion(item.subtipo as TipoInteraccion)
      : 'Interacción'
    return `${que} a ${item.titulo}`
  }

  // Mismo criterio que `FilaOperacion`: sin título propio, el tipo es lo único
  // que la describe.
  if (item.tipo === 'OPERACION_CREADA') {
    const tipo = item.subtipo ? etiquetaTipoOperacion(item.subtipo as TipoOperacion) : ''
    return item.titulo?.trim() || tipo || 'Operación'
  }

  return item.titulo
}

/**
 * Lo último que hizo el agente, de lo más reciente a lo más viejo.
 *
 * El orden y el recorte los hace el RPC sobre el union de las cinco fuentes:
 * traerlas por separado y mezclarlas acá obligaría a pedir `p_limite` filas de
 * cada tabla para quedarse con `p_limite` en total.
 */
export async function obtenerActividadReciente(
  limite: number,
): Promise<ActividadReciente[]> {
  // El RPC todavía no está en `src/types/database.ts`; los tipos se regeneran
  // con `npx supabase gen types`. Hasta entonces la llamada va por el cliente
  // sin tipar, con la forma declarada arriba.
  const { data, error } = await (supabase as SupabaseClient).rpc(
    'obtener_actividad_reciente',
    { p_limite: limite },
  )

  if (error) throw new Error(interpretarErrorSupabase(error, 'No se pudo cargar la actividad reciente.'))

  return (data ?? []) as ActividadReciente[]
}
