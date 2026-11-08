/**
 * Avisos push de visitas: cuándo corresponde cada uno y qué dicen. Módulo puro:
 * sin npm, sin Deno, sin red.
 *
 *   VISITA_PROXIMA  faltan MIN_ANTES minutos o menos y la visita no empezó.
 *   VISITA_POST     pasaron MIN_DESPUES minutos o más desde la hora de la
 *                   visita, hasta TOPE_POST_MIN. Después de eso no se manda.
 *
 * `visitas.fecha` y `visitas.hora` son `date` y `time` sin huso: se leen como
 * hora de pared de Argentina (UTC-3 todo el año, sin horario de verano).
 */
import { recortar } from './resumenTexto.ts'

export const MIN_ANTES = 60
export const MIN_DESPUES = 30
export const TOPE_POST_MIN = 180

export const MAX_TITULO_AVISO = 60
export const MAX_CUERPO_AVISO = 120

/** Lo mínimo de la dirección que se conserva antes de empezar a recortar el nombre. */
const MIN_LUGAR = 10

const MS_MINUTO = 60_000
const MS_DIA = 86_400_000
const OFFSET_ARGENTINA_MS = 3 * 3_600_000

export type TipoAviso = 'VISITA_PROXIMA' | 'VISITA_POST'

/** Instante (ms UTC) en que empieza la visita. NaN si `fecha` u `hora` no son válidas. */
export function inicioDeVisita(fecha: string, hora: string): number {
  return Date.parse(`${fecha}T${hora.slice(0, 5)}:00-03:00`)
}

/** Día `YYYY-MM-DD` de Argentina del instante. */
export function fechaEnArgentina(ms: number): string {
  return new Date(ms - OFFSET_ARGENTINA_MS).toISOString().slice(0, 10)
}

/**
 * Los días de Argentina que hay que leer: ayer, hoy y mañana. Mañana porque el
 * recordatorio de una visita a las 00:30 sale a las 23:30 del día anterior;
 * ayer porque el post de una visita de las 23:00 sale pasada la medianoche.
 */
export function fechasDeLectura(ahoraMs: number): string[] {
  return [ahoraMs - MS_DIA, ahoraMs, ahoraMs + MS_DIA].map(fechaEnArgentina)
}

export function decidirAviso(ahoraMs: number, inicioMs: number): TipoAviso | null {
  const faltan = (inicioMs - ahoraMs) / MS_MINUTO
  if (faltan > 0 && faltan <= MIN_ANTES) return 'VISITA_PROXIMA'
  const pasaron = -faltan
  if (pasaron >= MIN_DESPUES && pasaron <= TOPE_POST_MIN) return 'VISITA_POST'
  return null
}

/** Cambia si cambia la hora o el día de la visita: un cambio genera un aviso nuevo. */
export function refDeVisita(visitaId: string, inicioMs: number): string {
  return `${visitaId}@${new Date(inicioMs).toISOString()}`
}

/** Sin "@" ni "." (el `ref` los tiene): `enviar-push` solo acepta [A-Za-z0-9:_-]. */
export function tagDeAviso(tipo: TipoAviso, visitaId: string): string {
  return `${tipo === 'VISITA_PROXIMA' ? 'visita-proxima' : 'visita-post'}-${visitaId}`
}

/** La ficha del lead si la visita tiene uno; si no, la pantalla de tareas y visitas. */
export function urlDeAviso(leadId: string | null): string {
  return leadId ? `/leads/${leadId}` : '/tareas'
}

export function nombreDeLead(lead: { nombre: string; apellido: string | null } | null): string | null {
  if (!lead) return null
  return [lead.nombre, lead.apellido].map((p) => p?.trim()).filter(Boolean).join(' ') || null
}

/** La dirección de la propiedad o, en una visita externa, su título. */
export function lugarDeVisita(direccion: string | null, tituloExterno: string | null): string | null {
  return direccion?.trim() || tituloExterno?.trim() || null
}

export interface DatosAviso {
  tipo: TipoAviso
  /** `HH:MM` o `HH:MM:SS`. */
  hora: string
  nombre: string | null
  lugar: string | null
}

export interface TextoAviso {
  title: string
  body: string
}

export function textoDeAviso({ tipo, hora, nombre, lugar }: DatosAviso): TextoAviso {
  if (tipo === 'VISITA_POST') {
    return {
      title: armarTitulo('¿Cómo te fue', '?', nombre, lugar),
      body: nombre ? 'Registrá cómo fue en la ficha del lead.' : 'Marcá la visita como realizada en Tareas.',
    }
  }
  const hh = hora.slice(0, 5)
  const partes = [`Empieza a las ${hh}.`, lugar && `${lugar}.`, nombre && `Con ${nombre}.`]
  return {
    title: armarTitulo(`Visita a las ${hh}`, '', nombre, lugar),
    body: recortar(partes.filter(Boolean).join(' '), MAX_CUERPO_AVISO),
  }
}

/**
 * `<head> con <nombre> en <lugar><tail>`, de hasta MAX_TITULO_AVISO caracteres.
 * Lo que falta (nombre o lugar) se omite. Si no entra, se recorta primero la
 * dirección (hasta MIN_LUGAR caracteres) y recién después el nombre.
 */
function armarTitulo(head: string, tail: string, nombre: string | null, lugar: string | null): string {
  const fijo = head.length + tail.length + (nombre ? ' con '.length : 0) + (lugar ? ' en '.length : 0)
  const presupuesto = MAX_TITULO_AVISO - fijo
  let n = nombre
  let l = lugar

  if (n !== null && l !== null) {
    if (n.length + l.length > presupuesto) {
      const libre = presupuesto - n.length
      if (libre >= MIN_LUGAR) {
        l = recortar(l, libre)
      } else {
        l = recortar(l, MIN_LUGAR)
        n = recortar(n, presupuesto - l.length)
      }
    }
  } else if (n !== null) {
    n = recortar(n, presupuesto)
  } else if (l !== null) {
    l = recortar(l, presupuesto)
  }

  return `${head}${n ? ` con ${n}` : ''}${l ? ` en ${l}` : ''}${tail}`
}
