/**
 * Validación del cuerpo del pedido. Aparte del index para poder probarla sin
 * levantar el servidor.
 */

export interface Entrada {
  dry_run?: boolean
  destinatario?: string
  hoy?: string
  inmobiliaria_id?: string
}


const CLAVES_ENTRADA = new Set(['dry_run', 'destinatario', 'hoy', 'inmobiliaria_id'])
const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Valida el cuerpo del pedido.
 *
 * Vacío o `{}` es la corrida real: así la llama el cron (`body := '{}'::jsonb`).
 * Cualquier otra cosa mal escrita se rechaza entera en vez de ignorarse: un
 * `"dry_run": "true"` o un `"dryrun": true` que se pasaran por alto correrían
 * en modo real y le escribirían a los dueños.
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

  const { dry_run, destinatario, hoy, inmobiliaria_id } = obj

  if (dry_run !== undefined && typeof dry_run !== 'boolean') {
    return { error: '`dry_run` tiene que ser true o false.' }
  }
  if (hoy !== undefined && (typeof hoy !== 'string' || !fechaValida(hoy))) {
    return { error: '`hoy` tiene que ser una fecha YYYY-MM-DD.' }
  }
  if (destinatario !== undefined && (typeof destinatario !== 'string' || !RE_EMAIL.test(destinatario))) {
    return { error: '`destinatario` tiene que ser un email.' }
  }
  if (inmobiliaria_id !== undefined && (typeof inmobiliaria_id !== 'string' || !RE_UUID.test(inmobiliaria_id))) {
    return { error: '`inmobiliaria_id` tiene que ser un uuid.' }
  }

  return { entrada: obj as Entrada }
}

/** YYYY-MM-DD y además una fecha que existe: 2026-02-30 no pasa. */
function fechaValida(fecha: string): boolean {
  if (!RE_FECHA.test(fecha)) return false
  const ms = Date.parse(`${fecha}T00:00:00Z`)
  return !Number.isNaN(ms) && new Date(ms).toISOString().slice(0, 10) === fecha
}
