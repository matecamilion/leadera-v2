/**
 * Validación del cuerpo del pedido. Aparte del index para poder probarla sin
 * levantar el servidor.
 */
import { type PayloadPush, validarPayload } from '../_shared/pushValidacion.ts'

export interface Entrada {
  user_ids: string[]
  payload: PayloadPush
  ttl: number
  dry_run: boolean
}

const CLAVES_ENTRADA = new Set(['user_ids', 'payload', 'ttl', 'dry_run'])
const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const MAX_USER_IDS = 200
export const TTL_POR_DEFECTO = 3600
const TTL_MIN = 60
const TTL_MAX = 86_400

/**
 * Valida el cuerpo del pedido. Cualquier cosa mal escrita se rechaza entera en
 * vez de ignorarse: un `"dryrun": true` que se pasara por alto mandaría
 * notificaciones de verdad.
 */
export function leerEntrada(cuerpo: string): { entrada: Entrada } | { error: string } {
  let datos: unknown
  try {
    datos = JSON.parse(cuerpo)
  } catch {
    return { error: 'El cuerpo no es un JSON válido.' }
  }
  if (typeof datos !== 'object' || datos === null || Array.isArray(datos)) {
    return { error: 'El cuerpo tiene que ser un objeto JSON.' }
  }

  const obj = datos as Record<string, unknown>
  const desconocidas = Object.keys(obj).filter((k) => !CLAVES_ENTRADA.has(k))
  if (desconocidas.length) {
    return {
      error: `Claves desconocidas: ${desconocidas.join(', ')}. Se aceptan: ${[...CLAVES_ENTRADA].join(', ')}.`,
    }
  }

  const { user_ids, payload, ttl, dry_run } = obj

  if (
    !Array.isArray(user_ids) || user_ids.length < 1 || user_ids.length > MAX_USER_IDS ||
    !user_ids.every((id) => typeof id === 'string' && RE_UUID.test(id))
  ) {
    return { error: `\`user_ids\` tiene que ser una lista de 1 a ${MAX_USER_IDS} uuid.` }
  }
  if (new Set(user_ids.map((id) => id.toLowerCase())).size !== user_ids.length) {
    return { error: '`user_ids` no puede tener repetidos.' }
  }

  const validado = validarPayload(payload)
  if (!validado.ok) return { error: validado.motivo }

  if (ttl !== undefined && (!Number.isInteger(ttl) || (ttl as number) < TTL_MIN || (ttl as number) > TTL_MAX)) {
    return { error: `\`ttl\` tiene que ser un entero entre ${TTL_MIN} y ${TTL_MAX}.` }
  }
  if (dry_run !== undefined && typeof dry_run !== 'boolean') {
    return { error: '`dry_run` tiene que ser true o false.' }
  }

  return {
    entrada: {
      user_ids: user_ids as string[],
      payload: validado.payload,
      ttl: (ttl as number | undefined) ?? TTL_POR_DEFECTO,
      dry_run: dry_run === true,
    },
  }
}
