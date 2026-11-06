/**
 * Las dos decisiones de resumen-diario que no tocan la red ni la base, aparte
 * del index para poder probarlas.
 */

/** Una fila ENVIANDO más vieja que esto es de una corrida que se cayó. */
export const RECLAMO_VENCIDO_MS = 15 * 60_000

export interface FilaLog {
  estado: 'ENVIANDO' | 'ENVIADO' | 'OMITIDO' | 'ERROR'
  actualizado_at: string
}

/**
 * ¿Qué hacer con un aviso que ya tiene fila en el registro?
 *
 *   ENVIADO, OMITIDO      ya está resuelto hoy: se saltea.
 *   ENVIANDO reciente     otra corrida lo está haciendo: se saltea.
 *   ENVIANDO vencida      esa corrida se cayó: se retoma.
 *   ERROR                 se reintenta.
 */
export function decidirReclamo(previa: FilaLog, ahoraMs: number): 'saltar' | 'retomar' {
  if (previa.estado === 'ENVIADO' || previa.estado === 'OMITIDO') return 'saltar'
  if (previa.estado === 'ENVIANDO' && ahoraMs - Date.parse(previa.actualizado_at) < RECLAMO_VENCIDO_MS) {
    return 'saltar'
  }
  return 'retomar'
}

/** Lo que `enviar-push` informa de una corrida (ver su index.ts). */
export interface RespuestaPush {
  destinatarios: number
  suscripciones: number
  enviadas: number
  simuladas: number
  eliminadas: number
  rechazadas: number
  reintentables: number
}

export type DesenlacePush =
  | { estado: 'ENVIADO'; dispositivos: number; enviados: number }
  | { estado: 'OMITIDO'; motivo: string; dispositivos: number }
  | { estado: 'ERROR'; motivo: string; dispositivos: number }

/**
 * Qué quedó escrito en el registro según lo que respondió `enviar-push`.
 * Con `dryRun` cuentan las simuladas en vez de las enviadas.
 */
export function interpretarRespuestaPush(r: RespuestaPush, dryRun: boolean): DesenlacePush {
  if (r.destinatarios === 0) {
    return { estado: 'OMITIDO', motivo: 'usuario inactivo o cuenta bloqueada', dispositivos: 0 }
  }
  if (r.suscripciones === 0) {
    return { estado: 'OMITIDO', motivo: 'sin dispositivos', dispositivos: 0 }
  }
  const llegaron = dryRun ? r.simuladas : r.enviadas
  if (llegaron > 0) {
    return { estado: 'ENVIADO', dispositivos: r.suscripciones, enviados: llegaron }
  }
  // Todos los dispositivos estaban dados de baja en el servicio push: ya se
  // borraron y reintentar no cambia nada.
  if (r.eliminadas >= r.suscripciones) {
    return { estado: 'OMITIDO', motivo: 'dispositivos dados de baja', dispositivos: r.suscripciones }
  }
  return {
    estado: 'ERROR',
    motivo: `no llegó a ningún dispositivo (reintentables ${r.reintentables}, rechazadas ${r.rechazadas}, eliminadas ${r.eliminadas})`,
    dispositivos: r.suscripciones,
  }
}
