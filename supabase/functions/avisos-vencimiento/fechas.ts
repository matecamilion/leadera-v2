/**
 * Fechas de los avisos. Todas `YYYY-MM-DD` en hora de Argentina.
 *
 * Aparte del index para poder probarlas sin levantar el servidor.
 */
import type { TipoAviso } from '../_shared/plantillaAvisoVencimiento.ts'

const DIA_MS = 86_400_000
/** Argentina es UTC−3 todo el año (sin horario de verano desde 2009). */
const OFFSET_AR_MS = 3 * 3_600_000
/**
 * Hora UTC del job `procesar-transiciones-suscripcion-diario`
 * (20260911120000_respaldo_crons.sql). La fecha de corte que anuncia el mail
 * sale de acá: si se mueve ese cron, hay que mover esto.
 */
const HORA_CRON_TRANSICIONES_UTC = 5
/** Días de gracia de la regla 5 de `procesar_transiciones_suscripcion()`. */
const DIAS_GRACIA = 3


export interface AvisoDeHoy {
  tipo: TipoAviso
  /** D: día del vencimiento. */
  vencimiento: string
  /** C: día en que el cron suspende la cuenta. */
  corte: string
}

/** Qué aviso le toca hoy a un vencimiento, o null si ninguno. */
export function avisoDeHoy(hastaMs: number, hoy: string): AvisoDeHoy | null {
  const vencimiento = fechaAR(hastaMs)
  const corte = fechaDeCorte(hastaMs)
  const datos = { vencimiento, corte }

  if (hoy === sumarDias(corte, -1)) return { tipo: 'ULTIMO_DIA_GRACIA', ...datos }
  if (hoy >= vencimiento && hoy <= sumarDias(corte, -2)) return { tipo: 'DIA_VENCIMIENTO', ...datos }
  if (hoy >= sumarDias(vencimiento, -3) && hoy < vencimiento) return { tipo: 'PREVIO', ...datos }
  return null
}

/**
 * El día en que la cuenta pasa a VENCIDA.
 *
 * La regla 5 corta cuando `acceso_pagado_hasta < now() - 3 days`, y sólo se
 * evalúa cuando corre el cron. El corte es entonces la primera corrida
 * estrictamente posterior a vencimiento + 3 días: un vencimiento a las 15:00
 * se corta en la corrida de las 02:00 de cuatro días después, no de tres.
 */
export function fechaDeCorte(hastaMs: number): string {
  const limite = hastaMs + DIAS_GRACIA * DIA_MS
  const d = new Date(limite)
  let corrida = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), HORA_CRON_TRANSICIONES_UTC)
  if (corrida <= limite) corrida += DIA_MS
  return fechaAR(corrida)
}

export function fechaAR(ms: number): string {
  return new Date(ms - OFFSET_AR_MS).toISOString().slice(0, 10)
}

function sumarDias(fecha: string, dias: number): string {
  return new Date(Date.parse(`${fecha}T00:00:00Z`) + dias * DIA_MS).toISOString().slice(0, 10)
}

export function formatearFecha(fecha: string): string {
  const [anio, mes, dia] = fecha.split('-')
  return `${dia}/${mes}/${anio}`
}
