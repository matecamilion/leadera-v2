/**
 * Armadores de datos para los tests del flujo de importación. Todo inventado.
 * Quien los importa tiene que mockear `lib/supabase` (la capa de API lo carga).
 */
import { clasificarFilas, type CupoDeLeads, type DuplicadoEnBase } from '../../../lib/api/importarLeads'
import { marcarDuplicadosEnArchivo } from '../../../lib/importarLeads/duplicadosEnArchivo'
import type { FilaNormalizada } from '../../../lib/importarLeads/normalizarFilas'
import type { Revision } from './revisar'

export function normalizada(n: number, cambios: Partial<FilaNormalizada> = {}): FilaNormalizada {
  return {
    fila: n,
    nombre: `Lead ${n}`,
    apellido: null,
    telefono: null,
    telefonoNorm: null,
    telefonoDudoso: false,
    email: null,
    estado: null,
    origen: null,
    fechaIngreso: null,
    descripcion: null,
    consulta: null,
    avisosDescripcion: [],
    errores: [],
    avisos: [],
    ...cambios,
  }
}

/** Un lead con teléfono confiable: el número sale de la fila para que sean todos distintos. */
export function conTelefono(n: number, cambios: Partial<FilaNormalizada> = {}): FilaNormalizada {
  const telefono = `223 555-${String(1000 + n).padStart(4, '0')}`
  return normalizada(n, { telefono, telefonoNorm: `549223555${1000 + n}`, ...cambios })
}

export function revisionDe({
  filas,
  base = new Map<number, DuplicadoEnBase | null>(),
  cupo = { limite: null, usados: 0 },
}: {
  filas: FilaNormalizada[]
  base?: Map<number, DuplicadoEnBase | null>
  cupo?: CupoDeLeads
}): Revision {
  const marcadas = marcarDuplicadosEnArchivo(filas)
  return { filas: marcadas, clasificacion: clasificarFilas(marcadas, base), cupo }
}
