/**
 * Qué filas de un archivo ya existen en la base de leads de la cuenta.
 *
 * Pura: sin I/O. `index.ts` trae los leads y esto decide. Mismo criterio que
 * `consulta-publica/duplicados.ts`: teléfono normalizado primero y, si no hay
 * match, email sin distinguir mayúsculas (el de `leads_email_unico_por_inmobiliaria`).
 */
import { esTelefonoConfiable, normalizarTelefonoAR } from '../_shared/telefono.ts'

export interface FilaAVerificar {
  fila: number
  telefono: string | null
  email: string | null
}

/** Lo único que se lee de un lead existente: no hace falta más para comparar. */
export interface LeadExistente {
  telefono: string | null
  email: string | null
}

export type TipoDuplicado = 'telefono' | 'email'

export interface ResultadoFila {
  fila: number
  duplicado: TipoDuplicado | null
}

/** Minúsculas y sin espacios en los bordes; vacío es null (no se compara). */
function normalizarEmail(email: string | null | undefined): string | null {
  const limpio = email?.trim().toLowerCase()
  return limpio ? limpio : null
}

/**
 * El teléfono normalizado, o null si no es confiable. Un teléfono dudoso (un
 * extranjero, uno con dígitos de menos) no se compara: dos "iguales" pueden
 * serlo por azar y marcarían como duplicado a quien no lo es.
 */
function telefonoComparable(telefono: string | null | undefined): string | null {
  if (!telefono || !esTelefonoConfiable(telefono)) return null
  return normalizarTelefonoAR(telefono)
}

export function verificarDuplicados(
  filas: FilaAVerificar[],
  existentes: LeadExistente[],
): ResultadoFila[] {
  const telefonos = new Set<string>()
  const emails = new Set<string>()

  for (const lead of existentes) {
    const telefono = telefonoComparable(lead.telefono)
    if (telefono) telefonos.add(telefono)
    const email = normalizarEmail(lead.email)
    if (email) emails.add(email)
  }

  return filas.map(({ fila, telefono, email }) => {
    const norm = telefonoComparable(telefono)
    if (norm && telefonos.has(norm)) return { fila, duplicado: 'telefono' }

    const mail = normalizarEmail(email)
    if (mail && emails.has(mail)) return { fila, duplicado: 'email' }

    return { fila, duplicado: null }
  })
}
