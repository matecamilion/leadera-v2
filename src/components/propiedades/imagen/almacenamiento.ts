export const CLAVE_ENCABEZADO = 'leadera-imagen-encabezado'
export const CLAVE_AGENTE = 'leadera-imagen-agente'
export const CLAVE_FIRMA = 'leadera-imagen-firma'
/** '1' cuando ya se tocó el botón "Crear flyer" de la ficha: deja de mostrar "Nuevo". */
export const CLAVE_FLYER_VISTO = 'leadera-flyer-visto'

/** En try/catch por lo mismo que el resto de la app: sin storage, el campo anda igual. */
export function leerGuardado(clave: string): string | null {
  try {
    return localStorage.getItem(clave)
  } catch {
    return null
  }
}

export function guardar(clave: string, valor: string): void {
  try {
    localStorage.setItem(clave, valor)
  } catch {
    // No se recuerda para la próxima. Es molesto, no roto.
  }
}
