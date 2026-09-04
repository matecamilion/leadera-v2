import { corsHeaders } from './cors.ts'

/**
 * Códigos de error estables para que el frontend distinga casos sin parsear
 * el mensaje. El contrato sigue siendo `{ error: string }`; `code` es adicional.
 */
export type ErrorCode =
  | 'METODO_NO_PERMITIDO'
  | 'JSON_INVALIDO'
  | 'INPUT_INVALIDO'
  | 'NO_AUTENTICADO'
  | 'SIN_PERMISO'
  | 'PERFIL_NO_ENCONTRADO'
  | 'SIN_CUPO'
  | 'INVITACION_NO_EXISTE'
  | 'INVITACION_YA_USADA'
  | 'INVITACION_VENCIDA'
  | 'EMAIL_YA_REGISTRADO'
  | 'COTIZACION_NO_DISPONIBLE'
  | 'CONFIG_FALTANTE'
  | 'SUSCRIPCION_YA_ACTIVA'
  | 'SIN_SUSCRIPCION_ACTIVA'
  | 'PRECIO_NO_DISPONIBLE'
  | 'MP_NO_DISPONIBLE'
  | 'MP_RECHAZO'
  | 'ERROR_INTERNO'

export function jsonResponse(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  })
}

export function errorResponse(
  req: Request,
  error: string,
  status: number,
  code: ErrorCode,
): Response {
  return jsonResponse(req, { error, code }, status)
}
