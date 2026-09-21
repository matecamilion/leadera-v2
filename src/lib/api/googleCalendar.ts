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
  /**
   * Si el cron trae los eventos de Google a LeadEra (Fase 2).
   *
   * Aparte de `conectado`: conectar es el push LeadEra -> Google y lo tiene
   * cualquiera que conecte; esto es la dirección inversa y arranca apagada,
   * porque trae también la agenda personal del agente.
   */
  importacionActiva: boolean
}

/** Fila de `google_calendar_tokens`, recortada a lo que puede ver el front. */
interface FilaConexion {
  conectado: boolean
  updated_at: string | null
  importacion_activa: boolean
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
    .select('conectado, updated_at, importacion_activa')
    .maybeSingle()

  if (error) {
    throw new Error(interpretarErrorSupabase(error, 'No se pudo leer la conexión con Google.'))
  }
  if (!data) return null

  const fila = data as FilaConexion
  return {
    conectado: fila.conectado,
    actualizado: fila.updated_at,
    importacionActiva: fila.importacion_activa === true,
  }
}

/**
 * Prende o apaga la importación del calendario del agente.
 *
 * Es el único UPDATE que el cliente puede hacer sobre `google_calendar_tokens`:
 * el grant está acotado a esta columna y la policy, a la fila del agente (ver
 * la migración `..._google_calendar_importacion_toggle`). Un intento de tocar
 * cualquier otra columna desde acá lo rechaza la base, no este código.
 *
 * Devuelve el valor que quedó guardado y no el que se mandó: lo que muestra la
 * UI es lo que dice la base.
 *
 * Son dos viajes, y el segundo no es un lujo: el UPDATE se manda SIN pedir la
 * fila de vuelta porque PostgREST, para devolverla, hace un `RETURNING *` que
 * exige SELECT sobre TODAS las columnas, y el cliente sólo puede leer cuatro
 * (ver `..._google_calendar_tokens_select_acotado`). Pidiéndola, el update
 * entero falla con 42501 aunque el permiso de escritura esté bien. Así que se
 * escribe a ciegas y después se relee lo único que interesa.
 */
export async function actualizarImportacionActiva(activa: boolean): Promise<boolean> {
  const { data: userData, error: errorUser } = await supabase.auth.getUser()
  if (errorUser || !userData.user) throw new Error('Tu sesión expiró. Volvé a entrar.')

  const cliente = supabase as SupabaseClient

  // El filtro por agente es redundante con la policy, que ya acota a la fila
  // propia; va igual para que un cambio futuro en las policies no convierta
  // esto en un update masivo. Además, filtrar por `agente_id` exige poder
  // leer esa columna, que es parte del grant acotado.
  const { error } = await cliente
    .from('google_calendar_tokens')
    .update({ importacion_activa: activa })
    .eq('agente_id', userData.user.id)

  if (error) {
    throw new Error(interpretarErrorSupabase(error, 'No se pudo cambiar la importación.'))
  }

  const { data, error: errorLectura } = await cliente
    .from('google_calendar_tokens')
    .select('importacion_activa')
    .eq('agente_id', userData.user.id)
    .maybeSingle()

  if (errorLectura) {
    throw new Error(interpretarErrorSupabase(errorLectura, 'No se pudo leer la importación.'))
  }
  // Sin fila: o no conectó nunca, o RLS la tapa. Para el usuario es lo mismo.
  if (!data) throw new Error('No encontramos tu conexión con Google Calendar.')

  return (data as { importacion_activa: boolean }).importacion_activa === true
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

/**
 * Corta la conexión: revoca el permiso en Google y borra los tokens guardados.
 *
 * La Edge Function borra la fila entera en vez de bajar `conectado`, así que
 * después de esto `obtenerConexionGoogle` devuelve null —"nunca conectó"— y la
 * UI vuelve a ofrecer "Conectar" y no "Reconectar".
 *
 * No devuelve nada: al llamador sólo le importa si salió o no. Si Google no
 * acepta la revocación —el permiso ya estaba dado de baja desde la cuenta del
 * agente— la función igual limpia la base y esto resuelve bien, porque el
 * agente quedó desconectado, que es lo que pidió.
 */
export async function desconectarGoogle(): Promise<void> {
  const { error } = await supabase.functions.invoke('google-calendar-desconectar', {
    body: {},
  })

  if (error) {
    throw new Error(await mensajeDeFuncion(error, 'No se pudo desconectar Google Calendar.'))
  }
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
