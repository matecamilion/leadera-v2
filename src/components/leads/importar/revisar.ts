import {
  armarPedidoDeVerificacion,
  clasificarFilas,
  verificarDuplicados,
  type ClasificacionDeFilas,
  type CupoDeLeads,
} from '../../../lib/api/importarLeads'
import {
  marcarDuplicadosEnArchivo,
  type FilaConDuplicado,
} from '../../../lib/importarLeads/duplicadosEnArchivo'
import type { ArchivoLeido } from '../../../lib/importarLeads/leerArchivo'
import type { MapeoColumnas } from '../../../lib/importarLeads/mapeoColumnas'
import { normalizarFilas } from '../../../lib/importarLeads/normalizarFilas'

/** Todo lo que el paso 3 necesita para mostrarse. Se calcula de una vez. */
export interface Revision {
  /** Todas las filas del archivo, normalizadas y con los duplicados del archivo marcados. */
  filas: FilaConDuplicado[]
  clasificacion: ClasificacionDeFilas
  cupo: CupoDeLeads
}

/**
 * Normaliza todo el archivo, marca lo repetido dentro de él y consulta a la
 * cuenta cuáles ya existen y cuánto cupo queda.
 *
 * A la función solo le llegan las filas que de verdad hay que comparar: una fila
 * con error o repetida en el archivo no se importa pase lo que pase. Se llama
 * igual si no queda ninguna, porque el cupo se necesita de todos modos.
 *
 * Lanza si la verificación falla: no se avanza sin respuesta.
 */
export async function prepararRevision(archivo: ArchivoLeido, mapeo: MapeoColumnas): Promise<Revision> {
  const filas = marcarDuplicadosEnArchivo(normalizarFilas(archivo.filas, mapeo))
  const aComparar = filas.filter((f) => f.errores.length === 0 && !f.duplicadoEnArchivo)

  const { duplicados, cupo } = await verificarDuplicados(armarPedidoDeVerificacion(aComparar))

  return { filas, clasificacion: clasificarFilas(filas, duplicados), cupo }
}
