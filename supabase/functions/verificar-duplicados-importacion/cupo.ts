/**
 * El cupo de leads de la cuenta y la forma de la respuesta.
 *
 * Puro, sin I/O: `index.ts` lee la base y esto arma lo que se devuelve.
 */
import type { ResultadoFila } from './logica.ts'

export interface Cupo {
  /** null = sin tope (sin plan, sin fila de límites o plan sin límite). */
  limite: number | null
  usados: number
}

export interface RespuestaVerificacion {
  resultados: ResultadoFila[]
  cupo: Cupo
}

/**
 * Mismo criterio que `leads_verificar_limite`: sin plan o sin tope no
 * restringe. Cualquier cosa que no sea un número no negativo cuenta como "sin
 * tope", y no como 0: un 0 bloquearía toda importación por un dato ilegible.
 *
 * No se recorta nada: si ya hay más usados que el límite, se devuelven los dos
 * números tal cual y la pantalla decide qué mostrar.
 */
export function calcularCupo(usados: number, limite: number | null | undefined): Cupo {
  const tope =
    typeof limite === 'number' && Number.isFinite(limite) && limite >= 0 ? limite : null
  return { limite: tope, usados }
}

/**
 * Lo único que sale de la función: `resultados` y `cupo`, con los campos
 * nombrados a mano para que un campo nuevo en cualquiera de los dos objetos de
 * entrada (ids, datos de leads) no viaje por accidente.
 */
export function armarRespuesta(resultados: ResultadoFila[], cupo: Cupo): RespuestaVerificacion {
  return {
    resultados: resultados.map(({ fila, duplicado }) => ({ fila, duplicado })),
    cupo: { limite: cupo.limite, usados: cupo.usados },
  }
}
