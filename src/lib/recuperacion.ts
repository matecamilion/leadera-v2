import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Estado del link de recuperación de contraseña.
 *
 * Existe por una carrera: con el flujo implícito el cliente de Supabase procesa
 * el `#access_token=…&type=recovery` apenas se crea —al cargar la app—, borra
 * el hash y emite `PASSWORD_RECOVERY` una sola vez. ResetPassword es un chunk
 * lazy, así que puede montarse cuando todo eso ya pasó: el hash no está y un
 * listener nuevo sólo recibe `INITIAL_SESSION`, que no distingue una sesión de
 * recuperación de una sesión común. Por eso se captura acá, a nivel módulo,
 * desde `supabase.ts`.
 *
 * No importa el cliente a propósito: `supabase.ts` llama a estas funciones
 * alrededor de `createClient`, y el import al revés sería circular.
 */
interface EstadoRecuperacion {
  /** El hash con el que se abrió la app traía `type=recovery`. */
  esRecuperacion: boolean
  /** Descripción del error del link (vencido, ya usado), si Supabase la mandó. */
  error: string | null
  /** Llegó `PASSWORD_RECOVERY`: hay una sesión de recuperación válida. */
  sesionRecuperacion: boolean
}

const INICIAL: EstadoRecuperacion = {
  esRecuperacion: false,
  error: null,
  sesionRecuperacion: false,
}

let estado: EstadoRecuperacion = INICIAL
const suscriptores = new Set<() => void>()

function actualizar(cambios: Partial<EstadoRecuperacion>) {
  estado = { ...estado, ...cambios }
  suscriptores.forEach((avisar) => avisar())
}

/**
 * Lee el hash de la URL con la que se abrió la app. Tiene que correr ANTES de
 * `createClient`: después el cliente lo borra.
 */
export function capturarHashRecuperacion() {
  if (typeof window === 'undefined') return

  const hash = new URLSearchParams(window.location.hash.slice(1))
  // Algunos errores de GoTrue llegan por query string en vez de por hash.
  const query = new URLSearchParams(window.location.search)
  const error =
    hash.get('error_description') ??
    hash.get('error_code') ??
    query.get('error_description') ??
    query.get('error_code')

  actualizar({ esRecuperacion: hash.get('type') === 'recovery', error })
}

/**
 * Marca la sesión de recuperación cuando llega el evento. Tiene que
 * registrarse inmediatamente después de `createClient`, sin await de por medio,
 * para estar suscripto antes de que el cliente lo emita.
 */
export function escucharRecuperacion(client: { auth: SupabaseClient['auth'] }) {
  client.auth.onAuthStateChange((evento) => {
    if (evento === 'PASSWORD_RECOVERY') actualizar({ sesionRecuperacion: true })
    // Sin sesión no hay recuperación que valga: que no quede marcada para el
    // resto de la vida de la pestaña.
    if (evento === 'SIGNED_OUT') limpiarRecuperacion()
  })
}

/** Olvida el link procesado. Después de cambiar la contraseña o al salir. */
export function limpiarRecuperacion() {
  actualizar(INICIAL)
}

export function leerRecuperacion(): EstadoRecuperacion {
  return estado
}

/** Para `useSyncExternalStore`. */
export function suscribirRecuperacion(avisar: () => void): () => void {
  suscriptores.add(avisar)
  return () => {
    suscriptores.delete(avisar)
  }
}
