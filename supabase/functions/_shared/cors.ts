/**
 * CORS compartido por las Edge Functions.
 *
 * Allowlist explícita: dev local + producción. No usamos `*` porque estas
 * funciones reciben credenciales (JWT en el header Authorization).
 * Se puede extender sin redeploy con la env var EXTRA_ALLOWED_ORIGINS
 * (lista separada por comas).
 */

const DEFAULT_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://app.leadera.com.ar',
]

function allowedOrigins(): string[] {
  const extra = (Deno.env.get('EXTRA_ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
  return [...DEFAULT_ORIGINS, ...extra]
}

/** Headers CORS para un request. Devuelve el origin sólo si está en la allowlist. */
export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
  if (allowedOrigins().includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
  }
  return headers
}

/** Respuesta al preflight OPTIONS. */
export function preflight(req: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(req) })
}
