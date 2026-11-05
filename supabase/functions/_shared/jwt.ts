/**
 * Rol (`role`) que declara un JWT, sin verificar la firma: la verifica el
 * gateway con `verify_jwt = true`. Sirve para exigir `service_role` adentro de
 * una función que sólo debe llamar el sistema.
 */
export function rolDelJwt(token: string | null): string | undefined {
  try {
    const payload = (token ?? '').split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(payload + '='.repeat((4 - (payload.length % 4)) % 4)))?.role
  } catch {
    return undefined
  }
}
