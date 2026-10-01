import { useEffect, useState } from 'react'

/**
 * Cuánto lleva esperando una consulta pendiente, y qué tan grave es.
 *
 * Un lead se enfría en horas: la velocidad de primer contacto es lo que más
 * pesa. Por eso la espera escala:
 *   - menos de 1 h: normal
 *   - desde 1 h:    atención (ámbar)
 *   - desde 4 h:    urgente (rojo); además arma su propio grupo en la bandeja
 */

export const UMBRAL_ATENCION_MIN = 60
export const UMBRAL_URGENTE_MIN = 240

export type NivelEspera = 'normal' | 'atencion' | 'urgente'

export function minutosDesde(fecha: string, ahora: number): number {
  const t = Date.parse(fecha)
  return Number.isNaN(t) ? 0 : Math.max(0, Math.floor((ahora - t) / 60_000))
}

export function nivelEspera(minutos: number): NivelEspera {
  if (minutos >= UMBRAL_URGENTE_MIN) return 'urgente'
  if (minutos >= UMBRAL_ATENCION_MIN) return 'atencion'
  return 'normal'
}

/** "5 min", "3 h", "2 d": para el chip. */
export function esperaCorta(minutos: number): string {
  if (minutos < 1) return 'ahora'
  if (minutos < 60) return `${minutos} min`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `${horas} h`
  return `${Math.floor(horas / 24)} d`
}

/** "5 minutos", "3 horas", "2 días": para lectores de pantalla y tooltips. */
export function esperaLarga(minutos: number): string {
  if (minutos < 1) return 'menos de un minuto'
  if (minutos < 60) return `${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `${horas} ${horas === 1 ? 'hora' : 'horas'}`
  const dias = Math.floor(horas / 24)
  return `${dias} ${dias === 1 ? 'día' : 'días'}`
}

/**
 * "Ahora" que avanza cada minuto, para que las esperas se actualicen sin
 * refetch. Arranca en el instante de montar.
 */
export function useAhora(intervaloMs = 60_000): number {
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setAhora(Date.now()), intervaloMs)
    return () => window.clearInterval(id)
  }, [intervaloMs])
  return ahora
}
