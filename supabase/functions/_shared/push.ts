import webpush from 'npm:web-push@3.6.7'
import { clasificarRespuesta, type PayloadPush, validarEndpoint } from './pushValidacion.ts'

const TIMEOUT_PUSH_MS = 10_000

export interface SuscripcionPush {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

export interface OpcionesPush {
  /** Segundos que el servicio push guarda el mensaje si el dispositivo está apagado. */
  ttl: number
  /** Arma el pedido pero no lo manda. */
  dryRun: boolean
}

export interface ResultadoPush {
  id: string
  resultado: 'ok' | 'eliminar' | 'reintentable' | 'error' | 'rechazada' | 'dry_run'
  status?: number
  host?: string
}

interface Vapid {
  subject: string
  publicKey: string
  privateKey: string
}

/**
 * Lee las claves VAPID del entorno. Los errores no incluyen ningún valor: ni
 * las claves ni el subject pueden terminar en un log o en una respuesta.
 */
export function cargarVapid(): Vapid {
  const subject = Deno.env.get('VAPID_SUBJECT')
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY')
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY')
  if (!subject || !publicKey || !privateKey) {
    throw new Error('Falta configurar VAPID_SUBJECT, VAPID_PUBLIC_KEY o VAPID_PRIVATE_KEY')
  }
  if (!subject.startsWith('mailto:') && !subject.startsWith('https://')) {
    throw new Error('VAPID_SUBJECT tiene que empezar con mailto: o https://')
  }
  return { subject, publicKey, privateKey }
}

/**
 * Manda un Web Push a una suscripción. Nunca tira por un problema de la
 * suscripción o de la red: lo devuelve como `resultado`. Sólo tira si falta
 * configuración VAPID, que es un problema de toda la corrida.
 *
 * No loguea endpoint, claves ni contenido: sólo el host y el status.
 */
export async function enviarPush(
  suscripcion: SuscripcionPush,
  payload: PayloadPush,
  opciones: OpcionesPush,
): Promise<ResultadoPush> {
  const { id } = suscripcion

  const endpoint = validarEndpoint(suscripcion.endpoint)
  if (!endpoint.ok) return { id, resultado: 'rechazada' }
  const { host } = endpoint

  const vapid = cargarVapid()

  let pedido: ReturnType<typeof webpush.generateRequestDetails>
  try {
    pedido = webpush.generateRequestDetails(
      { endpoint: suscripcion.endpoint, keys: { p256dh: suscripcion.p256dh, auth: suscripcion.auth } },
      JSON.stringify(payload),
      {
        TTL: opciones.ttl,
        vapidDetails: { subject: vapid.subject, publicKey: vapid.publicKey, privateKey: vapid.privateKey },
      },
    )
  } catch {
    // Claves de la suscripción mal formadas. El mensaje de la librería puede
    // traer los valores, así que no se propaga.
    return { id, resultado: 'error', host }
  }

  if (opciones.dryRun) return { id, resultado: 'dry_run', host }

  // Content-Length lo calcula fetch a partir del cuerpo.
  const headers = Object.fromEntries(
    Object.entries(pedido.headers as Record<string, string>).filter(([nombre]) =>
      nombre.toLowerCase() !== 'content-length'
    ),
  )

  try {
    const respuesta = await fetch(pedido.endpoint, {
      method: 'POST',
      headers,
      body: new Uint8Array(pedido.body),
      signal: AbortSignal.timeout(TIMEOUT_PUSH_MS),
      // Una redirección nunca se sigue: cuenta como error (clasificarRespuesta).
      redirect: 'manual',
    })
    await respuesta.body?.cancel()
    return { id, resultado: clasificarRespuesta(respuesta.status), status: respuesta.status, host }
  } catch {
    return { id, resultado: 'reintentable', host }
  }
}
