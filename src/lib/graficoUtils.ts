/**
 * Geometría del gráfico de evolución. Los números son los del original
 * (viewBox 0 0 720 220): el padding izquierdo deja lugar a las etiquetas del
 * eje Y y la baseline no llega a 220 para que el eje X respire.
 */
export const EVOL_ANCHO = 720
export const EVOL_PAD_IZQ = 30
export const EVOL_TOP = 12
export const EVOL_BASELINE = 204

export type PeriodoEvolucion = '7d' | '30d' | '90d' | 'ano'

export const PERIODOS: { valor: PeriodoEvolucion; label: string; dias: number }[] = [
  { valor: '7d', label: '7d', dias: 7 },
  { valor: '30d', label: '30d', dias: 30 },
  { valor: '90d', label: '90d', dias: 90 },
  { valor: 'ano', label: 'Año', dias: 365 },
]

export function diasDelPeriodo(periodo: PeriodoEvolucion): number {
  return PERIODOS.find((p) => p.valor === periodo)?.dias ?? 30
}

/**
 * Cuántos días entran en cada punto del gráfico.
 *
 * A 7 días cada día es un punto; más allá se acumula, si no la línea se vuelve
 * un serrucho ilegible. Mismos tamaños que el original.
 */
export function tamanoGrupo(periodo: PeriodoEvolucion): number {
  switch (periodo) {
    case '7d':
      return 1
    case '30d':
      return 7
    case '90d':
      return 14
    case 'ano':
      return 30
  }
}

export interface DiaEvolucion {
  fecha: string
  nuevos: number
  ganados: number
  perdidos: number
}

export interface GrupoEvolucion {
  nuevos: number
  ganados: number
  perdidos: number
  /** Fecha del primer día del grupo, para el eje X. */
  fecha: string
  /**
   * Último día que entra en el grupo. Igual a `fecha` cuando el grupo es de
   * un solo día. Lo usa el tooltip para mostrar el rango que suma el punto.
   */
  fechaFin: string
}

export type SerieEvolucion = 'nuevos' | 'ganados' | 'perdidos'

/** Suma los días de a bloques del tamaño que pide el período. */
export function agruparPorPeriodo(
  datos: DiaEvolucion[],
  periodo: PeriodoEvolucion,
): GrupoEvolucion[] {
  const tamano = tamanoGrupo(periodo)
  const grupos: GrupoEvolucion[] = []

  for (let i = 0; i < datos.length; i += tamano) {
    let nuevos = 0
    let ganados = 0
    let perdidos = 0
    for (let j = i; j < Math.min(i + tamano, datos.length); j++) {
      nuevos += datos[j].nuevos ?? 0
      ganados += datos[j].ganados ?? 0
      perdidos += datos[j].perdidos ?? 0
    }
    const ultimo = Math.min(i + tamano, datos.length) - 1
    grupos.push({
      nuevos,
      ganados,
      perdidos,
      fecha: datos[i].fecha,
      fechaFin: datos[ultimo].fecha,
    })
  }

  return grupos
}

export interface EscalaY {
  max: number
  ticks: number[]
}

/**
 * Escala del eje Y sobre los valores YA agrupados: el eje refleja las sumas
 * del período, no los máximos diarios.
 *
 * Piso de 3 para que una sola entrada no toque el techo del gráfico. Por
 * encima de 5 se redondea a un múltiplo de 4 para tener ticks parejos.
 */
export function calcularEscalaY(grupos: GrupoEvolucion[]): EscalaY {
  let realMax = 0
  for (const g of grupos) {
    realMax = Math.max(realMax, g.nuevos, g.ganados, g.perdidos)
  }

  const maxY = Math.max(3, realMax)

  if (maxY <= 5) {
    return { max: maxY, ticks: Array.from({ length: maxY + 1 }, (_, i) => i) }
  }

  const paso = Math.ceil(maxY / 4)
  return { max: paso * 4, ticks: [0, paso, paso * 2, paso * 3, paso * 4] }
}

export interface Punto {
  x: number
  y: number
}

/**
 * A diferencia de unas barras (centradas dentro de su grupo), la línea va de
 * punta a punta: el primer punto apoya en el eje Y y el último en el borde.
 */
export function evolX(i: number, cantidadGrupos: number): number {
  if (cantidadGrupos <= 1) return EVOL_PAD_IZQ
  return +(
    EVOL_PAD_IZQ +
    i * ((EVOL_ANCHO - EVOL_PAD_IZQ) / (cantidadGrupos - 1))
  ).toFixed(2)
}

export function evolY(valor: number, max: number): number {
  return +(EVOL_BASELINE - (valor / max) * (EVOL_BASELINE - EVOL_TOP)).toFixed(2)
}

/**
 * Catmull-Rom uniforme convertido a Bézier cúbicas. Para cada tramo p1→p2 los
 * puntos de control salen de los vecinos (p0 y p3), lo que da una curva
 * continua que pasa exactamente por todos los puntos.
 *
 * yMin/yMax acotan los puntos de control: Catmull-Rom sobrepasa en picos
 * bruscos y sin el clamp el relleno del área se escapa de la baseline.
 */
export function smoothPath(puntos: Punto[], yMin: number, yMax: number): string {
  const n = puntos.length
  if (n === 0) return ''
  if (n === 1) return `M ${puntos[0].x} ${puntos[0].y}`

  const clampY = (y: number) => +Math.min(yMax, Math.max(yMin, y)).toFixed(2)

  let d = `M ${puntos[0].x} ${puntos[0].y}`
  for (let i = 0; i < n - 1; i++) {
    const p0 = puntos[i - 1] ?? puntos[i]
    const p1 = puntos[i]
    const p2 = puntos[i + 1]
    const p3 = puntos[i + 2] ?? p2

    const cp1x = +(p1.x + (p2.x - p0.x) / 6).toFixed(2)
    const cp1y = clampY(p1.y + (p2.y - p0.y) / 6)
    const cp2x = +(p2.x - (p3.x - p1.x) / 6).toFixed(2)
    const cp2y = clampY(p2.y - (p3.y - p1.y) / 6)

    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`
  }
  return d
}

/**
 * El `d` de una serie. Con `area` en true cierra contra la baseline para que
 * se pueda rellenar.
 */
export function generarPathLinea(puntos: Punto[], area: boolean): string {
  const n = puntos.length
  if (n === 0) return ''

  let d = smoothPath(puntos, EVOL_TOP, EVOL_BASELINE)
  if (area) {
    d += ` L ${puntos[n - 1].x} ${EVOL_BASELINE} L ${puntos[0].x} ${EVOL_BASELINE} Z`
  }
  return d
}

/** Puntos de una serie ya escalados al viewBox. */
export function puntosDeSerie(
  grupos: GrupoEvolucion[],
  serie: SerieEvolucion,
  max: number,
): Punto[] {
  return grupos.map((g, i) => ({ x: evolX(i, grupos.length), y: evolY(g[serie], max) }))
}

/** "05 ago" a partir del `YYYY-MM-DD` que devuelve la función SQL. */
export function formatearFechaCorta(iso: string): string {
  // Se parsea a mano: `new Date('2026-08-05')` se interpreta como UTC y en
  // GMT-3 muestra el día anterior.
  const [ano, mes, dia] = iso.split('-').map(Number)
  if (!ano || !mes || !dia) return ''
  return new Date(ano, mes - 1, dia).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
  })
}

/**
 * Etiquetas del eje X. A 7 días son cuatro fechas espaciadas —igual que el
 * original—; agrupado, la fecha del primer día de cada grupo, con un máximo
 * de 5 para que no se pisen entre sí.
 */
export function etiquetasEjeX(
  datos: DiaEvolucion[],
  periodo: PeriodoEvolucion,
): string[] {
  if (datos.length === 0) return []

  const tamano = tamanoGrupo(periodo)

  if (tamano === 1) {
    const indices = [
      0,
      Math.floor(datos.length * 0.25),
      Math.floor(datos.length * 0.5),
      Math.floor(datos.length * 0.75),
    ]
    return indices.map((i) => formatearFechaCorta(datos[i].fecha))
  }

  const cantidadGrupos = Math.ceil(datos.length / tamano)
  const paso = Math.ceil(cantidadGrupos / 5)
  const etiquetas: string[] = []
  for (let g = 0; g < cantidadGrupos; g += paso) {
    etiquetas.push(formatearFechaCorta(datos[g * tamano].fecha))
  }
  return etiquetas
}

/**
 * Índice del punto más cercano a una posición horizontal.
 *
 * `x` y `puntosX` tienen que estar en la misma unidad —los dos en coordenadas
 * del viewBox, o los dos en píxeles—; la función no convierte nada.
 *
 * Devuelve el más cercano y no el anterior: sobre un gráfico de líneas, el
 * punto que uno "está mirando" es el que tiene el cursor más cerca, aunque lo
 * haya pasado por unos píxeles.
 */
export function indiceMasCercano(x: number, puntosX: number[]): number {
  if (puntosX.length === 0) return -1

  let mejor = 0
  let menorDistancia = Math.abs(puntosX[0] - x)

  for (let i = 1; i < puntosX.length; i++) {
    const distancia = Math.abs(puntosX[i] - x)
    if (distancia < menorDistancia) {
      menorDistancia = distancia
      mejor = i
    }
  }

  return mejor
}

/**
 * Fecha o rango de un grupo, para el encabezado del tooltip.
 *
 * A 7 días cada punto es un día suelto y alcanza con la fecha. Agrupado, el
 * punto suma varios días y mostrar sólo el primero haría creer que el valor
 * es de esa jornada.
 */
export function etiquetaRangoGrupo(grupo: GrupoEvolucion): string {
  const desde = formatearFechaCorta(grupo.fecha)
  if (grupo.fechaFin === grupo.fecha) return desde
  return `${desde} – ${formatearFechaCorta(grupo.fechaFin)}`
}
