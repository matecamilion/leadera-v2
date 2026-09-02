/**
 * Fechas y geometría del calendario. Sin dependencias: ni Supabase ni React.
 *
 * Todo se maneja con claves `YYYY-MM-DD` en hora local. `new Date('2026-08-05')`
 * se interpreta como UTC y en GMT-3 muestra el día anterior, así que el parseo
 * va a mano en todos lados.
 */

/** `YYYY-MM-DD` de una fecha, en hora local. */
export function claveDia(fecha: Date): string {
  const aaaa = fecha.getFullYear()
  const mm = String(fecha.getMonth() + 1).padStart(2, '0')
  const dd = String(fecha.getDate()).padStart(2, '0')
  return `${aaaa}-${mm}-${dd}`
}

/** Parsea `YYYY-MM-DD` a un Date local. */
export function desdeClaveDia(clave: string): Date {
  const [ano, mes, dia] = clave.split('-').map(Number)
  return new Date(ano, mes - 1, dia)
}

/**
 * Días de la grilla mensual: el mes completo más el relleno para que arranque
 * un lunes y termine un domingo.
 *
 * `getDay()` devuelve 0 para domingo, así que se recalibra a lunes = 0.
 */
export function diasDeLaGrilla(ano: number, mes: number): Date[] {
  const primero = new Date(ano, mes, 1)
  const desplazamiento = (primero.getDay() + 6) % 7

  const inicio = new Date(ano, mes, 1 - desplazamiento)
  const ultimo = new Date(ano, mes + 1, 0)
  const relleno = (7 - ((desplazamiento + ultimo.getDate()) % 7)) % 7
  const total = desplazamiento + ultimo.getDate() + relleno

  return Array.from({ length: total }, (_, i) => {
    const d = new Date(inicio)
    d.setDate(inicio.getDate() + i)
    return d
  })
}

// ---------------------------------------------------------------------------
// Fechas "hacia futuro": lo que se agenda no puede quedar en el pasado.
//
// El corte es por DÍA y con hoy incluido: agendar hoy más tarde es válido, y
// una hora que ya pasó dentro de hoy no se rechaza (la regla del negocio mira
// el día, no el reloj).
// ---------------------------------------------------------------------------

/** Hoy como `YYYY-MM-DD` local. Sirve de `min` en un <input type="date">. */
export function hoyComoClave(): string {
  return claveDia(new Date())
}

/** Hoy a las 00:00 local, en el formato de un <input type="datetime-local">. */
export function hoyComoMinimoLocal(): string {
  return `${hoyComoClave()}T00:00`
}

/** true si la clave `YYYY-MM-DD` cae antes de hoy. */
export function esDiaPasado(clave: string): boolean {
  return clave < hoyComoClave()
}

/**
 * true si el valor de un <input type="datetime-local"> cae en un día anterior
 * a hoy. Se compara la parte de fecha, no el instante.
 */
export function esMomentoDeDiaPasado(valor: string): boolean {
  return valor.slice(0, 10) < hoyComoClave()
}

/**
 * true si el valor de un <input type="datetime-local"> ya pasó, comparado
 * contra el reloj y no contra el día.
 *
 * Hermana estricta de `esMomentoDeDiaPasado`, no su reemplazo. Aquella deja
 * pasar una hora que ya pasó dentro de hoy porque la regla de arriba mira el
 * día; ésta no. Las dos conviven a propósito: la laxa es la que usan el alta de
 * lead y el seguimiento de la operación, donde "hoy" alcanza como precisión, y
 * la estricta es para donde el agente elige una hora concreta y agendar para
 * atrás no significa nada.
 *
 * Un valor que no parsea devuelve false: lo rechaza el input, no esto, y
 * bloquear por un texto ilegible dejaría el formulario trabado sin explicación.
 */
export function esMomentoPasado(valor: string): boolean {
  const fecha = new Date(valor)
  if (Number.isNaN(fecha.getTime())) return false
  return fecha.getTime() < Date.now()
}
