/**
 * Fechas de los avisos. Todas `YYYY-MM-DD` en hora de Argentina.
 *
 * Aparte del index para poder probarlas sin levantar el servidor.
 */
import type { TipoAviso } from '../_shared/plantillaAvisoVencimiento.ts'

const DIA_MS = 86_400_000
/** Argentina es UTC−3 todo el año (sin horario de verano desde 2009). */
const OFFSET_AR_MS = 3 * 3_600_000
/** Cuántos días antes del vencimiento arranca el aviso previo. */
const DIAS_AVISO_PREVIO = 3

export interface AvisoDeHoy {
  tipo: TipoAviso
  /** D: último día con acceso. */
  vencimiento: string
  /** D+1: día en que el cron suspende la cuenta. */
  corte: string
}

/**
 * Qué aviso le toca hoy a un vencimiento, o null si ninguno.
 *
 *   PREVIO           de D−3 a D−1
 *   DIA_VENCIMIENTO  el día D
 *
 * Sin gracia: pasado el día D la cuenta ya no está ACTIVA, así que no hay
 * tercer aviso. La ventana del PREVIO es de varios días para que un envío que
 * falló se reintente al día siguiente; el DIA_VENCIMIENTO es de un solo día.
 */
export function avisoDeHoy(hastaMs: number, hoy: string): AvisoDeHoy | null {
  const vencimiento = fechaAR(hastaMs)
  const corte = fechaDeCorte(hastaMs)
  const datos = { vencimiento, corte }

  if (hoy === vencimiento) return { tipo: 'DIA_VENCIMIENTO', ...datos }
  if (hoy >= sumarDias(vencimiento, -DIAS_AVISO_PREVIO) && hoy < vencimiento) {
    return { tipo: 'PREVIO', ...datos }
  }
  return null
}

/**
 * El día en que la cuenta pasa a VENCIDA: el siguiente al del vencimiento.
 *
 * La regla 4 de `procesar_transiciones_suscripcion()` compara el DÍA de
 * `acceso_pagado_hasta` (en hora de Argentina) con el de hoy, así que el acceso
 * rige hasta el fin del día D y la primera corrida del cron (05:00 UTC = 02:00
 * AR) del día D+1 lo corta, venza a la hora que venza.
 */
export function fechaDeCorte(hastaMs: number): string {
  return sumarDias(fechaAR(hastaMs), 1)
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
