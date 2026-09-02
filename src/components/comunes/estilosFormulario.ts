/**
 * Clases compartidas por input, select y textarea de los formularios de alta.
 *
 * Vive en su propio archivo y no junto a los componentes porque mezclar
 * constantes con componentes rompe el fast refresh de Vite.
 */

/**
 * Todo el look del control menos el ancho.
 *
 * El ancho va aparte porque `w-full` no se puede pisar desde el `class` del
 * componente: Tailwind resuelve el empate entre dos utilidades de la misma
 * especificidad por el orden en la hoja compilada, no por el orden en que se
 * escriben, y ahí `.w-full` cae después de `.w-24`. Un select de moneda con
 * `${CLASES_CONTROL} w-24` terminaba midiendo el 100% del contenedor.
 */
const BASE_CONTROL = [
  'rounded-xl border border-border bg-surface-2 px-4 py-3.5',
  'text-base text-ink placeholder:text-ink-3',
  'transition-colors focus:border-primary focus:bg-surface focus:shadow-focus',
  'focus:outline-none motion-reduce:transition-none',
].join(' ')

/** El control de ancho completo: lo que usa la mayoría de los campos. */
export const CLASES_CONTROL = `w-full ${BASE_CONTROL}`

/**
 * Variante sin ancho, para los controles que traen el suyo.
 *
 * Hoy la usa el select de moneda que va pegado al input de precio/monto, con
 * un `w-24 shrink-0` propio.
 */
export const CLASES_CONTROL_SIN_ANCHO = BASE_CONTROL
