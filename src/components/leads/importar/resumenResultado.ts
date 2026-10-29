import type { ResultadoDeImportacion } from '../../../lib/api/importarLeads'
import type { Revision } from './revisar'

export interface FilaDetalle {
  fila: number
  nombre: string
  motivo: string
}

export interface ResumenDeResultado {
  importados: number
  /** Ya en la cuenta (por teléfono o email) + las que la base rechazó por email. */
  omitidosPorDuplicado: number
  /**
   * Filas repetidas dentro del archivo (la misma persona consultando varias
   * veces): no se pierden, sus consultas se fusionaron en un solo lead.
   */
  consultasFusionadas: number
  /** Errores de validación del front + ERROR de la base. */
  conError: number
  fueraPorLimite: number
  /** Filas que no se llegaron a procesar por un corte. */
  sinProcesar: number
  detalleDeErrores: FilaDetalle[]
  /** Por qué no entró ningún lead, para el caso de 0 insertados. */
  motivoPrincipal: string | null
}

/**
 * Junta lo que se omitió antes de importar (la revisión) con lo que devolvió la
 * base, para el resumen final.
 */
export function resumirResultado(revision: Revision, resultado: ResultadoDeImportacion): ResumenDeResultado {
  const { clasificacion } = revision
  const nombres = new Map(revision.filas.map((f) => [f.fila, f.nombre]))
  const cuenta = (tipo: string) => resultado.resultados.filter((r) => r.resultado === tipo)

  const duplicadasPorCarrera = cuenta('EMAIL_DUPLICADO').length
  const erroresDeLaBase = cuenta('ERROR')
  const fueraPorLimite = cuenta('LIMITE_ALCANZADO').length

  const omitidosPorDuplicado =
    clasificacion.conteos.duplicadasEnBasePorTelefono +
    clasificacion.conteos.duplicadasEnBasePorEmail +
    duplicadasPorCarrera

  const detalleDeErrores: FilaDetalle[] = [
    ...clasificacion.conError.map((f) => ({ fila: f.fila, nombre: f.nombre, motivo: f.errores.join(' ') })),
    ...erroresDeLaBase.map((r) => ({
      fila: r.fila,
      nombre: nombres.get(r.fila) ?? '',
      motivo: r.mensaje ?? 'No se pudo guardar esta fila.',
    })),
  ]

  const resumen: ResumenDeResultado = {
    importados: resultado.insertados,
    omitidosPorDuplicado,
    consultasFusionadas: clasificacion.conteos.duplicadasEnArchivo,
    conError: detalleDeErrores.length,
    fueraPorLimite,
    sinProcesar: resultado.corte?.filasSinProcesar.length ?? 0,
    detalleDeErrores,
    motivoPrincipal: null,
  }

  if (resultado.insertados === 0 && !resultado.corte) {
    resumen.motivoPrincipal = motivoDeCeroImportados(resumen)
  }
  return resumen
}

function motivoDeCeroImportados(r: ResumenDeResultado): string {
  const causas: [number, string][] = [
    [r.fueraPorLimite, 'tu plan no tiene lugar para más leads'],
    [r.omitidosPorDuplicado + r.consultasFusionadas, 'todas las filas ya estaban en tu cuenta o se repetían en el archivo'],
    [r.conError, 'las filas tenían errores'],
  ]
  const [mayor] = [...causas].sort((a, b) => b[0] - a[0])
  if (mayor[0] === 0) return 'El archivo no tenía filas para importar.'
  return `Lo principal: ${mayor[1]}.`
}
