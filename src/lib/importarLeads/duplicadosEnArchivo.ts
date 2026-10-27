/**
 * Filas que se repiten dentro del mismo archivo.
 *
 * No mira la base: solo detecta que dos filas del archivo son la misma persona
 * (mismo teléfono normalizado o mismo email). Gana la primera.
 */
import type { FilaNormalizada } from './normalizarFilas'

export interface DuplicadoEnArchivo {
  /** Número de fila (del archivo) a la que repite. */
  duplicaA: number
  por: 'TELEFONO' | 'EMAIL'
}

export type FilaConDuplicado = FilaNormalizada & {
  /** null si la fila es la primera de su persona. */
  duplicadoEnArchivo: DuplicadoEnArchivo | null
}

/**
 * Teléfono primero, como en `consulta-publica`. Las filas con errores
 * bloqueantes no participan: no se van a importar, así que no pueden "ganarle"
 * a una fila buena. Una fila marcada duplicada tampoco registra sus datos: se
 * descarta, y lo que traiga no debe marcar a las siguientes.
 */
export function marcarDuplicadosEnArchivo(filas: FilaNormalizada[]): FilaConDuplicado[] {
  const porTelefono = new Map<string, number>()
  const porEmail = new Map<string, number>()

  return filas.map((fila) => {
    if (fila.errores.length > 0) return { ...fila, duplicadoEnArchivo: null }

    // Un teléfono dudoso no se compara: dos "iguales" pueden serlo por azar.
    const telefono = fila.telefonoNorm && !fila.telefonoDudoso ? fila.telefonoNorm : null

    const filaTelefono = telefono ? porTelefono.get(telefono) : undefined
    if (filaTelefono !== undefined) {
      return { ...fila, duplicadoEnArchivo: { duplicaA: filaTelefono, por: 'TELEFONO' } }
    }

    const filaEmail = fila.email ? porEmail.get(fila.email) : undefined
    if (filaEmail !== undefined) {
      return { ...fila, duplicadoEnArchivo: { duplicaA: filaEmail, por: 'EMAIL' } }
    }

    if (telefono) porTelefono.set(telefono, fila.fila)
    if (fila.email) porEmail.set(fila.email, fila.fila)
    return { ...fila, duplicadoEnArchivo: null }
  })
}
