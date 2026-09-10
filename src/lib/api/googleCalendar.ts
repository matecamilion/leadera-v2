import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { mensajeDeFuncion } from './equipo'
import { interpretarErrorSupabase } from '../errores'

/**
 * Estado de la conexión del agente con Google Calendar.
 *
 * `null` en `useGoogleCalendar` significa "nunca conectó". `conectado: false`
 * es distinto: conectó alguna vez y el permiso dejó de servir —lo revocó desde
 * su cuenta de Google—, así que la UI le ofrece reconectar y no conectar.
 */
export interface ConexionGoogle {
  conectado: boolean
  /** Cuándo se guardó o refrescó el token por última vez. */
  actualizado: string | null
}

/** Fila de `google_calendar_tokens`, recortada a lo que puede ver el front. */
interface FilaConexion {
  conectado: boolean
  updated_at: string | null
}

/**
 * Lee si el agente tiene Google Calendar conectado.
 *
 * Selecciona `conectado` y `updated_at` y nada más: la policy de RLS deja leer
 * la fila entera del propio agente, pero los tokens no tienen por qué viajar al
 * navegador. Lo único que la UI necesita saber es si está conectado.
 *
 * La tabla todavía no está en `src/types/database.ts` —los tipos se regeneran
 * con `npx supabase gen types`—, así que la consulta va por el cliente sin
 * tipar, con la forma declarada arriba.
 */
export async function obtenerConexionGoogle(): Promise<ConexionGoogle | null> {
  const { data, error } = await (supabase as SupabaseClient)
    .from('google_calendar_tokens')
    .select('conectado, updated_at')
    .maybeSingle()

  if (error) {
    throw new Error(interpretarErrorSupabase(error, 'No se pudo leer la conexión con Google.'))
  }
  if (!data) return null

  const fila = data as FilaConexion
  return { conectado: fila.conectado, actualizado: fila.updated_at }
}

/**
 * Arranca el consentimiento: devuelve la URL de Google a la que hay que navegar.
 *
 * La Edge Function devuelve la URL en vez de redirigir porque `invoke` es un
 * fetch: un 302 lo seguiría el propio fetch y la respuesta terminaría siendo el
 * HTML de Google. La navegación la hace el llamador.
 */
export async function iniciarConexionGoogle(): Promise<string> {
  const { data, error } = await supabase.functions.invoke<{ url: string }>(
    'google-oauth-init',
    { body: {} },
  )

  if (error) {
    throw new Error(await mensajeDeFuncion(error, 'No se pudo conectar con Google.'))
  }
  if (!data?.url) throw new Error('Google no devolvió una URL de autorización.')

  return data.url
}

// ---------------------------------------------------------------------------
// Sincronización
// ---------------------------------------------------------------------------

export type TipoSync = 'tarea' | 'visita'
export type AccionSync = 'crear' | 'editar' | 'borrar'

export interface EntradaSync {
  tipo: TipoSync
  accion: AccionSync
  registro_id: string
  /**
   * Sólo para `borrar`. Para cuando el sync corre, la fila ya se borró de
   * Supabase —es un DELETE real— y el id del evento no se puede leer de ningún
   * lado, así que viaja desde acá. Lo devuelve el propio `eliminarTarea` /
   * `eliminarVisita` con un RETURNING.
   */
  google_event_id?: string | null
}

/**
 * Empuja el cambio a Google Calendar sin bloquear ni romper nada.
 *
 * Fire-and-forget deliberado: la tarea ya se guardó en Supabase, que es lo que
 * el agente pidió. Si Google no contesta, o el agente no conectó su cuenta, o
 * el token venció, eso no puede volverse un error en pantalla ni deshacer el
 * alta. Por eso no devuelve nada, no lanza, y el peor caso es una línea en la
 * consola.
 *
 * `not_connected` es el caso mayoritario y no se loguea: la mayoría de los
 * agentes no va a conectar Calendar y llenar la consola de eso sería ruido.
 */
export function sincronizarConGoogle(entrada: EntradaSync): void {
  // El try/catch envuelve al `invoke` además del `.catch` de la promesa: el
  // `.catch` sólo atrapa un rechazo, y si `invoke` llegara a lanzar de forma
  // sincrónica —parámetros mal armados, cliente sin inicializar— la excepción
  // subiría al `onSuccess` de la mutation y le rompería el alta al agente, que
  // es exactamente lo que este helper existe para evitar.
  try {
    void supabase.functions
      .invoke<{ synced: boolean; reason?: string }>('google-calendar-sync', { body: entrada })
      .then(({ data, error }) => {
        if (error) {
          console.warn('[google-calendar] no se pudo sincronizar', entrada, error)
          return
        }
        if (data && !data.synced && data.reason !== 'not_connected') {
          console.warn(`[google-calendar] sin sincronizar (${data.reason})`, entrada)
        }
      })
      .catch((err) => {
        console.warn('[google-calendar] no se pudo sincronizar', entrada, err)
      })
  } catch (err) {
    console.warn('[google-calendar] no se pudo sincronizar', entrada, err)
  }
}
