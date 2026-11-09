/**
 * Reparto en columnas de los eventos de un día que se pisan. Puro.
 *
 * Los eventos que se superponen se dibujan lado a lado dentro de su franja
 * horaria, sin taparse. Un GRUPO es un conjunto de eventos encadenados por
 * superposición: A pisa a B y B pisa a C forman un grupo aunque A y C no se pisen.
 * Todos los del grupo comparten la misma cantidad de columnas, así el ancho de
 * cada bloque es parejo dentro de la cadena.
 *
 * Los tiempos son minutos desde la medianoche, de 0 a 1440.
 */

/** Las 24:00: nada se dibuja más abajo. */
export const MINUTOS_DEL_DIA = 24 * 60

export interface Intervalo {
  /** Minutos desde las 00:00. */
  inicio: number
  /** Minutos desde las 00:00. Se recorta a las 24:00. */
  fin: number
}

export interface Ubicacion {
  /** Columna del evento dentro de su grupo, desde 0. */
  columna: number
  /** Cuántas columnas tiene el grupo del evento. */
  columnas: number
}

/**
 * Columna y cantidad de columnas de cada intervalo, en el mismo orden de entrada.
 *
 * Reglas:
 *  - Dos eventos se superponen si cada uno empieza antes de que termine el otro.
 *    Si el fin de uno es justo el inicio del otro, NO se superponen.
 *  - Un evento que cruzaría la medianoche se recorta a las 24:00. Dura al menos un
 *    minuto, para que un intervalo vacío no desaparezca ni se pise sin querer.
 *  - Cada evento va a la primera columna libre del grupo (la más a la izquierda).
 *  - Desempate estable: a igual inicio, el que vino antes en la entrada queda más
 *    a la izquierda. La misma entrada da siempre el mismo reparto.
 */
export function columnasSuperpuestas(intervalos: readonly Intervalo[]): Ubicacion[] {
  const resultado: Ubicacion[] = intervalos.map(() => ({ columna: 0, columnas: 1 }))

  const orden = intervalos
    .map((iv, indice) => ({
      indice,
      inicio: iv.inicio,
      fin: Math.max(Math.min(iv.fin, MINUTOS_DEL_DIA), iv.inicio + 1),
    }))
    .sort((a, b) => a.inicio - b.inicio || a.indice - b.indice)

  let grupo: number[] = []
  let finDelGrupo = Number.NEGATIVE_INFINITY
  // Hasta cuándo está ocupada cada columna del grupo en curso.
  let finPorColumna: number[] = []

  function cerrarGrupo() {
    for (const indice of grupo) resultado[indice].columnas = finPorColumna.length
    grupo = []
    finDelGrupo = Number.NEGATIVE_INFINITY
    finPorColumna = []
  }

  for (const { indice, inicio, fin } of orden) {
    // Empieza cuando el grupo ya terminó (o justo ahí): es otro grupo.
    if (grupo.length > 0 && inicio >= finDelGrupo) cerrarGrupo()

    let columna = finPorColumna.findIndex((libreDesde) => libreDesde <= inicio)
    if (columna === -1) columna = finPorColumna.length
    finPorColumna[columna] = fin

    resultado[indice].columna = columna
    grupo.push(indice)
    finDelGrupo = Math.max(finDelGrupo, fin)
  }
  cerrarGrupo()

  return resultado
}
