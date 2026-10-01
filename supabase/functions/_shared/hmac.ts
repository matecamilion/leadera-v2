/**
 * Firma HMAC-SHA256 genérica, con base64url.
 *
 * Es una copia deliberada de lo que hace `firmaBaja.ts` por dentro (clave a
 * partir del service role key, base64url sin relleno), sacada a un helper para
 * `consulta-publica`. `firmaBaja.ts` no se tocó a propósito: sigue con su
 * implementación propia.
 *
 * Cada uso tiene que pasar su propia etiqueta de dominio dentro del mensaje,
 * para que una firma emitida para una cosa no sirva para otra.
 */

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

export async function firmarHmac(mensaje: string): Promise<string> {
  const firma = await crypto.subtle.sign(
    'HMAC',
    await claveHmac(['sign']),
    new TextEncoder().encode(mensaje),
  )
  return aBase64Url(new Uint8Array(firma))
}

/** `crypto.subtle.verify` compara en tiempo constante. */
export async function verificarHmac(mensaje: string, firmaB64: string): Promise<boolean> {
  const firma = deBase64Url(firmaB64)
  if (!firma) return false

  return await crypto.subtle.verify(
    'HMAC',
    await claveHmac(['verify']),
    firma,
    new TextEncoder().encode(mensaje),
  )
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
