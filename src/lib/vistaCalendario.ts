/**
 * Ancla y rango visible del calendario. Puro: sin React ni Supabase.
 *
 * El calendario se ubica con una fecha ancla (`YYYY-MM-DD`) y una vista. De esas
 * dos cosas salen el rango que se pide y lo que se muestra. Hay dos vistas: el
 * mes y el día.
 *
 * Todo en hora local y con claves de día, como `lib/calendario`: `new Date('2026-08-05')`
 * se interpreta como UTC y en GMT-3 cae el día anterior, así que el parseo va a mano.
 * La semana empieza el lunes, igual que la grilla mensual.
 */
import { claveDia, desdeClaveDia, diasDeLaGrilla } from './calendario'

export type VistaCalendario = 'MES' | 'SEMANA' | 'DIA'

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

/** Los 7 días de la semana de `clave`, de lunes a domingo. */
export function diasDeLaSemana(clave: string): string[] {
  const lunes = inicioDeSemana(clave)
  return Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i))
}

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/**
 * El título de la semana de `clave` como rango abreviado. `completo` lleva el año
 * ("9 – 15 nov 2026", "30 nov – 6 dic 2026"); `corto` lo omite para pantallas
 * chicas. Si la semana cruza de año, los dos años van siempre ("28 dic 2026 – 3 ene
 * 2027"), porque sin ellos el rango sería ambiguo.
 */
export function tituloDeSemana(clave: string): { corto: string; completo: string } {
  const lunes = desdeClaveDia(inicioDeSemana(clave))
  const domingo = desdeClaveDia(finDeSemana(clave))
  const mesLunes = MESES_CORTOS[lunes.getMonth()]
  const mesDomingo = MESES_CORTOS[domingo.getMonth()]

  if (lunes.getFullYear() !== domingo.getFullYear()) {
    const cruzaAno = `${lunes.getDate()} ${mesLunes} ${lunes.getFullYear()} – ${domingo.getDate()} ${mesDomingo} ${domingo.getFullYear()}`
    return { corto: cruzaAno, completo: cruzaAno }
  }
  const corto =
    lunes.getMonth() === domingo.getMonth()
      ? `${lunes.getDate()} – ${domingo.getDate()} ${mesDomingo}`
      : `${lunes.getDate()} ${mesLunes} – ${domingo.getDate()} ${mesDomingo}`
  return { corto, completo: `${corto} ${domingo.getFullYear()}` }
}

/**
 * Dónde queda el calendario al cambiar de vista, conservando un día coherente.
 *
 * Desde el mes (donde la ancla y el día seleccionado son independientes) se pasa
 * al día seleccionado si cae en el mes que se veía; si no, al de la ancla. Desde
 * la semana o el día se conserva el día seleccionado. En todos los casos la ancla
 * queda en ese día, así el mes, la semana y el día que se muestran lo contienen.
 */
export function ubicarAlCambiarVista(
  de: VistaCalendario,
  ancla: string,
  diaSel: string,
): { ancla: string; diaSel: string } {
  let dia = diaSel
  if (de === 'MES') {
    const mesAncla = mesDeAncla(ancla)
    const mesSel = mesDeAncla(diaSel)
    if (mesSel.ano !== mesAncla.ano || mesSel.mes !== mesAncla.mes) dia = ancla
  }
  return { ancla: dia, diaSel: dia }
}

/** El mes de la ancla: `mes` va de 0 a 11, como `Date.getMonth()`. */
export function mesDeAncla(ancla: string): { ano: number; mes: number } {
  const d = desdeClaveDia(ancla)
  return { ano: d.getFullYear(), mes: d.getMonth() }
}

/**
 * La ancla después de apretar ‹ o › (`delta` = -1 o 1): un mes en el mes, siete
 * días en la semana y un día en el día.
 */
export function moverAncla(vista: VistaCalendario, ancla: string, delta: number): string {
  switch (vista) {
    case 'MES':
      return sumarMeses(ancla, delta)
    case 'SEMANA':
      return sumarDias(ancla, 7 * delta)
    case 'DIA':
      return sumarDias(ancla, delta)
  }
}

/**
 * El rango de días que hay que pedir para pintar la vista.
 *
 * En el mes es el de la grilla completa, con el relleno de lunes a domingo (no el
 * del mes a secas): si no, los días de relleno saldrían vacíos aunque tengan eventos.
 * En la semana es de lunes a domingo. En el día es el día de la ancla, de los dos lados.
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
    case 'SEMANA':
      return { desde: inicioDeSemana(ancla), hasta: finDeSemana(ancla) }
    case 'DIA':
      return { desde: ancla, hasta: ancla }
  }
}
