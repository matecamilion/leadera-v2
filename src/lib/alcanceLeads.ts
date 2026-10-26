import type { RolAgente } from './api/auth'

/**
 * Sobre qué leads trabaja cada rol por defecto.
 *
 * `asignado_a` es quién lleva el lead; `agente_id` es de quién es la cartera.
 * Un asistente arranca sobre lo que tiene asignado y con un toque pasa a todo
 * lo que su RLS le deja ver. Dueño y agente arrancan sobre todo.
 *
 * Vive acá, sin supabase, para que el listado, el badge del menú y Mi día
 * decidan lo mismo: si cada uno tuviera su propio `if`, el número del badge y
 * el del chip "Míos" podrían separarse.
 */
export function miosPorDefecto(rol: RolAgente | undefined): boolean {
  return rol === 'ASISTENTE'
}

/**
 * `?mios=` del listado: para el asistente, `1` fuerza Míos, `0` fuerza Todos y
 * sin parámetro (o con cualquier otra cosa) rige su default.
 *
 * Dueño y agente nunca filtran por asignado: es una decisión de producto, para
 * que un filtro olvidado no les haga perder el rastro de un lead. Una URL con
 * `?mios=1` no cambia eso.
 */
export function resolverMios(rol: RolAgente | undefined, parametro: string | null): boolean {
  if (rol !== 'ASISTENTE') return false
  if (parametro === '1') return true
  if (parametro === '0') return false
  return miosPorDefecto(rol)
}

/**
 * Qué escribir en `?mios=` para que la URL diga `mios`, o `null` si coincide
 * con el default del rol y el parámetro sobra (la URL pelada ya lo dice).
 */
export function parametroMios(rol: RolAgente | undefined, mios: boolean): '1' | '0' | null {
  if (rol !== 'ASISTENTE') return null
  if (mios === miosPorDefecto(rol)) return null
  return mios ? '1' : '0'
}

/** El chip "Míos" es solo del asistente: dueño y agente no filtran por asignado. */
export function mostrarChipMios(rol: RolAgente | undefined): boolean {
  return rol === 'ASISTENTE'
}

/**
 * ¿Se muestra a quién está asignado cada lead en el listado? Para un asistente
 * siempre; para el resto, solo si la cuenta tiene al menos un asistente activo.
 * En una cuenta Solo sin equipo todo es del mismo, y la columna no aporta.
 *
 * Es independiente del chip: el dueño no tiene "Míos" pero sí ve a quién está
 * asignado cada lead.
 */
export function mostrarAsignado(rol: RolAgente | undefined, hayAsistentesActivos: boolean): boolean {
  return rol === 'ASISTENTE' || (rol !== undefined && hayAsistentesActivos)
}

/**
 * El `asignado_a` por el que filtran el badge y Mi día: el usuario si es
 * asistente, `undefined` (sin filtro) para el resto. Es la misma regla que
 * `miosPorDefecto`, expresada como valor para la query.
 */
export function asignadoAPorDefecto(rol: RolAgente | undefined, uid: string | undefined): string | undefined {
  return miosPorDefecto(rol) ? uid : undefined
}
