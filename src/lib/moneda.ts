/** La moneda por defecto cuando una fila no la trae: es la de `busquedas.moneda`. */
export const MONEDA_POR_DEFECTO = 'USD'

/**
 * ¿Son la misma moneda? Una moneda ausente cuenta como USD.
 *
 * Es la regla de `buscar_coincidencias_busqueda`: el precio de una propiedad
 * sólo cuenta contra el rango de una búsqueda si las dos están en la misma
 * moneda (con `coalesce(..., 'USD')` de los dos lados).
 */
export function mismaMoneda(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  return (a ?? MONEDA_POR_DEFECTO) === (b ?? MONEDA_POR_DEFECTO)
}
