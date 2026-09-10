/**
 * google-oauth-callback
 *
 * Recibe el redirect de Google después del consentimiento, canjea el `code` por
 * tokens y los guarda contra el agente que arrancó el flujo.
 *
 * A este endpoint lo abre el NAVEGADOR del agente siguiendo un 302 de Google,
 * no un fetch de LeadEra: igual que `webhook-mercadopago`, acá no se usa
 * `_shared/cors.ts` —no hay preflight que responder ni origen que permitir— y
 * va con `verify_jwt = false`, porque un redirect no puede llevar el header
 * Authorization. Quien autoriza es la firma HMAC del `state`, y sin `state`
 * válido no se toca la base.
 *
 * Contrato de respuesta: SIEMPRE un 302 a GOOGLE_REDIRECT_SUCCESS_URL, con
 * `?google=conectado` o con `?google=error&motivo=...`. Nunca un JSON: del otro
 * lado hay una persona mirando el navegador, no código. Los tokens no salen de
 * acá en ninguna forma.
 *
 * Secretos: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_SUCCESS_URL.
 */
import { adminClient } from '../_shared/supabase.ts'
import { GOOGLE_TOKEN_URL, redirectUri, verificarState } from '../_shared/google.ts'

const TIMEOUT_GOOGLE_MS = 15_000

/** Calendario donde se escriben los eventos. `primary` es el principal del agente. */
const CALENDARIO_POR_DEFECTO = 'primary'

/**
 * Motivos de error que puede leer la UI.
 *
 * Viajan en la query string, así que son snake_case legible y no los
 * `ErrorCode` en mayúsculas de `_shared/http.ts`: acá el consumidor es una
 * pantalla, no un cliente de API.
 */
type Motivo =
  | 'acceso_denegado'
  | 'state_invalido'
  | 'sin_codigo'
  | 'token_error'
  | 'sin_refresh_token'
  | 'guardado_error'

interface RespuestaToken {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  scope?: string
  token_type?: string
}

interface FilaToken {
  id: string
  refresh_token: string | null
}

Deno.serve(async (req) => {
  // La URL de destino se resuelve primero: sin ella no hay forma de contarle
  // nada al agente, y conviene fallar acá y no a mitad del flujo.
  const destino = Deno.env.get('GOOGLE_REDIRECT_SUCCESS_URL')
  if (!destino) {
    console.error(
      'google-oauth-callback: falta GOOGLE_REDIRECT_SUCCESS_URL. ' +
        'Configuralo con `supabase secrets set GOOGLE_REDIRECT_SUCCESS_URL=...`',
    )
    return new Response('Google Calendar no está configurado en el servidor.', {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

  if (req.method !== 'GET') {
    return new Response('Método no permitido', { status: 405 })
  }

  try {
    const params = new URL(req.url).searchParams

    // --- 1. ¿El agente aceptó? -------------------------------------------
    // Si tocó "Cancelar", Google redirige con `error` y sin `code`. No es una
    // falla nuestra: se lo devuelve a la pantalla sin ruido en el log.
    const errorGoogle = params.get('error')
    if (errorGoogle) {
      return redirigir(destino, {
        google: 'error',
        motivo: errorGoogle === 'access_denied' ? 'acceso_denegado' : 'token_error',
      })
    }

    // --- 2. State: de quién es este consentimiento ------------------------
    const state = params.get('state')
    const agenteId = state ? await verificarState(state) : null
    if (!agenteId) {
      // Puede ser un `state` vencido (el agente dejó la pestaña abierta media
      // hora) o alguien probando suerte. No se distingue en la respuesta.
      console.error('google-oauth-callback: state ausente, inválido o vencido')
      return redirigir(destino, { google: 'error', motivo: 'state_invalido' })
    }

    const code = params.get('code')
    if (!code) {
      console.error(`google-oauth-callback: sin code para el agente ${agenteId}`)
      return redirigir(destino, { google: 'error', motivo: 'sin_codigo' })
    }

    // --- 3. Config --------------------------------------------------------
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')
    if (!clientId || !clientSecret) {
      console.error(
        'google-oauth-callback: faltan GOOGLE_CLIENT_ID y/o GOOGLE_CLIENT_SECRET',
      )
      return redirigir(destino, { google: 'error', motivo: 'token_error' })
    }

    // --- 4. Canjear el code por tokens ------------------------------------
    let respuesta: Response
    try {
      respuesta = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri(),
          grant_type: 'authorization_code',
        }),
        signal: AbortSignal.timeout(TIMEOUT_GOOGLE_MS),
      })
    } catch (err) {
      console.error('google-oauth-callback: no se pudo contactar a Google', err)
      return redirigir(destino, { google: 'error', motivo: 'token_error' })
    }

    if (!respuesta.ok) {
      // El cuerpo de error de Google trae `error` y `error_description`, sin
      // secretos. Se trunca igual, mismo criterio que con Mercado Pago.
      const detalle = (await respuesta.text()).slice(0, 500)
      console.error(
        `google-oauth-callback: Google respondió ${respuesta.status} para el agente ${agenteId}: ${detalle}`,
      )
      return redirigir(destino, { google: 'error', motivo: 'token_error' })
    }

    const tokens = (await respuesta.json()) as RespuestaToken
    if (!tokens.access_token) {
      console.error(`google-oauth-callback: respuesta sin access_token para ${agenteId}`)
      return redirigir(destino, { google: 'error', motivo: 'token_error' })
    }

    // --- 5. Guardar --------------------------------------------------------
    const admin = adminClient()

    // Se lee la fila previa antes de escribir por dos razones, y las dos
    // importan: para saber si ya hay un refresh_token que conservar (ver
    // abajo), y para decidir entre INSERT y UPDATE sin depender de que
    // `agente_id` tenga un índice único, que es lo que `upsert(onConflict)`
    // exigiría.
    const { data: existente, error: errorLectura } = await admin
      .from('google_calendar_tokens')
      .select('id, refresh_token')
      .eq('agente_id', agenteId)
      .maybeSingle<FilaToken>()

    if (errorLectura) {
      console.error(
        `google-oauth-callback: no se pudo leer el token del agente ${agenteId}`,
        errorLectura,
      )
      return redirigir(destino, { google: 'error', motivo: 'guardado_error' })
    }

    /*
     * Google manda `refresh_token` UNA sola vez, en la primera autorización de
     * cada cuenta. `prompt=consent` en `google-oauth-init` lo fuerza en cada
     * vuelta, así que lo normal es que venga siempre; pero si por lo que sea no
     * viene, hay que distinguir dos casos y NUNCA pisar con null:
     *
     *  - Ya había uno guardado: se conserva el viejo, que sigue siendo válido.
     *    Sobrescribirlo con null dejaría al agente con una conexión que se
     *    muere en una hora y sin forma de renovarla, sin que nadie se entere
     *    hasta que fallara el primer sync.
     *  - No había ninguno: la conexión no se puede sostener. Se corta acá y se
     *    le pide que reintente, en vez de guardar una conexión que sabemos que
     *    va a morir.
     */
    const refreshToken = tokens.refresh_token ?? existente?.refresh_token ?? null
    if (!refreshToken) {
      console.error(
        `google-oauth-callback: Google no devolvió refresh_token para el agente ${agenteId} ` +
          'y no había uno guardado. El agente tiene que revocar el acceso a LeadEra en ' +
          'https://myaccount.google.com/permissions y volver a conectar.',
      )
      return redirigir(destino, { google: 'error', motivo: 'sin_refresh_token' })
    }

    // `expires_in` viene en segundos desde ahora. Se guarda el instante
    // absoluto: comparar contra `now()` en el sync es una resta menos y no
    // depende de cuándo se leyó la fila.
    const expiry = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString()

    const valores = {
      access_token: tokens.access_token,
      refresh_token: refreshToken,
      token_expiry: expiry,
      // `scope` es lo que Google efectivamente concedió, que puede ser menos de
      // lo que se pidió si el agente destildó algo en la pantalla.
      scope: tokens.scope ?? null,
      google_calendar_id: CALENDARIO_POR_DEFECTO,
      conectado: true,
      updated_at: new Date().toISOString(),
    }

    const { error: errorGuardado } = existente
      ? await admin.from('google_calendar_tokens').update(valores).eq('id', existente.id)
      : await admin
          .from('google_calendar_tokens')
          .insert({ ...valores, agente_id: agenteId })

    if (errorGuardado) {
      console.error(
        `google-oauth-callback: no se pudo guardar el token del agente ${agenteId}`,
        errorGuardado,
      )
      return redirigir(destino, { google: 'error', motivo: 'guardado_error' })
    }

    return redirigir(destino, { google: 'conectado' })
  } catch (err) {
    console.error('google-oauth-callback: error inesperado', err)
    return redirigir(destino, { google: 'error', motivo: 'token_error' })
  }
})

/**
 * 302 al destino con los parámetros agregados.
 *
 * Va por la API de URL y no por concatenación: `GOOGLE_REDIRECT_SUCCESS_URL`
 * puede venir ya con query string o con fragmento, y pegarle `?google=...`
 * a mano rompería esos casos.
 */
function redirigir(destino: string, params: Record<string, string | Motivo>): Response {
  let url: URL
  try {
    url = new URL(destino)
  } catch {
    console.error(`google-oauth-callback: GOOGLE_REDIRECT_SUCCESS_URL inválida: ${destino}`)
    return new Response('La URL de retorno configurada no es válida.', {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

  for (const [clave, valor] of Object.entries(params)) url.searchParams.set(clave, valor)

  return new Response(null, { status: 302, headers: { Location: url.toString() } })
}
