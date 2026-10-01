/**
 * Normalización de teléfonos para las Edge Functions.
 *
 * COPIA de `soloDigitos` y `normalizarTelefonoAR` de `src/lib/telefono.ts`: las
 * funciones de Deno no pueden importar desde `src/`. Si cambiás una, cambiá la
 * otra. Los dos lados tienen que normalizar igual: la detección de duplicados
 * de `consulta-publica` compara contra `leads.telefono` con esta función, y el
 * aviso de duplicado al cargar un lead a mano usa la del front.
 *
 * Las explicaciones de cada regla están en `src/lib/telefono.ts`.
 */

/** Los dígitos del número, sin separadores ni prefijos de escritura. */
export function soloDigitos(valor: string): string {
  return valor.replace(/\D/g, '')
}

export const MIN_DIGITOS_TELEFONO = 8
export const MAX_DIGITOS_TELEFONO = 13

/** true si el valor no llega a parecer un teléfono. */
export function telefonoInvalido(valor: string): boolean {
  const largo = soloDigitos(valor).length
  return largo < MIN_DIGITOS_TELEFONO || largo > MAX_DIGITOS_TELEFONO
}

/** `54` + `9` + área + número, sin 0 ni 15. Heurística, no un parser. */
export function normalizarTelefonoAR(valor: string): string {
  let digitos = soloDigitos(valor)
  if (!digitos) return ''

  if (digitos.startsWith('00')) digitos = digitos.slice(2)

  if (digitos.startsWith('54')) {
    const resto = digitos.slice(2)
    if (resto.length === 10 && !resto.startsWith('9')) return `549${resto}`
    return digitos
  }

  if (digitos.startsWith('0')) digitos = digitos.slice(1)

  digitos = sacarEl15(digitos)
  digitos = asumirMarDelPlata(digitos)

  return `549${digitos}`
}

function sacarEl15(digitos: string): string {
  if (digitos.length <= 10) return digitos

  for (const pos of [2, 3, 4]) {
    if (digitos.slice(pos, pos + 2) !== '15') continue
    const sinEl15 = digitos.slice(0, pos) + digitos.slice(pos + 2)
    if (sinEl15.length === 10) return sinEl15
  }

  return digitos
}

/** DECISIÓN DE NEGOCIO: sin código de área se asume Mar del Plata (223). */
const AREA_MAR_DEL_PLATA = '223'

function asumirMarDelPlata(digitos: string): string {
  const conQuince = digitos.startsWith('15')

  if (conQuince && (digitos.length === 9 || digitos.length === 10)) {
    return AREA_MAR_DEL_PLATA + digitos.slice(2)
  }

  if (!conQuince && (digitos.length === 7 || digitos.length === 8)) {
    return AREA_MAR_DEL_PLATA + digitos
  }

  return digitos
}
