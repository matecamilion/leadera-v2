/**
 * Teléfonos: normalización, links y formateo mientras se tipea.
 *
 * Los números que ya están cargados vienen de años sin validación y están en
 * cualquier formato ("223 1234567", "0223 15 123 4567", "+54 9 223…"). Nada de
 * lo de acá los reescribe en la base: se normaliza al vuelo, sólo para armar el
 * link. La base sigue guardando lo que el usuario tipeó.
 *
 * Todo es best-effort y está pensado para el mercado argentino.
 */

/** Los dígitos del número, sin separadores ni prefijos de escritura. */
export function soloDigitos(valor: string): string {
  return valor.replace(/\D/g, '')
}

/**
 * Cuántos dígitos puede tener un teléfono para darse por bueno.
 *
 * El piso son 8 —un abonado suelto de 7 más algo, o un número corto de otra
 * provincia— y el techo 13, que es `54` + `9` + los 10 del número local. Es un
 * rango a propósito ancho: la base tiene años de números cargados sin
 * validación y la idea es atajar el error de tipeo evidente ("a", "123"), no
 * imponer un formato que deje a medio padrón afuera.
 */
export const MIN_DIGITOS_TELEFONO = 8
export const MAX_DIGITOS_TELEFONO = 13

/**
 * true si el valor no llega a parecer un teléfono.
 *
 * Un campo vacío cuenta como inválido: donde se usa, el teléfono es obligatorio.
 * No se apoya en `normalizarTelefonoAR` porque aquella nunca falla —le inventa
 * el código de área y el prefijo de país a lo que le den—, así que serviría para
 * comparar dos números pero no para decidir si uno está bien escrito.
 */
export function telefonoInvalido(valor: string): boolean {
  const largo = soloDigitos(valor).length
  return largo < MIN_DIGITOS_TELEFONO || largo > MAX_DIGITOS_TELEFONO
}

/**
 * Deja el número como lo quiere wa.me: sólo dígitos, con código de país.
 *
 * El formato que WhatsApp espera para un celular argentino es
 * `54` + `9` + código de área + número, sin el 0 y sin el 15.
 *
 * Es una heurística, no un parser de la numeración argentina: acierta en los
 * formatos que se ven en la práctica y puede errarle en los raros. Nunca
 * devuelve algo vacío salvo que no haya un solo dígito.
 */
export function normalizarTelefonoAR(valor: string): string {
  let digitos = soloDigitos(valor)
  if (!digitos) return ''

  // Prefijo internacional marcado a la vieja usanza.
  if (digitos.startsWith('00')) digitos = digitos.slice(2)

  if (digitos.startsWith('54')) {
    // Ya trae país. Lo único que puede faltarle es el 9 de celular: `54` + 10
    // dígitos es el número local completo sin ese 9, y wa.me no lo rutea así.
    // Con 13 dígitos (`549` + 10) ya está bien y no se toca.
    const resto = digitos.slice(2)
    if (resto.length === 10 && !resto.startsWith('9')) return `549${resto}`
    return digitos
  }

  // 0 de larga distancia.
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

/**
 * El número guardado, legible: `+5492235551234` → `+54 9 223 555 1234`.
 * Buenos Aires (11) agrupa 2-4-4; el resto 3-3-4. Otros países, tal cual.
 */
export function formatearInternacional(e164: string): string {
  const m = /^\+549(\d{10})$/.exec(e164)
  if (!m) return e164
  const n = m[1]
  if (n.startsWith('11')) return `+54 9 11 ${n.slice(2, 6)} ${n.slice(6)}`
  return `+54 9 ${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`
}

/**
 * Saca el 15 de celular, si es que hay uno.
 *
 * HEURÍSTICA, no una regla exacta: los códigos de área argentinos miden entre
 * 2 y 4 dígitos, así que el 15 —cuando está— arranca en la posición 2, 3 o 4.
 * Sólo se saca si al sacarlo queda un número de 10 dígitos, que es el largo
 * canónico (área + abonado). Ese chequeo es lo que la vuelve segura: un número
 * de 10 dígitos que casualmente tenga "15" ahí nunca entra, porque para entrar
 * hay que medir 12.
 *
 * Donde le va a errar: un número de 12 dígitos que NO sea `área + 15 + abonado`
 * pero que tenga un "15" en esa posición. En un teléfono argentino ese caso no
 * existe; en un número extranjero cargado sin `+`, sí.
 */
function sacarEl15(digitos: string): string {
  if (digitos.length <= 10) return digitos

  for (const pos of [2, 3, 4]) {
    if (digitos.slice(pos, pos + 2) !== '15') continue
    const sinEl15 = digitos.slice(0, pos) + digitos.slice(pos + 2)
    if (sinEl15.length === 10) return sinEl15
  }

  return digitos
}

/** Código de área de Mar del Plata. */
const AREA_MAR_DEL_PLATA = '223'

/**
 * Le pone el código de área a un número que vino sin él, asumiendo Mar del
 * Plata.
 *
 * DECISIÓN DE NEGOCIO, NO HEURÍSTICA UNIVERSAL. Hoy el producto se vende sólo
 * en Mar del Plata, así que un número cargado sin código de área es, en la
 * práctica, un número de acá. Si LeadEra se expande a otra ciudad hay que
 * revisar esta regla o sacarla: a partir de ahí un número sin código de área
 * deja de ser deducible y meterle 223 a ciegas es peor que no tocarlo.
 *
 * Entra sólo lo que puede ser un abonado suelto:
 *   - 9 o 10 dígitos empezando con 15 → celular tipeado como se disca local
 *     ("15 444-5555"), se le saca el 15.
 *   - 7 u 8 dígitos sin 15 → el abonado pelado ("444-5555").
 *
 * Todo lo demás sale igual que como entró. En particular los de 10 dígitos que
 * ya traen código de área, que son el caso bueno y no se tocan: ningún código
 * de área argentino empieza con 15, así que la rama del 15 no los puede pisar.
 *
 * Ojo con los de 8 dígitos: 223 + 8 da un local de 11, que no es un largo
 * válido en la numeración argentina (Mar del Plata es 223 + 7). Se aceptan
 * igual porque en la base hay números cargados así y es mejor armar el link que
 * descartarlos, pero WhatsApp puede no rutearlos.
 */
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

/**
 * Link de WhatsApp. Devuelve '' si no hay ningún dígito: quien lo use tiene
 * que saltear el botón en ese caso, en vez de dibujar un link muerto.
 */
export function linkWhatsApp(telefono: string, mensaje?: string): string {
  const numero = normalizarTelefonoAR(telefono)
  if (!numero) return ''

  // `mensaje` deja el chat con el texto ya escrito, sin enviarlo: wa.me lo
  // toma del parámetro `text`. Sin mensaje el link queda igual que siempre,
  // que es como lo usan los botones de contacto de todas las pantallas.
  const base = `https://wa.me/${numero}`
  return mensaje?.trim() ? `${base}?text=${encodeURIComponent(mensaje)}` : base
}

/**
 * Link de WhatsApp para un número que YA está guardado en formato internacional
 * (`profiles.telefono`). `linkWhatsApp` no sirve acá: normaliza como si todo
 * fuera argentino y le arma un `54 9…` a un `+598…`. Devuelve '' si no es un
 * `+` seguido de dígitos.
 */
export function linkWhatsAppInternacional(e164: string): string {
  return /^\+[1-9]\d{7,14}$/.test(e164) ? `https://wa.me/${e164.slice(1)}` : ''
}

/**
 * Link `tel:`.
 *
 * Para llamar no hace falta la normalización de WhatsApp: el teléfono del
 * usuario sabe marcar un número local. Alcanza con sacar los separadores y
 * dejar el `+` si estaba.
 */
export function linkTelefono(telefono: string): string {
  return `tel:${telefono.replace(/[^\d+]/g, '')}`
}

export function linkEmail(email: string): string {
  return `mailto:${email.trim()}`
}

/**
 * Agrupa el número mientras se tipea: "2231234567" → "223 123-4567".
 *
 * Es ayuda visual y nada más. No valida, no rechaza, no recorta: lo que no
 * entra en el molde de 10 dígitos queda igual al final, así que un interno, un
 * número viejo o un extranjero se pueden seguir cargando.
 */
export function formatearMientrasTipea(valor: string): string {
  const internacional = valor.trimStart().startsWith('+')
  const digitos = valor.replace(/\D/g, '')
  if (!digitos) return internacional ? '+' : ''

  if (internacional || digitos.startsWith('54')) {
    const sinPais = digitos.startsWith('54') ? digitos.slice(2) : digitos
    // El 9 de celular va suelto, como se escribe: +54 9 223 123-4567.
    const nueve = sinPais.startsWith('9') ? '9' : ''
    const local = nueve ? sinPais.slice(1) : sinPais
    return ['+54', nueve, agruparLocal(local)].filter(Boolean).join(' ')
  }

  return agruparLocal(digitos)
}

/** 3 + 3 + 4, el corte más común de un número argentino de 10 dígitos. */
function agruparLocal(digitos: string): string {
  const area = digitos.slice(0, 3)
  const medio = digitos.slice(3, 6)
  const final = digitos.slice(6, 10)
  const sobrante = digitos.slice(10)

  let salida = area
  if (medio) salida += ` ${medio}`
  if (final) salida += `-${final}`
  if (sobrante) salida += ` ${sobrante}`
  return salida
}
