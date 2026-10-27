import type { ResultadoDeImportacion } from '../../../lib/api/importarLeads'
import type { ArchivoLeido } from '../../../lib/importarLeads/leerArchivo'
import { sugerirMapeo, type MapeoColumnas } from '../../../lib/importarLeads/mapeoColumnas'
import type { Revision } from './revisar'

/**
 * El estado de toda la página, en memoria: ni localStorage ni el store global.
 * Recargar empieza de cero, que es lo que se espera de un archivo.
 */
export interface Estado {
  paso: 1 | 2 | 3 | 4
  leyendo: boolean
  error: string | null
  nombreArchivo: string | null
  archivo: ArchivoLeido | null
  mapeo: MapeoColumnas
  /** Revisando duplicados (paso 2 → 3). Mientras dura no se avanza. */
  verificando: boolean
  errorVerificacion: string | null
  revision: Revision | null
  /** Importando de verdad (paso 4). */
  importando: boolean
  progreso: { procesadas: number; total: number } | null
  resultado: ResultadoDeImportacion | null
}

export type Accion =
  | { tipo: 'leyendo' }
  | { tipo: 'cargado'; nombre: string; archivo: ArchivoLeido }
  | { tipo: 'fallo'; mensaje: string }
  | { tipo: 'reiniciar' }
  | { tipo: 'paso'; paso: 1 | 2 }
  | { tipo: 'mapear'; mapeo: MapeoColumnas }
  | { tipo: 'verificando' }
  | { tipo: 'verificado'; revision: Revision }
  | { tipo: 'fallaVerificacion'; mensaje: string }
  | { tipo: 'importar'; total: number }
  | { tipo: 'progreso'; procesadas: number; total: number }
  | { tipo: 'terminado'; resultado: ResultadoDeImportacion }

export const INICIAL: Estado = {
  paso: 1,
  leyendo: false,
  error: null,
  nombreArchivo: null,
  archivo: null,
  mapeo: {},
  verificando: false,
  errorVerificacion: null,
  revision: null,
  importando: false,
  progreso: null,
  resultado: null,
}

export function reducir(estado: Estado, accion: Accion): Estado {
  switch (accion.tipo) {
    case 'leyendo':
      return { ...estado, leyendo: true, error: null }

    case 'cargado':
      return {
        ...INICIAL,
        nombreArchivo: accion.nombre,
        archivo: accion.archivo,
        // Un archivo nuevo arranca con la propuesta de columnas, no con la del anterior.
        mapeo: sugerirMapeo(accion.archivo.encabezados).mapeo,
      }

    case 'fallo':
      // Un archivo que no se pudo leer no pisa el que ya estaba cargado.
      return { ...estado, leyendo: false, error: accion.mensaje }

    case 'reiniciar':
      return INICIAL

    case 'paso':
      // Solo se vuelve a los pasos 1 y 2, nunca desde la importación en curso o
      // terminada: reimportar duplicaría los leads. La revisión se descarta; se
      // recalcula al continuar.
      if (estado.paso === 4 || estado.importando) return estado
      return { ...estado, paso: accion.paso, revision: null, verificando: false, errorVerificacion: null }

    case 'mapear':
      return { ...estado, mapeo: accion.mapeo, errorVerificacion: null }

    case 'verificando':
      return { ...estado, verificando: true, errorVerificacion: null }

    case 'verificado':
      // Una respuesta que llega cuando ya no se está esperando (se reinició todo) se descarta.
      if (!estado.verificando) return estado
      return { ...estado, paso: 3, verificando: false, errorVerificacion: null, revision: accion.revision }

    case 'fallaVerificacion':
      if (!estado.verificando) return estado
      // Se queda en el paso 2: nunca se avanza sin respuesta.
      return { ...estado, verificando: false, errorVerificacion: accion.mensaje }

    case 'importar':
      if (estado.importando || estado.paso !== 3) return estado
      return {
        ...estado,
        paso: 4,
        importando: true,
        progreso: { procesadas: 0, total: accion.total },
        resultado: null,
      }

    case 'progreso':
      if (!estado.importando) return estado
      return { ...estado, progreso: { procesadas: accion.procesadas, total: accion.total } }

    case 'terminado':
      return { ...estado, importando: false, resultado: accion.resultado }
  }
}
