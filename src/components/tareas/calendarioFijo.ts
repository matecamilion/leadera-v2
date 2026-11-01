/**
 * Calendario fijo con el panel del día scrolleando por dentro.
 *
 * Solo cuando se cumplen las dos condiciones a la vez:
 *  - ancho >= 64rem (el breakpoint `lg`, donde grilla y panel van lado a lado), y
 *  - alto >= 48rem (768px): en pantallas más bajas el calendario no entra
 *    completo y fijarlo lo dejaría cortado.
 * Debajo de eso el layout es el apilado de siempre, sin sticky ni alto máximo.
 *
 * Qué scrollea: la ventana (ningún ancestro de la grilla tiene overflow, así que
 * el sticky funciona). El header de la app mide 4rem y es sticky; `top-20`
 * (5rem) deja 1rem de aire debajo. El panel cabe en `100dvh - 6rem`, más el
 * safe-area de abajo.
 *
 * Son clases completas y literales a propósito: Tailwind solo genera las que
 * puede leer enteras en el código.
 */

/** La grilla: se fija arriba. `self-start` evita que el grid la estire. */
export const CLASES_CALENDARIO_FIJO =
  '[@media(min-width:64rem)_and_(min-height:48rem)]:sticky ' +
  '[@media(min-width:64rem)_and_(min-height:48rem)]:top-20 ' +
  '[@media(min-width:64rem)_and_(min-height:48rem)]:self-start'

/** El panel del día: también se fija, y scrollea por dentro. */
export const CLASES_PANEL_FIJO =
  '[@media(min-width:64rem)_and_(min-height:48rem)]:sticky ' +
  '[@media(min-width:64rem)_and_(min-height:48rem)]:top-20 ' +
  '[@media(min-width:64rem)_and_(min-height:48rem)]:self-start ' +
  '[@media(min-width:64rem)_and_(min-height:48rem)]:max-h-[calc(100dvh_-_6rem_-_env(safe-area-inset-bottom))] ' +
  '[@media(min-width:64rem)_and_(min-height:48rem)]:overflow-y-auto ' +
  '[@media(min-width:64rem)_and_(min-height:48rem)]:overscroll-contain'
