/**
 * Lógica del botón "Actualizar": importar YA el calendario de Google del
 * usuario que lo toca. Sin base ni red: las lecturas y la importación entran
 * por `deps`, para testear cada rechazo sin Google.
 *
 * Quién dispara nunca elige la cuenta: la resuelve el servidor.
 *  - Dueño o agente: su propia cuenta.
 *  - Asistente: la de su agente (`asiste_a`), si pasa `resolverDuenoCalendario`.
 *
 * Qué se devuelve al cliente: solo cantidades y un resultado. Nada de tokens,
 * ids ni mensajes internos (esos van al log).
 */
import {
  type AgenteCalendario,
  type PerfilCalendario,
  resolverDuenoCalendario,
} from '../_shared/equipoCalendario.ts'
import type { Cuenta, Resumen } from '../google-calendar-import/importar.ts'

/** Segundos mínimos entre dos importaciones de la misma cuenta. */
export const ENFRIAMIENTO_MS = 15_000

export type CuentaLeida = Cuenta & { conectado: boolean; importacion_ultima_at: string | null }

export interface DepsImportAhora {
  /** Una sola fila de `profiles`, o null si no existe. */
  leerPerfil(id: string): Promise<PerfilCalendario | null>
  /** La fila de `google_calendar_tokens` del dueño del calendario, o null. */
  leerCuenta(duenoCalendario: string): Promise<CuentaLeida | null>
  /** La importación de una cuenta (la misma que usa el cron). */
  importar(cuenta: Cuenta): Promise<Resumen>
  ahora(): number
}

export type ResultadoPublico =
  | 'ok'
  | 'ya_actualizado'
  | 'no_conectado'
  | 'importacion_no_activada'
  | 'reautorizar'
  | 'reintentar'
  | 'error'

export interface CuerpoPublico {
  resultado: ResultadoPublico
  leidos: number
  tareas: number
  visitas: number
  tareas_posible_visita: number
  salteados: Record<string, number>
}

export type RespuestaAhora =
  | { status: 200; cuerpo: CuerpoPublico }
  | { status: 403; cuerpo: { error: string; code: 'SIN_PERMISO' } }

function vacio(resultado: ResultadoPublico): RespuestaAhora {
  return {
    status: 200,
    cuerpo: { resultado, leidos: 0, tareas: 0, visitas: 0, tareas_posible_visita: 0, salteados: {} },
  }
}

/**
 * ¿La cuenta se importó hace menos de `ventanaMs`? Una marca en el futuro
 * (reloj corrido) no cuenta: ante la duda se importa.
 */
export function enEnfriamiento(
  ultimaAt: string | null,
  ahoraMs: number,
  ventanaMs = ENFRIAMIENTO_MS,
): boolean {
  if (!ultimaAt) return false
  const ultima = Date.parse(ultimaAt)
  if (Number.isNaN(ultima)) return false
  const pasado = ahoraMs - ultima
  return pasado >= 0 && pasado < ventanaMs
}

/** Del resultado interno del cron al que ve el cliente. */
export function resultadoPublico(interno: Resumen['resultado']): ResultadoPublico {
  switch (interno) {
    case 'ok':
      return 'ok'
    case 'reautorizar':
      return 'reautorizar'
    case 'importacion_no_activada':
      return 'importacion_no_activada'
    // El token de sincronización se reinició o Google falló un momento: el
    // próximo intento anda. No es un error de la cuenta.
    case 'sync_token_vencido':
    case 'error_transitorio':
      return 'reintentar'
    default:
      return 'error'
  }
}

export async function ejecutarImportAhora(
  deps: DepsImportAhora,
  usuarioId: string,
): Promise<RespuestaAhora> {
  // Dos lecturas simples (sin join): el usuario y, solo si es asistente, su agente.
  const perfil = await deps.leerPerfil(usuarioId)
  const agente: AgenteCalendario | null =
    perfil?.rol === 'ASISTENTE' && perfil.asiste_a ? await deps.leerPerfil(perfil.asiste_a) : null

  // Se evalúa en cada request y sin cachear: un asistente dado de baja pierde
  // el acceso en el momento.
  const resolucion = resolverDuenoCalendario(perfil, agente)
  if (!resolucion.ok) {
    console.warn(
      `google-calendar-import-ahora: rechazado ${usuarioId} (${perfil?.rol ?? 'sin perfil'}): ${resolucion.motivo}`,
    )
    return { status: 403, cuerpo: { error: 'Sin permiso', code: 'SIN_PERMISO' } }
  }

  const rol = perfil?.rol ?? 'desconocido'
  const duenoCalendario = resolucion.duenoCalendario
  const log = (resultado: string) =>
    console.log(
      `google-calendar-import-ahora: dispara ${usuarioId} (${rol}) -> cuenta ${duenoCalendario}: ${resultado}`,
    )

  const cuenta = await deps.leerCuenta(duenoCalendario)
  if (!cuenta || !cuenta.conectado) {
    log('no_conectado')
    return vacio('no_conectado')
  }
  if (!cuenta.importacion_activa) {
    log('importacion_no_activada')
    return vacio('importacion_no_activada')
  }

  // Enfriamiento por cuenta. `importacion_ultima_at` lo escribe tanto el cron
  // como este botón al terminar bien; no hay lock: dos clics en vuelo a la
  // vez pasan los dos y el índice único evita duplicar.
  if (enEnfriamiento(cuenta.importacion_ultima_at, deps.ahora())) {
    log('ya_actualizado')
    return vacio('ya_actualizado')
  }

  const resumen = await deps.importar(cuenta)
  const resultado = resultadoPublico(resumen.resultado)
  log(`${resumen.resultado} (leidos ${resumen.leidos})`)

  return {
    status: 200,
    cuerpo: {
      resultado,
      leidos: resumen.leidos,
      tareas: resumen.tareas,
      visitas: resumen.visitas,
      tareas_posible_visita: resumen.tareas_posible_visita,
      salteados: resumen.salteados,
    },
  }
}
