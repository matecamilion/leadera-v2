/**
 * Validaciones puras del envío de Web Push: endpoint, payload y respuesta del
 * servicio push. Sin imports (ni npm) para poder probarlas con `deno test`.
 */

/**
 * Servicios push a los que se le puede mandar algo. Sin punto inicial: host
 * exacto. Con punto inicial: cualquier subdominio, nunca el dominio pelado.
 *
 * Para agregar un servicio nuevo, sumar un elemento acá y el mismo criterio en
 * `v_hosts_permitidos` de `registrar_push_suscripcion` (migración nueva con
 * `create or replace`). Si sólo se cambia uno de los dos, el endpoint se
 * registra y después no se envía (o al revés).
 */
export const HOSTS_PUSH_PERMITIDOS = [
  'fcm.googleapis.com',
  '.push.services.mozilla.com',
  '.push.apple.com',
  '.notify.windows.com',
] as const

const MAX_LARGO_ENDPOINT = 2048
const MAX_BYTES_PAYLOAD = 2000

/** Un nombre de host sin etiquetas vacías: "a", "a.b", pero no "a..b" ni ".a". */
const RE_ETIQUETAS = /^[a-z0-9-]+(\.[a-z0-9-]+)*$/

export type ResultadoEndpoint = { ok: true; host: string } | { ok: false; motivo: string }

/**
 * Un endpoint es seguro de usar sólo si es https, sin credenciales, en el
 * puerto 443 y de uno de los servicios de `HOSTS_PUSH_PERMITIDOS`. El host sale
 * de `new URL()`, que es el mismo parser que va a usar `fetch`: así no hay dos
 * lecturas distintas de la misma URL (por ejemplo con "\", que se trata como "/").
 */
export function validarEndpoint(endpoint: string): ResultadoEndpoint {
  if (typeof endpoint !== 'string' || endpoint.length === 0) {
    return { ok: false, motivo: 'endpoint vacío' }
  }
  if (endpoint.length > MAX_LARGO_ENDPOINT) {
    return { ok: false, motivo: 'endpoint demasiado largo' }
  }

  let url: URL
  try {
    url = new URL(endpoint)
  } catch {
    return { ok: false, motivo: 'endpoint no es una URL' }
  }

  if (url.protocol !== 'https:') return { ok: false, motivo: 'endpoint no es https' }
  if (url.username || url.password) return { ok: false, motivo: 'endpoint con credenciales' }
  if (url.port !== '' && url.port !== '443') return { ok: false, motivo: 'endpoint con puerto no permitido' }

  const host = url.hostname // `URL` ya lo pasa a minúsculas
  if (!hostPermitido(host)) return { ok: false, motivo: 'servicio push no permitido' }
  return { ok: true, host }
}

function hostPermitido(host: string): boolean {
  return HOSTS_PUSH_PERMITIDOS.some((permitido) => {
    if (!permitido.startsWith('.')) return host === permitido
    if (!host.endsWith(permitido)) return false
    return RE_ETIQUETAS.test(host.slice(0, -permitido.length))
  })
}

export interface PayloadPush {
  title: string
  body: string
  url: string
  tag?: string
}

export type ResultadoPayload = { ok: true; payload: PayloadPush } | { ok: false; motivo: string }

const CLAVES_PAYLOAD = new Set(['title', 'body', 'url', 'tag'])
const RE_CONTROL = /[\u0000-\u001f\u007f]/
const RE_TAG = /^[A-Za-z0-9:_-]{1,64}$/

/**
 * Valida lo que va dentro de la notificación. `url` es una ruta de la propia
 * app: tiene que empezar con "/" y no con "//" ni "/\", que el navegador
 * interpreta como otro sitio.
 */
export function validarPayload(entrada: unknown): ResultadoPayload {
  if (typeof entrada !== 'object' || entrada === null || Array.isArray(entrada)) {
    return { ok: false, motivo: 'payload tiene que ser un objeto' }
  }

  const obj = entrada as Record<string, unknown>
  const desconocidas = Object.keys(obj).filter((k) => !CLAVES_PAYLOAD.has(k))
  if (desconocidas.length) {
    return { ok: false, motivo: `payload con claves desconocidas: ${desconocidas.join(', ')}` }
  }

  const { title, body, url, tag } = obj
  if (typeof title !== 'string' || title.length < 1 || title.length > 100) {
    return { ok: false, motivo: 'payload.title tiene que ser un texto de 1 a 100 caracteres' }
  }
  if (typeof body !== 'string' || body.length < 1 || body.length > 300) {
    return { ok: false, motivo: 'payload.body tiene que ser un texto de 1 a 300 caracteres' }
  }
  if (
    typeof url !== 'string' || url.length > 300 || !url.startsWith('/') ||
    url.startsWith('//') || url.startsWith('/\\') || RE_CONTROL.test(url)
  ) {
    return { ok: false, motivo: 'payload.url tiene que ser una ruta interna que empiece con "/"' }
  }
  if (tag !== undefined && (typeof tag !== 'string' || !RE_TAG.test(tag))) {
    return { ok: false, motivo: 'payload.tag tiene que tener de 1 a 64 caracteres [A-Za-z0-9:_-]' }
  }

  const payload: PayloadPush = tag === undefined ? { title, body, url } : { title, body, url, tag }
  if (new TextEncoder().encode(JSON.stringify(payload)).length > MAX_BYTES_PAYLOAD) {
    return { ok: false, motivo: `payload pesa más de ${MAX_BYTES_PAYLOAD} bytes` }
  }
  return { ok: true, payload }
}

export type ClaseRespuesta = 'ok' | 'eliminar' | 'reintentable' | 'error'

/**
 * Qué hacer según el status que devolvió el servicio push: 404 y 410 son una
 * suscripción que ya no existe; 429 y 5xx se pueden reintentar; cualquier otra
 * cosa (incluidas las redirecciones, que nunca se siguen) es un error.
 */
export function clasificarRespuesta(status: number): ClaseRespuesta {
  if (status === 200 || status === 201 || status === 202) return 'ok'
  if (status === 404 || status === 410) return 'eliminar'
  if (status === 429 || (status >= 500 && status <= 599)) return 'reintentable'
  return 'error'
}
