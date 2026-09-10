/**
 * google-oauth-init
 *
 * Arma la URL de consentimiento de Google Calendar para el agente logueado.
 *
 * Devuelve la URL en JSON en vez de redirigir: la llama `functions.invoke`
 * desde el frontend, que es un fetch —un 302 ahí lo seguiría el fetch y la
 * respuesta terminaría siendo el HTML de Google, no una navegación del usuario—.
 * Redirigir al agente es trabajo del frontend con la URL que devuelve esto.
 *
 * Requiere sesión: el `agente_id` que queda firmado en el `state` sale del JWT
 * validado acá, nunca del body. Es lo que hace que el callback pueda confiar en
 * a quién le está guardando el token.
 *
 * Secretos: GOOGLE_CLIENT_ID. SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY las
 * inyecta la plataforma.
 */
import { preflight } from '../_shared/cors.ts'
import { errorResponse, jsonResponse } from '../_shared/http.ts'
import { adminClient, bearerToken } from '../_shared/supabase.ts'
import { GOOGLE_AUTH_URL, GOOGLE_SCOPE, firmarState, redirectUri } from '../_shared/google.ts'

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

    // --- 2. Config --------------------------------------------------------
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
    if (!clientId) {
      return errorResponse(
        req,
        'Falta el secreto GOOGLE_CLIENT_ID. Configuralo con `supabase secrets set GOOGLE_CLIENT_ID=...` ' +
          'antes de conectar Google Calendar.',
        500,
        'GOOGLE_NO_CONFIGURADO',
      )
    }

    // --- 3. URL de consentimiento ----------------------------------------
    const parametros = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri(),
      response_type: 'code',
      scope: GOOGLE_SCOPE,
      // Sin `offline` Google manda un access_token de una hora y ningún
      // refresh_token, y la sincronización dejaría de andar sola al rato.
      access_type: 'offline',
      // Google devuelve el refresh_token UNA sola vez, en la primera
      // autorización. Un agente que ya autorizó antes —y después se
      // desconectó— volvería sin refresh_token y quedaría con una conexión que
      // se muere en una hora. `consent` fuerza la pantalla siempre, y con ella
      // el refresh_token.
      prompt: 'consent',
      // Que Google incluya los scopes concedidos en la respuesta: el callback
      // los guarda en la columna `scope` para saber después qué se autorizó.
      include_granted_scopes: 'true',
      state: await firmarState(userData.user.id),
    })

    return jsonResponse(req, { url: `${GOOGLE_AUTH_URL}?${parametros.toString()}` })
  } catch (err) {
    console.error('google-oauth-init: error inesperado', err)
    return errorResponse(req, 'Error interno del servidor', 500, 'ERROR_INTERNO')
  }
})
