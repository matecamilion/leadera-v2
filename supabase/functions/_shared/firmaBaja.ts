/**
 * El token del link "Darme de baja" del reporte semanal.
 *
 * Por qué un token firmado y no un link a /perfil: el mail se abre en el
 * teléfono, muchas veces sin la sesión iniciada, y obligar a loguearse para
 * dejar de recibir un mail es la forma más rápida de que lo marquen como spam.
 * Con esto, un click y listo.
 *
 * Por qué firmado y no `?agente=<uuid>` pelado: sin firma, cualquiera que
 * pruebe uuids podría dar de baja a otro agente. El HMAC hace que el link sólo
 * valga si lo generó esta app, y como el payload lleva el `agente_id` adentro,
 * el link de uno no sirve para el otro.
 *
 * Mismo esquema que el `state` del OAuth de Google (`_shared/google.ts`), con
 * su propia etiqueta de dominio para que una firma de allá no sirva acá.
 *
 * Sin vencimiento a propósito: un mail viejo que quedó en la bandeja tiene que
 * seguir sirviendo para darse de baja. Lo único que habilita es apagar una
 * preferencia propia, que el agente puede volver a prender desde la app.
 */
const ETIQUETA = 'reporte-semanal-baja:v1:'

function claveHmac(usos: KeyUsage[]): Promise<CryptoKey> {
  const secreto = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!secreto) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY')

  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secreto),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    usos,
  )
}

export async function firmarBaja(agenteId: string): Promise<string> {
  const firma = await crypto.subtle.sign(
    'HMAC',
    await claveHmac(['sign']),
    new TextEncoder().encode(ETIQUETA + agenteId),
  )
  return `${agenteId}.${aBase64Url(new Uint8Array(firma))}`
}

/** El agente del token, o null si la firma no cierra. */
export async function verificarBaja(token: string): Promise<string | null> {
  const partes = token.split('.')
  if (partes.length !== 2) return null

  const [agenteId, firmaB64] = partes
  if (!/^[0-9a-f-]{36}$/i.test(agenteId)) return null

  const firma = deBase64Url(firmaB64)
  if (!firma) return null

  // `crypto.subtle.verify` compara en tiempo constante: no hay ningún `===`
  // entre firmas acá, igual que en el `state` de Google.
  const ok = await crypto.subtle.verify(
    'HMAC',
    await claveHmac(['verify']),
    firma,
    new TextEncoder().encode(ETIQUETA + agenteId),
  )

  return ok ? agenteId : null
}

function aBase64Url(bytes: Uint8Array): string {
  let binario = ''
  for (const byte of bytes) binario += String.fromCharCode(byte)
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

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
