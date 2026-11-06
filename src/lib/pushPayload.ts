/**
 * Normalización del payload de una notificación push.
 *
 * Módulo puro (sin DOM ni APIs de worker): lo importan el service worker y los
 * tests. Todo lo que llega por push es entrada no confiable: se valida y se
 * recorta, y la URL de destino solo puede ser una ruta interna de la app.
 */

export interface PayloadPush {
  title: string
  body: string
  url: string
  tag?: string
}

const TITULO_POR_DEFECTO = 'LeadEra'
const MAX_TITULO = 100
const MAX_CUERPO = 300
const MAX_TAG = 64
const TAG_VALIDO = /^[A-Za-z0-9:_-]+$/

function texto(valor: unknown, max: number): string | null {
  return typeof valor === 'string' && valor.length > 0 ? valor.slice(0, max) : null
}

/**
 * Convierte lo recibido en un payload seguro. Si no es JSON (p. ej. el texto
 * plano que manda DevTools) usa el texto como cuerpo; si falta algo, defaults.
 */
export function normalizarPayloadPush(crudo: string | null): PayloadPush {
  let datos: unknown = null
  if (crudo) {
    try {
      datos = JSON.parse(crudo)
    } catch {
      datos = null
    }
  }

  const esObjeto = typeof datos === 'object' && datos !== null && !Array.isArray(datos)
  if (!esObjeto) {
    return { title: TITULO_POR_DEFECTO, body: crudo ? crudo.slice(0, MAX_CUERPO) : '', url: '/' }
  }

  const campos = datos as Record<string, unknown>
  const payload: PayloadPush = {
    title: texto(campos.title, MAX_TITULO) ?? TITULO_POR_DEFECTO,
    body: texto(campos.body, MAX_CUERPO) ?? '',
    url: typeof campos.url === 'string' ? campos.url : '/',
  }
  const tag = texto(campos.tag, MAX_TAG)
  if (tag && TAG_VALIDO.test(tag)) payload.tag = tag
  return payload
}

/**
 * Devuelve una ruta interna (pathname + search + hash) o '/'. Rechaza URLs
 * absolutas a otro origen, protocol-relative (`//host`), `/\host` y esquemas
 * como `javascript:`.
 */
export function resolverUrlInterna(url: string, origen: string): string {
  if (typeof url !== 'string' || url.startsWith('//') || url.startsWith('/\\')) return '/'
  try {
    const resuelta = new URL(url, origen)
    if (resuelta.origin !== new URL(origen).origin) return '/'
    return resuelta.pathname + resuelta.search + resuelta.hash
  } catch {
    return '/'
  }
}
