/**
 * La decisión del cupo, sin I/O.
 *
 * Vive aparte de `supabase.ts` para poder testearla con vitest: ese archivo
 * importa `npm:@supabase/supabase-js`, y este no importa nada. `hayCupo` lee la
 * base y le pasa las filas a `evaluarCupo`.
 */

export type RolAgente = 'DUENO' | 'AGENTE' | 'ASISTENTE'

/** Por qué no entra un usuario más. Ausente cuando sí entra. */
export type MotivoSinCupo =
  | 'TECHO_TOTAL'
  | 'TOPE_AGENTES'
  | 'TOPE_ASISTENTES'
  | 'SIN_AGENTE'

/**
 * El alta que se está por hacer.
 *
 * Sin esto no se puede chequear nada por rol, así que `evaluarCupo` cae al
 * techo total y nada más.
 */
export interface AltaCupo {
  rol: RolAgente
  /** A qué agente asiste. Obligatorio cuando `rol` es ASISTENTE. */
  asisteA?: string | null
}

export interface ResultadoCupo {
  ok: boolean
  /** Miembros ACTIVOS de la inmobiliaria, sin filtrar por rol. */
  usados: number
  /** Techo total vigente. NULL = sin tope. */
  limite: number | null
  motivo?: MotivoSinCupo
  /** El tope concreto contra el que se chocó, para poder nombrarlo en el mensaje. */
  tope?: number
}

export interface MiembroCupo {
  rol: RolAgente
  asiste_a: string | null
  activo: boolean
}

/** Los tres topes de una fila de `planes_cupo`. NULL = sin tope. */
export interface TopesCupo {
  limiteUsuarios: number | null
  maxAgentes: number | null
  maxAsistentesPorAgente: number | null
}

/**
 * ¿Entra UNA persona más, con este rol y este `asiste_a`?
 *
 * Son tres topes, y cada uno se saltea si su valor es NULL ("sin tope"):
 *   - `limiteUsuarios`          → techo total
 *   - `maxAgentes`              → cuántos DUENO + AGENTE admite. El dueño cuenta
 *     como agente: en SOLO, `maxAgentes = 1` es él y no entra ninguno más.
 *   - `maxAsistentesPorAgente`  → cuántos ASISTENTE puede tener CADA agente,
 *     contados por `asiste_a`. No es un total de asistentes de la inmobiliaria.
 *
 * Los tres conteos miran sólo miembros ACTIVOS: un miembro desactivado no ocupa
 * lugar. Para reactivar a alguien se llama con su rol y su `asiste_a`, siendo él
 * mismo uno de los inactivos que no cuentan: la pregunta es la misma, "¿entra
 * uno más?".
 *
 * `topes` null = la inmobiliaria no tiene plan, o el plan no tiene fila en
 * `planes_cupo`. Se cae al comportamiento de antes de los topes por rol, que
 * sólo conoce `limiteFallback` (`inmobiliarias.limite_usuarios`) como techo
 * total y no chequea nada por rol.
 */
export function evaluarCupo(
  miembros: MiembroCupo[],
  topes: TopesCupo | null,
  limiteFallback: number | null,
  alta?: AltaCupo,
): ResultadoCupo {
  const equipo = miembros.filter((m) => m.activo)
  const usados = equipo.length

  if (!topes) {
    const limite = limiteFallback
    if (limite === null) return { ok: true, usados, limite: null }
    if (usados < limite) return { ok: true, usados, limite }
    return { ok: false, usados, limite, motivo: 'TECHO_TOTAL', tope: limite }
  }

  const limite = topes.limiteUsuarios

  // Los topes por rol van ANTES del techo total, y el orden se nota: una cuenta
  // SOLO con el dueño y sus dos asistentes choca los dos a la vez (3 de 3
  // usuarios, y 2 de 2 asistentes del dueño). Decirle "ese agente ya tiene 2
  // asistentes" le explica qué pasó; decirle "3 de 3 usuarios" la deja
  // buscando cuál de los tres sobra. Gana el tope más específico.
  if (alta?.rol === 'AGENTE' && topes.maxAgentes !== null) {
    const agentes = equipo.filter((p) => p.rol === 'DUENO' || p.rol === 'AGENTE').length
    if (agentes >= topes.maxAgentes) {
      return { ok: false, usados, limite, motivo: 'TOPE_AGENTES', tope: topes.maxAgentes }
    }
  }

  if (alta?.rol === 'ASISTENTE') {
    const asisteA = alta.asisteA ?? null

    // Un asistente sin agente no es un problema de cupo sino de datos: no se
    // puede contar contra ningún tope, y dejarlo entrar rompería el conteo de
    // todos los demás. Se corta incluso en los planes sin tope.
    if (!asisteA) return { ok: false, usados, limite, motivo: 'SIN_AGENTE' }

    if (topes.maxAsistentesPorAgente !== null) {
      const asistentes = equipo.filter(
        (p) => p.rol === 'ASISTENTE' && p.asiste_a === asisteA,
      ).length
      if (asistentes >= topes.maxAsistentesPorAgente) {
        return {
          ok: false,
          usados,
          limite,
          motivo: 'TOPE_ASISTENTES',
          tope: topes.maxAsistentesPorAgente,
        }
      }
    }
  }

  if (limite !== null && usados >= limite) {
    return { ok: false, usados, limite, motivo: 'TECHO_TOTAL', tope: limite }
  }

  return { ok: true, usados, limite }
}
