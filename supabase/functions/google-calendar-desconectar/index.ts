/**
 * google-calendar-desconectar
 *
 * Corta la conexión del agente con Google Calendar: revoca el permiso del lado
 * de Google y BORRA la fila de tokens, no la marca como inactiva.
 *
 * Por qué borrar y no bajar `conectado`: esa bandera ya tiene un significado
 * tomado. `google-calendar-sync` la baja cuando Google rechaza el refresh_token,
 * y la UI lo lee como "conectaste y te revocaron el permiso, reconectá". Un
 * agente que se desconecta a propósito no está en ese estado: quiere volver a
 * cero. Borrando la fila, `obtenerConexionGoogle` devuelve null —"nunca
 * conectó"— y tanto el perfil como el banner del calendario vuelven a ofrecer
 * "Conectar", que es lo que pidió.
 *
 * Volver a conectar no pierde nada: `google-oauth-init` manda `prompt=consent`,
 * así que Google devuelve un refresh_token nuevo en la próxima autorización.
 *
 * Requiere sesión: se desconecta el calendario del agente del JWT y de nadie
 * más. El `agente_id` sale del token validado acá, nunca del body.
 *
 * Secretos: ninguno propio. SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY las
 * inyecta la plataforma.
 */
import { preflight } from '../_shared/cors.ts'
import { errorResponse, jsonResponse } from '../_shared/http.ts'
import { adminClient, bearerToken } from '../_shared/supabase.ts'
import { GOOGLE_REVOKE_URL } from '../_shared/google.ts'

const TIMEOUT_GOOGLE_MS = 15_000

interface FilaToken {
  id: string
  refresh_token: string | null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(req)
  if (req.method !== 'POST') {
    return errorResponse(req, 'Método no permitido', 405, 'METODO_NO_PERMITIDO')
  }

  try {
    const admin = adminClient()

    // --- 1. Autenticación -------------------------------------------------
    const token = bearerToken(req)
    if (!token) {
      return errorResponse(req, 'Falta el token de autenticación', 401, 'NO_AUTENTICADO')
    }

    const { data: userData, error: userError } = await admin.auth.getUser(token)
    if (userError || !userData?.user) {
      return errorResponse(req, 'Sesión inválida o expirada', 401, 'NO_AUTENTICADO')
    }
    const agenteId = userData.user.id

    // --- 2. ¿Hay algo que desconectar? ------------------------------------
    const { data: fila, error: errorLectura } = await admin
      .from('google_calendar_tokens')
      .select('id, refresh_token')
      .eq('agente_id', agenteId)
      .maybeSingle<FilaToken>()

    if (errorLectura) {
      console.error(
        `google-calendar-desconectar: no se pudo leer el token del agente ${agenteId}`,
        errorLectura,
      )
      return errorResponse(req, 'No se pudo leer la conexión con Google', 500, 'ERROR_INTERNO')
    }

    // No había fila: ya estaba desconectado. Es un éxito, no un error —el
    // agente pidió quedar sin conexión y está sin conexión—, así que un doble
    // click o un reintento no le tira un cartel rojo por algo que salió bien.
    if (!fila) return jsonResponse(req, { desconectado: true, revocado: false })

    // --- 3. Revocar del lado de Google ------------------------------------
    const revocado = fila.refresh_token ? await revocar(fila.refresh_token) : false

    // --- 4. Borrar local, pase lo que pase con Google ---------------------
    const { error: errorBorrado } = await admin
      .from('google_calendar_tokens')
      .delete()
      .eq('id', fila.id)

    // Esto sí es un error que tiene que ver el agente: si la fila sobrevive,
    // LeadEra sigue creyendo que está conectado y le va a seguir empujando
    // eventos a Google. Es el estado inconsistente que hay que evitar.
    if (errorBorrado) {
      console.error(
        `google-calendar-desconectar: no se pudo borrar el token del agente ${agenteId}`,
        errorBorrado,
      )
      return errorResponse(req, 'No se pudo borrar la conexión con Google', 500, 'ERROR_INTERNO')
    }

    return jsonResponse(req, { desconectado: true, revocado })
  } catch (err) {
    console.error('google-calendar-desconectar: error inesperado', err)
    return errorResponse(req, 'Error interno del servidor', 500, 'ERROR_INTERNO')
  }
})

/**
 * Revoca el permiso en Google. true si Google lo dio de baja.
 *
 * Se manda el refresh_token y no el access_token porque lo que se revoca es la
 * CONCESIÓN entera: Google invalida el grant y con él los access_tokens que
 * salieron de ese grant. Al revés no alcanzaría —matar un access_token deja
 * vivo el refresh_token, y LeadEra podría seguir sacando tokens nuevos—.
 *
 * El token viaja en el body y no en la query string, aunque el ejemplo de la
 * doc de Google lo muestre en la URL: una credencial en una URL termina en los
 * logs de cualquier proxy o intermediario del camino. RFC 7009 define el body
 * como la forma estándar del endpoint de revocación y Google lo acepta igual.
 *
 * Un fallo acá NO aborta la desconexión, y es a propósito. El caso más común es
 * que el token ya estuviera revocado del lado de Google —el agente le sacó el
 * acceso a LeadEra desde su cuenta—: ahí Google contesta 400 y dejar la fila en
 * la base sería justamente dejar a LeadEra creyendo que sigue conectado. El
 * access_token que pudiera quedar vivo dura menos de una hora y, sin
 * refresh_token guardado, no hay forma de renovarlo.
 */
async function revocar(refreshToken: string): Promise<boolean> {
  let respuesta: Response
  try {
    respuesta = await fetch(GOOGLE_REVOKE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: refreshToken }),
      signal: AbortSignal.timeout(TIMEOUT_GOOGLE_MS),
    })
  } catch (err) {
    console.error(
      'google-calendar-desconectar: no se pudo contactar a Google para revocar',
      err,
    )
    return false
  }

  if (!respuesta.ok) {
    // El cuerpo de error de Google trae `error` y `error_description`, sin
    // secretos. Se trunca igual, mismo criterio que en el resto de las funciones.
    console.error(
      `google-calendar-desconectar: Google respondió ${respuesta.status} al revocar: ` +
        (await respuesta.text()).slice(0, 500),
    )
    return false
  }

  return true
}
