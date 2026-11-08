/**
 * Validación del cuerpo del pedido. Aparte del index para poder probarla sin
 * levantar el servidor.
 */

export interface Entrada {
  dry_run?: boolean
  /** Simula otro momento (ISO con huso). Solo con dry_run. */
  ahora?: string
}

const CLAVES_ENTRADA = new Set(['dry_run', 'ahora'])

/** ISO con huso explícito: sin él, `Date.parse` lo leería en la zona del servidor. */
const RE_ISO_CON_HUSO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/

/**
 * Vacío o `{}` es la corrida real (así la llama el cron). Cualquier otra cosa
 * mal escrita se rechaza entera: un `"dry_run": "true"` que se pasara por alto
 * correría en modo real y mandaría pushes.
 */
export function leerEntrada(cuerpo: string): { entrada: Entrada } | { error: string } {
  if (!cuerpo.trim()) return { entrada: {} }

  let datos: unknown
  try {
    datos = JSON.parse(cuerpo)
  } catch {
    return { error: 'El cuerpo no es un JSON válido.' }
  }

  if (typeof datos !== 'object' || datos === null || Array.isArray(datos)) {
    return { error: 'El cuerpo tiene que ser un objeto JSON.' }
  }

  const obj = datos as Record<string, unknown>
  const desconocidas = Object.keys(obj).filter((k) => !CLAVES_ENTRADA.has(k))
  if (desconocidas.length) {
    return {
      error: `Claves desconocidas: ${desconocidas.join(', ')}. Se aceptan: ${[...CLAVES_ENTRADA].join(', ')}.`,
    }
  }

  const { dry_run, ahora } = obj

  if (dry_run !== undefined && typeof dry_run !== 'boolean') {
    return { error: '`dry_run` tiene que ser true o false.' }
  }
  if (
    ahora !== undefined &&
    (typeof ahora !== 'string' || !RE_ISO_CON_HUSO.test(ahora) || Number.isNaN(Date.parse(ahora)))
  ) {
    return { error: '`ahora` tiene que ser una fecha ISO con huso, por ejemplo 2026-11-08T15:00:00-03:00.' }
  }
  // En una corrida real, otro momento mandaría avisos de visitas que no corresponden.
  if (ahora !== undefined && dry_run !== true) {
    return { error: '`ahora` solo se acepta con dry_run.' }
  }

  return { entrada: obj as Entrada }
}
