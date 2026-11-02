/**
 * Normalización de teléfonos para las Edge Functions.
 *
 * COPIA de `soloDigitos`, `normalizarTelefonoAR` y `normalizarCelularRegistro` de `src/lib/telefono.ts`: las
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

  // Celular con el 9 pero sin el 54: 9 + área + número = 11 dígitos. Si no, el
  // 9 se tomaría por parte del área y saldría `54 9 9...`, un dígito de más.
  if (digitos.length === 11 && digitos.startsWith('9')) return `54${digitos}`

  digitos = sacarEl15(digitos)
  digitos = asumirMarDelPlata(digitos)

  return `549${digitos}`
}

/**
 * ¿Normaliza a un celular argentino completo? `54` + `9` + 10 dígitos = 13.
 *
 * `normalizarTelefonoAR` nunca falla —antepone `549` a lo que le den—, así que
 * un extranjero o un número con dígitos de más o de menos sale con otro largo.
 * Solo un teléfono confiable sirve para decir que dos personas son la misma.
 *
 * El dígito tras `549` es el primero del código de área, que nunca es 0 ni 9:
 * un número de 10 dígitos que empieza con 9 no es argentino.
 */
export function esTelefonoConfiable(valor: string): boolean {
  return /^549[1-8]\d{9}$/.test(normalizarTelefonoAR(valor))
}

/**
 * Resultado de `normalizarCelularRegistro`: el número listo para guardar, o por
 * qué no sirve.
 */
export type ResultadoCelular = { ok: true; e164: string } | { ok: false; motivo: string }

const MOTIVO_VACIO = 'Ingresá tu celular con código de área.'
const MOTIVO_SIN_AREA = 'Falta el código de área. Ej.: 223 555 1234.'
const MOTIVO_REVISAR = 'Revisá el número: no parece un celular válido.'

/**
 * Celular del registro, en formato internacional (`+549…` para Argentina).
 *
 * A diferencia de `normalizarTelefonoAR` —que nunca falla y le inventa el
 * código de área 223 a lo que no lo trae—, acá se rechaza lo que no se puede
 * interpretar con certeza: el dato se usa para escribirle a una persona, y un
 * número armado a ciegas es peor que pedirle que lo corrija.
 *
 *  - Con `+` o `00` adelante es internacional: `+54` se normaliza como celular
 *    argentino y cualquier otro país se acepta tal cual (8 a 15 dígitos).
 *  - Sin prefijo es argentino: se saca el 0 y el 15, y tiene que quedar el
 *    código de área más el abonado (10 dígitos). Sin código de área se rechaza.
 *
 * `normalizarTelefonoAR` no se toca: la detección de duplicados y los links de
 * WhatsApp de los leads dependen de su comportamiento actual.
 */
export function normalizarCelularRegistro(valor: string): ResultadoCelular {
  const texto = valor.trim()
  let digitos = soloDigitos(texto)
  if (!digitos) return { ok: false, motivo: MOTIVO_VACIO }

  let internacional = texto.startsWith('+')
  if (!internacional && texto.startsWith('00')) {
    internacional = true
    digitos = digitos.slice(2)
  }
  // `54 9 223…` sin el `+`: ningún código de área argentino empieza con 54.
  if (!internacional && digitos.startsWith('54') && digitos.length >= 12) internacional = true

  if (internacional) {
    if (digitos.startsWith('54')) return celularArgentino(digitos.slice(2))
    // Sin ceros a la izquierda: el primer dígito es del país (1 a 9).
    if (/^[1-9]\d{7,14}$/.test(digitos)) return { ok: true, e164: `+${digitos}` }
    return { ok: false, motivo: MOTIVO_REVISAR }
  }

  if (digitos.startsWith('0')) digitos = digitos.slice(1)
  // Con el 9 de celular y sin el 54: 9 + área + número.
  if (digitos.length === 11 && digitos.startsWith('9')) return celularArgentino(digitos)

  digitos = sacarEl15(digitos)
  // Un abonado suelto, con o sin 15: falta el área, y no se adivina. Ningún
  // código de área argentino empieza con 15, así que 15 + 8 dígitos es un
  // celular tipeado a la local, no un número con área.
  if (digitos.length >= 7 && (digitos.length < 10 || digitos.startsWith('15'))) {
    return { ok: false, motivo: MOTIVO_SIN_AREA }
  }
  if (digitos.length !== 10) return { ok: false, motivo: MOTIVO_REVISAR }

  return celularArgentino(digitos)
}

/** `resto` es lo que sigue al `54`: 10 dígitos (área + abonado) o `9` + 10. */
function celularArgentino(resto: string): ResultadoCelular {
  const local = resto.length === 11 && resto.startsWith('9') ? resto.slice(1) : resto
  // El área no empieza con 0 ni con 9.
  if (!/^[1-8]\d{9}$/.test(local)) return { ok: false, motivo: MOTIVO_REVISAR }
  return { ok: true, e164: `+549${local}` }
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
