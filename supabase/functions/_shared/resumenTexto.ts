/**
 * Texto del resumen diario por push. Módulo puro: sin npm, sin Deno, sin red.
 *
 * Los cuatro números son los de las tarjetas de Mi día, cada uno por separado:
 * las categorías pueden solaparse (un lead caliente sin primer contacto cuenta
 * en prioritarios y en nuevos), así que sumarlos mentiría.
 */

export interface ConteosDelDia {
  prioritarios: number
  nuevos: number
  seguimientos: number
  visitas_hoy: number
}

export interface TextoResumen {
  title: string
  body: string
}

/** Un título más largo se corta en la notificación del teléfono. */
export const MAX_TITULO = 45
export const MAX_CUERPO = 120

const LLAMADA = 'Empezá por Mi día.'

/** De más a menos importante: lo que tiene hora fija primero. */
const ITEMS: { clave: keyof ConteosDelDia; uno: string; varios: string }[] = [
  { clave: 'visitas_hoy', uno: 'visita', varios: 'visitas' },
  { clave: 'seguimientos', uno: 'seguimiento', varios: 'seguimientos' },
  { clave: 'prioritarios', uno: 'prioritario', varios: 'prioritarios' },
  { clave: 'nuevos', uno: 'lead nuevo', varios: 'leads nuevos' },
]

/**
 * El resumen del día, o null si no hay nada: con los cuatro en cero no se
 * manda ningún aviso.
 */
export function armarResumen(conteos: ConteosDelDia): TextoResumen | null {
  const items = ITEMS.flatMap(({ clave, uno, varios }) => {
    const n = entero(conteos[clave])
    return n > 0 ? [`${n} ${n === 1 ? uno : varios}`] : []
  })
  if (items.length === 0) return null

  const resto = items.slice(2)
  return {
    title: recortar(`Hoy: ${items.slice(0, 2).join(' y ')}`, MAX_TITULO),
    body: recortar(resto.length ? `${unir(resto)}. ${LLAMADA}` : LLAMADA, MAX_CUERPO),
  }
}

/** Un entero positivo, o 0 si llega NaN, un negativo, un decimal o cualquier otra cosa. */
function entero(valor: unknown): number {
  return typeof valor === 'number' && Number.isSafeInteger(valor) && valor > 0 ? valor : 0
}

/** "a", "a y b", "a, b y c". */
function unir(partes: string[]): string {
  if (partes.length <= 1) return partes.join('')
  return `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`
}

/**
 * Recorta a `max` caracteres con "…", sin cortar a mitad de palabra. Con los
 * números reales nunca se llega al tope; es la garantía de que un valor
 * desmesurado no rompe la notificación.
 */
function recortar(texto: string, max: number): string {
  if (texto.length <= max) return texto
  const corte = texto.slice(0, max - 1)
  const ultimoEspacio = corte.lastIndexOf(' ')
  const palabras = ultimoEspacio > 0 ? corte.slice(0, ultimoEspacio) : corte
  return `${palabras.replace(/[\s,.:;]+$/, '')}…`
}
