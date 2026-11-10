/**
 * Calendario fijo con el panel del día scrolleando por dentro.
 *
 * Se activa solo por ancho: `lg` (>= 64rem) es donde grilla y panel van lado a
 * lado. Por debajo el layout es el apilado de siempre, sin sticky ni alto máximo.
 * No depende del alto de la ventana: antes exigía >= 48rem y en notebooks (650-720px
 * útiles) el modo fijo nunca se activaba. En su lugar, ambos lados topean su alto
 * a la ventana (`100dvh - 6rem`) y scrollean por dentro si no entran: en una
 * ventana muy baja el mes scrollea unos píxeles en vez de quedar cortado.
 *
 * Qué scrollea: la ventana (ningún ancestro de la grilla tiene overflow, así que
 * el sticky funciona). El header de la app mide 4rem y es sticky; `top-20`
 * (5rem) deja 1rem de aire debajo. El tope de alto descuenta eso más el
 * safe-area de abajo.
 *
 * Sin `overscroll-contain` a propósito: un `overflow-y-auto` es contenedor de scroll
 * aunque no desborde, y con `contain` la rueda quedaba atrapada (sobre el calendario
 * no scrolleaba la página; sobre el panel no salía al llegar al final).
 *
 * Son clases completas y literales a propósito: Tailwind solo genera las que
 * puede leer enteras en el código.
 */

const FIJO =
  'lg:sticky lg:top-20 lg:self-start ' +
  'lg:max-h-[calc(100dvh_-_6rem_-_env(safe-area-inset-bottom))] ' +
  'lg:overflow-y-auto'

/** La grilla (mes o día): se fija arriba. `self-start` evita que el grid la estire. */
export const CLASES_CALENDARIO_FIJO = FIJO

/** El panel del día: también se fija, y scrollea por dentro. */
export const CLASES_PANEL_FIJO = FIJO
