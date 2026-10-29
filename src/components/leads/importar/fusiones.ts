import type { FilaConDuplicado } from '../../../lib/importarLeads/duplicadosEnArchivo'

/** Un lead que juntó varias consultas del archivo, listo para mostrarse. */
export interface LeadConFusion {
  /** La fila de la primera consulta (la que da los datos personales). */
  fila: number
  nombre: string
  /** Cuántas consultas se juntaron en él, la primera incluida. */
  consultas: number
  /** Las filas del archivo que se juntaron, en orden. */
  filas: number[]
  /** La descripción ya fusionada, tal como se va a guardar. */
  descripcion: string | null
}

/**
 * Los leads que juntan más de una fila del archivo. Solo agrupa lo que
 * `marcarDuplicadosEnArchivo` ya decidió (a qué fila repite cada una y cuántas
 * se le fusionaron): no recalcula ninguna regla.
 */
export function leadsConFusiones(filas: FilaConDuplicado[]): LeadConFusion[] {
  return filas
    .filter((f) => f.duplicadoEnArchivo === null && f.errores.length === 0 && f.consultasFusionadas > 0)
    .map((lider) => ({
      fila: lider.fila,
      nombre: lider.nombre,
      consultas: lider.consultasFusionadas + 1,
      filas: [
        lider.fila,
        ...filas.filter((f) => f.duplicadoEnArchivo?.duplicaA === lider.fila).map((f) => f.fila),
      ].sort((a, b) => a - b),
      descripcion: lider.descripcion,
    }))
}

/** "41", "41 y 42", "41, 42 y 47". */
export function listarFilas(filas: number[]): string {
  if (filas.length <= 1) return filas.join('')
  return `${filas.slice(0, -1).join(', ')} y ${filas[filas.length - 1]}`
}
