/**
 * Puerta HTTP de `google-calendar-import-ahora`, separada de `index.ts` para
 * testear que un JWT anónimo o inválido nunca llega a la importación.
 *
 * El gateway (verify_jwt = true) solo comprueba la firma, y la anon key
 * también la tiene: por eso acá se exige un usuario real (`getUser`).
 * El body no se lee: la cuenta la resuelve el servidor.
 */
import { errorResponse, jsonResponse } from '../_shared/http.ts'
import { preflight } from '../_shared/cors.ts'
import { bearerToken } from '../_shared/supabase.ts'
import { type DepsImportAhora, ejecutarImportAhora } from './logica.ts'

export interface DepsHandler extends DepsImportAhora {
  /** El usuario dueño del JWT, o null si el token no es de un usuario válido. */
  usuarioDeToken(token: string): Promise<{ id: string } | null>
}

export function crearHandler(deps: DepsHandler): (req: Request) => Promise<Response> {
  return async (req) => {
    if (req.method === 'OPTIONS') return preflight(req)
    if (req.method !== 'POST') {
      return errorResponse(req, 'Método no permitido', 405, 'METODO_NO_PERMITIDO')
    }

    try {
      const token = bearerToken(req)
      if (!token) {
        return errorResponse(req, 'Falta el token de autenticación', 401, 'NO_AUTENTICADO')
      }

      const usuario = await deps.usuarioDeToken(token)
      if (!usuario) {
        return errorResponse(req, 'Sesión inválida o expirada', 401, 'NO_AUTENTICADO')
      }

      const respuesta = await ejecutarImportAhora(deps, usuario.id)
      return jsonResponse(req, respuesta.cuerpo, respuesta.status)
    } catch (err) {
      // El detalle va al log; al cliente, un error genérico.
      console.error('google-calendar-import-ahora: error inesperado', err instanceof Error ? err.message : err)
      return errorResponse(req, 'No se pudo actualizar', 500, 'ERROR_INTERNO')
    }
  }
}
