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

/**
 * Mínimo de caracteres del detalle de una interacción.
 *
 * Vive acá y no en el formulario de alta porque la edición aplica la misma
 * regla: con una constante por pantalla, bajarla en una sola convertía a la
 * otra en la puerta de atrás para dejar un detalle de un carácter en un
 * historial que después nadie puede leer.
 */
export const DETALLE_MINIMO = 10

/** true si el detalle tiene algo cargado pero no llega al mínimo. */
export function detalleCorto(valor: string): boolean {
  const limpio = valor.trim()
  return limpio.length > 0 && limpio.length < DETALLE_MINIMO
}

// ---------------------------------------------------------------------------
// Techos
// ---------------------------------------------------------------------------

/**
 * Los máximos que aceptan los campos de plata y medidas.
 *
 * No son límites del negocio: son cotas de cordura para atajar el cero de más y
 * el teclado trabado. Un precio de doce dígitos no es una propiedad cara, es un
 * error de tipeo que después arrastra los totales y aplasta cualquier gráfico
 * que lo incluya. Están holgados a propósito y se suben si la realidad los pasa.
 */
export const TOPE_PRECIO = 10_000_000
export const TOPE_METROS = 100_000
export const TOPE_AMBIENTES = 50

/**
 * Máximo de operaciones ganadas que se puede fijar como meta del mes.
 *
 * La barra de progreso de Estadísticas divide por este número: una meta
 * desmedida la deja clavada en 0% y el panel deja de decir nada.
 */
export const TOPE_META_MENSUAL = 100

/** Lo que se le dice al usuario cuando un número pasa su techo. */
export const MENSAJE_VALOR_ALTO = 'Ese valor parece demasiado alto, revisalo.'

/**
 * true si el campo tiene algo cargado y ese algo pasa el techo.
 *
 * Vacío devuelve false, igual que `cantidadInvalida`: la ausencia de dato no es
 * un dato inválido. Se separa del piso en vez de unificarlos en una sola
 * función porque el motivo del rechazo cambia el mensaje, y "tiene que ser 1 o
 * más" no le sirve a quien tipeó un cero de más.
 */
export function excedeTope(valor: string, tope: number): boolean {
  if (!valor.trim()) return false
  const n = Number(valor)
  return Number.isFinite(n) && n > tope
}

/**
 * true si los metros cubiertos superan a los totales.
 *
 * Sólo compara cuando los dos tienen un número cargado: con uno solo no hay
 * relación que romper, y con un valor ilegible ya se queja su propio campo.
 */
export function metrosCubiertosExcedidos(cubiertos: string, totales: string): boolean {
  if (!cubiertos.trim() || !totales.trim()) return false
  const c = Number(cubiertos)
  const t = Number(totales)
  if (!Number.isFinite(c) || !Number.isFinite(t)) return false
  return c > t
}

/**
 * true si el campo tiene algo cargado y no es una URL http(s) válida.
 *
 * Se apoya en el constructor `URL` del navegador en vez de una expresión
 * regular: parsea de verdad y no hay que mantener el patrón. El chequeo de
 * protocolo va aparte porque `new URL('javascript:alert(1)')` no tira, y ese
 * valor termina en un `href` que la ficha de la propiedad renderiza.
 */
export function urlInvalida(valor: string): boolean {
  const limpio = valor.trim()
  if (!limpio) return false

  try {
    const url = new URL(limpio)
    return url.protocol !== 'http:' && url.protocol !== 'https:'
  } catch {
    return true
  }
}

/** Lo que se le dice al usuario cuando el link no parece un link. */
export const MENSAJE_URL_INVALIDA =
  'Ingresá un link válido (tiene que empezar con http:// o https://).'
