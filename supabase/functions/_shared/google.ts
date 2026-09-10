/**
 * Piezas compartidas del OAuth de Google Calendar.
 *
 * Vive en `_shared` y no adentro de una función porque el `state` se firma en
 * `google-oauth-init` y se verifica en `google-oauth-callback`: si cada una
 * tuviera su copia del HMAC, un cambio de formato en una rompería la otra en
 * silencio y recién se notaría con un agente real a mitad del consentimiento.
 *
 * Config esperada (secrets de Supabase): GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
 * y GOOGLE_REDIRECT_SUCCESS_URL. SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY las
 * inyecta la plataforma.
 */

export const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'

/** El único scope que pide LeadEra: leer y escribir eventos, nada más. */
export const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/calendar.events'

/**
 * A dónde vuelve Google después del consentimiento.
 *
 * Se deriva de SUPABASE_URL y no de un secret propio: tiene que coincidir
 * carácter por carácter con la "Authorized redirect URI" cargada en Google
 * Cloud Console, y derivarla elimina la chance de que un secret quede
 * desincronizado con la consola.
 */
export function redirectUri(): string {
  return `${requireEnv('SUPABASE_URL').replace(/\/+$/, '')}/functions/v1/google-oauth-callback`
}

export function requireEnv(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Falta la variable de entorno ${name}`)
  return value
}

// ---------------------------------------------------------------------------
// State firmado
// ---------------------------------------------------------------------------

/**
 * Separador de dominio del HMAC.
 *
 * La clave es el service role key, que también firma/valida otras cosas. El
 * prefijo hace que una firma de acá no pueda reusarse como firma de otro
 * propósito aunque comparta la clave, y el `:v1:` deja lugar a cambiar el
 * formato del payload sin aceptar los viejos.
 */
const ETIQUETA_STATE = 'google-oauth-state:v1:'

/**
 * Cuánto vale un `state`, en segundos.
 *
 * Diez minutos alcanzan de sobra para elegir cuenta y aceptar el consentimiento,
 * y acotan la ventana en la que un `state` filtrado —queda en el historial del
 * navegador y en los logs de Google— sirve para algo.
 */
const VALIDEZ_STATE_S = 600

interface PayloadState {
  /** agente_id (uuid del profile). */
  aid: string
  /** Epoch en segundos en que vence. */
  exp: number
  /** Aleatorio: dos consentimientos del mismo agente no comparten `state`. */
  n: string
}

/**
 * Firma un `state` que ata el consentimiento a un agente concreto.
 *
 * Es el anti-CSRF del flujo: sin esto, cualquiera podría llamar al callback con
 * un `code` propio y un `agente_id` ajeno, y quedarse con el calendario de otro
 * agente conectado a su cuenta de Google. Al venir firmado, el callback sabe
 * que el `agente_id` lo puso esta función después de validar el JWT, y no el
 * que abrió la URL.
 *
 * No se guarda nada en la base: el `state` es autocontenido y verificable con
 * la clave, así que no hace falta una tabla de nonces ni limpiarla después.
 */
export async function firmarState(agenteId: string): Promise<string> {
  const payload: PayloadState = {
    aid: agenteId,
    exp: Math.floor(Date.now() / 1000) + VALIDEZ_STATE_S,
    n: crypto.randomUUID(),
  }

  const cuerpo = aBase64Url(new TextEncoder().encode(JSON.stringify(payload)))

  const firma = await crypto.subtle.sign(
    'HMAC',
    await claveHmac(['sign']),
    new TextEncoder().encode(ETIQUETA_STATE + cuerpo),
  )

  return `${cuerpo}.${aBase64Url(new Uint8Array(firma))}`
}

/**
 * Verifica un `state` y devuelve el agente_id, o null si no sirve.
 *
 * Null cubre los tres casos por igual —mal formado, firma inválida, vencido—
 * porque para el callback los tres significan lo mismo: no confiar en ese
 * `agente_id`. Quién falló exactamente va al log, no a la respuesta.
 *
 * La comparación de la firma la hace `crypto.subtle.verify`, que compara en
 * tiempo constante; por eso acá no hay ningún `===` entre firmas, igual que en
 * `webhook-mercadopago`.
 */
export async function verificarState(state: string): Promise<string | null> {
  const partes = state.split('.')
  if (partes.length !== 2) return null

  const [cuerpo, firmaB64] = partes
  const firma = deBase64Url(firmaB64)
  if (!firma) return null

  const ok = await crypto.subtle.verify(
    'HMAC',
    await claveHmac(['verify']),
    firma,
    new TextEncoder().encode(ETIQUETA_STATE + cuerpo),
  )
  if (!ok) return null

  // Recién acá se mira el contenido: parsear antes de verificar la firma sería
  // trabajar sobre datos que todavía no se sabe de dónde vienen.
  const crudo = deBase64Url(cuerpo)
  if (!crudo) return null

  let payload: PayloadState
  try {
    payload = JSON.parse(new TextDecoder().decode(crudo))
  } catch {
    return null
  }

  if (typeof payload?.aid !== 'string' || typeof payload?.exp !== 'number') return null
  if (payload.exp < Math.floor(Date.now() / 1000)) return null

  return payload.aid
}

function claveHmac(usos: KeyUsage[]): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(requireEnv('SUPABASE_SERVICE_ROLE_KEY')),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    usos,
  )
}

// ---------------------------------------------------------------------------
// base64url
// ---------------------------------------------------------------------------
//
// Base64 común no sirve: el `state` viaja en la query string de la URL de
// consentimiento, y `+`, `/` y `=` se escapan ahí. base64url usa `-` y `_` y
// no lleva relleno, así que sobrevive el ida y vuelta sin encodear nada.

function aBase64Url(bytes: Uint8Array): string {
  let binario = ''
  for (const byte of bytes) binario += String.fromCharCode(byte)
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * base64url a bytes. null si el string no es base64url válido.
 *
 * El buffer se crea explícito para que el tipo quede `Uint8Array<ArrayBuffer>`:
 * `crypto.subtle.verify` no acepta el `ArrayBufferLike` que infiere el
 * constructor pelado, porque podría ser un SharedArrayBuffer. Mismo detalle que
 * `hexABytes` en `webhook-mercadopago`.
 */
function deBase64Url(texto: string): Uint8Array<ArrayBuffer> | null {
  if (texto.length === 0 || !/^[A-Za-z0-9_-]+$/.test(texto)) return null

  const base64 = texto.replace(/-/g, '+').replace(/_/g, '/')
  const conRelleno = base64 + '='.repeat((4 - (base64.length % 4)) % 4)

  try {
    const binario = atob(conRelleno)
    const bytes = new Uint8Array(new ArrayBuffer(binario.length))
    for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i)
    return bytes
  } catch {
    return null
  }
}
