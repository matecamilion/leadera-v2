/**
 * Reglas de rango compartidas por los formularios.
 *
 * El piso de precios, montos, ambientes y metros es 1, no 0: un cero no es un
 * dato incompleto —para eso está dejar el campo vacío— sino uno equivocado.
 */

/** Mínimo que aceptan los campos de cantidad y dinero. */
export const MINIMO_CANTIDAD = 1

/**
 * true si el campo tiene algo cargado y ese algo no llega al mínimo.
 *
 * Un campo vacío devuelve false: es opcional, no inválido. Se marca como
 * inválido en vez de anular el valor para que el usuario vea qué corregir en
 * lugar de que el dato desaparezca solo.
 */
export function cantidadInvalida(valor: string): boolean {
  if (!valor.trim()) return false
  const n = Number(valor)
  return !Number.isFinite(n) || n < MINIMO_CANTIDAD
}

/** Mínimo de los campos donde el 0 sí es un dato: baños, cocheras, expensas. */
export const MINIMO_DESDE_CERO = 0

/**
 * true si el campo tiene algo cargado y ese algo es negativo o no es un número.
 *
 * Hermana de `cantidadInvalida`, para los campos donde el 0 es un valor real y
 * no un error: una propiedad puede tener 0 cocheras o 0 de expensas, mientras
 * que 0 ambientes o 0 metros no significan nada.
 */
export function menorACero(valor: string): boolean {
  if (!valor.trim()) return false
  const n = Number(valor)
  return !Number.isFinite(n) || n < MINIMO_DESDE_CERO
}
