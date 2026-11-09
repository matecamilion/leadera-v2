/**
 * Ancla y rango visible del calendario. Puro: sin React ni Supabase.
 *
 * El calendario se ubica con una fecha ancla (`YYYY-MM-DD`) y una vista. De esas
 * dos cosas salen el rango que se pide y lo que se muestra. Por ahora la única
 * vista es el mes.
 *
 * Todo en hora local y con claves de día, como `lib/calendario`: `new Date('2026-08-05')`
 * se interpreta como UTC y en GMT-3 cae el día anterior, así que el parseo va a mano.
 * La semana empieza el lunes, igual que la grilla mensual.
 */
import { claveDia, desdeClaveDia, diasDeLaGrilla } from './calendario'

export type VistaCalendario = 'MES'

/** El día `n` días después de `clave` (negativo: antes), con el cambio de mes y de año. */
export function sumarDias(clave: string, n: number): string {
  const d = desdeClaveDia(clave)
  return claveDia(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n))
}

/**
 * El día 1 del mes que queda `n` meses después del de `clave`.
 *
 * Siempre el 1 y no "el mismo día del mes siguiente": desde el 31 de enero, sumar
 * un mes caería el 3 de marzo y se saltaría febrero. Moverse de a meses es
 * moverse entre meses, y la grilla del mes no depende del día.
 */
export function sumarMeses(clave: string, n: number): string {
  const d = desdeClaveDia(clave)
  return claveDia(new Date(d.getFullYear(), d.getMonth() + n, 1))
}

/** El lunes de la semana de `clave`. */
export function inicioDeSemana(clave: string): string {
  const d = desdeClaveDia(clave)
  // `getDay()` da 0 para domingo: se recalibra a lunes = 0.
  return sumarDias(clave, -((d.getDay() + 6) % 7))
}

/** El domingo de la semana de `clave`. */
export function finDeSemana(clave: string): string {
  return sumarDias(inicioDeSemana(clave), 6)
}

/** El mes de la ancla: `mes` va de 0 a 11, como `Date.getMonth()`. */
export function mesDeAncla(ancla: string): { ano: number; mes: number } {
  const d = desdeClaveDia(ancla)
  return { ano: d.getFullYear(), mes: d.getMonth() }
}

/**
 * El rango de días que hay que pedir para pintar la vista.
 *
 * En el mes es el de la grilla completa, con el relleno de lunes a domingo (no el
 * del mes a secas): si no, los días de relleno saldrían vacíos aunque tengan eventos.
 */
export function rangoVisible(
  vista: VistaCalendario,
  ancla: string,
): { desde: string; hasta: string } {
  switch (vista) {
    case 'MES': {
      const { ano, mes } = mesDeAncla(ancla)
      const dias = diasDeLaGrilla(ano, mes)
      return { desde: claveDia(dias[0]), hasta: claveDia(dias[dias.length - 1]) }
    }
  }
}
