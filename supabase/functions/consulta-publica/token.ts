/**
 * Token que el GET entrega y el POST devuelve.
 *
 * Sirve para dos cosas:
 *   - Medir el tiempo de completado en el SERVIDOR: `emitido` va firmado, así
 *     que el cliente no puede adelantarlo para saltear el mínimo de 8 s.
 *   - Atar el POST a un link: el slug sale del token, no del body, así que no
 *     se puede usar la página de un link para escribir en otro.
 *
 * Formato: `<slug>.<emitido_ms>.<firma>`. La firma cubre la etiqueta de
 * dominio, el slug y el instante.
 */
import { firmarHmac, verificarHmac } from '../_shared/hmac.ts'

const ETIQUETA = 'consulta-publica:v1:'

/** Cuánto vale un token: la página puede quedar abierta de un día para el otro. */
export const VIGENCIA_TOKEN_MS = 24 * 60 * 60 * 1000

/** Tolerancia para relojes: un token "del futuro" más allá de esto es falso. */
const TOLERANCIA_FUTURO_MS = 60 * 1000

export const RE_SLUG = /^[a-z0-9]{8,32}$/

export async function emitirToken(slug: string, ahora = Date.now()): Promise<string> {
  const firma = await firmarHmac(`${ETIQUETA}${slug}.${ahora}`)
  return `${slug}.${ahora}.${firma}`
}

export interface TokenValido {
  slug: string
  emitido: number
}

/** El slug y el instante del token, o null si no es válido o venció. */
export async function verificarToken(
  token: unknown,
  ahora = Date.now(),
): Promise<TokenValido | null> {
  if (typeof token !== 'string' || token.length > 200) return null

  const partes = token.split('.')
  if (partes.length !== 3) return null

  const [slug, emitidoTexto, firma] = partes
  if (!RE_SLUG.test(slug) || !/^\d{13}$/.test(emitidoTexto)) return null

  const emitido = Number(emitidoTexto)
  if (emitido > ahora + TOLERANCIA_FUTURO_MS) return null
  if (ahora - emitido > VIGENCIA_TOKEN_MS) return null

  const ok = await verificarHmac(`${ETIQUETA}${slug}.${emitido}`, firma)
  return ok ? { slug, emitido } : null
}
