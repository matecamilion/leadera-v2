import type { Visita } from '../types/database'
import { minutosDelDia } from './ordenEventos'

/**
 * Margen, en minutos, por debajo del cual dos visitas de la misma persona se
 * consideran pegadas. Es el único lugar donde vive el número.
 *
 * El conflicto es una diferencia MENOR a este margen: a 29 minutos avisa, a 30
 * ya no. La misma hora exacta (diferencia 0) también avisa.
 */
export const MARGEN_CONFLICTO_VISITAS_MIN = 30

/** Lo que el chequeo necesita de una visita ya existente. */
export type VisitaParaConflicto = Pick<Visita, 'id' | 'fecha' | 'hora' | 'estado' | 'asignado_a'>

export interface VisitaNueva {
  /** `YYYY-MM-DD`. */
  fecha: string
  /** `HH:MM` o `HH:MM:SS`; sin hora no hay conflicto. */
  hora: string | null | undefined
  /** A quién queda asignada, ya resuelto (ver `asignadoDeAlta`). */
  asignadoA: string
  /** Al editar una visita, la propia: no puede chocar consigo misma. */
  excluirId?: string
}

/**
 * La visita agendada que choca con la nueva, o null si no hay ninguna.
 *
 * Reglas:
 *  - Solo cuentan las AGENDADA (las REALIZADA y CANCELADA ya no ocupan agenda).
 *  - Mismo día y misma persona asignada: un agente y su asistente pueden tener
 *    visitas a la misma hora sin que sea conflicto.
 *  - Ambas con hora. Sin hora (todo el día) no hay conflicto.
 *  - Diferencia en minutos MENOR a `MARGEN_CONFLICTO_VISITAS_MIN`, hacia atrás o
 *    hacia adelante.
 *
 * Si hay más de una, devuelve la más cercana a la hora nueva; ante igual
 * cercanía, la más temprana. Fecha y hora son locales (de pared).
 */
export function buscarConflictoVisita<T extends VisitaParaConflicto>(
  nueva: VisitaNueva,
  visitas: readonly T[],
): T | null {
  const minutosNueva = minutosDelDia(nueva.hora)
  if (minutosNueva === null) return null

  let mejor: { visita: T; distancia: number; minutos: number } | null = null

  for (const visita of visitas) {
    if (visita.estado !== 'AGENDADA') continue
    if (visita.id === nueva.excluirId) continue
    if (visita.fecha !== nueva.fecha) continue
    if (visita.asignado_a !== nueva.asignadoA) continue

    const minutos = minutosDelDia(visita.hora)
    if (minutos === null) continue

    const distancia = Math.abs(minutos - minutosNueva)
    if (distancia >= MARGEN_CONFLICTO_VISITAS_MIN) continue

    if (
      !mejor ||
      distancia < mejor.distancia ||
      (distancia === mejor.distancia && minutos < mejor.minutos)
    ) {
      mejor = { visita, distancia, minutos }
    }
  }

  return mejor?.visita ?? null
}

/** De la visita en conflicto, lo que hace falta para describirla. */
export interface VisitaDescribible {
  hora: string | null
  titulo_externo: string | null
  propiedad: { direccion: string } | null
  lead: { nombre: string; apellido: string | null } | null
}

/** `HH:MM`, sin los segundos que trae la base. */
function horaCorta(hora: string | null): string {
  return hora ? hora.slice(0, 5) : ''
}

/** "10:15 · Güemes 2450 · con Ana Pérez": qué es la visita con la que se choca. */
export function describirVisita(visita: VisitaDescribible): string {
  const donde = visita.propiedad?.direccion ?? visita.titulo_externo ?? 'sin propiedad'
  const partes = [horaCorta(visita.hora), donde]
  if (visita.lead) {
    partes.push(`con ${`${visita.lead.nombre} ${visita.lead.apellido ?? ''}`.trim()}`)
  }
  return partes.join(' · ')
}

/**
 * El título del aviso.
 *
 * `esUnoMismo` es true cuando quien agenda es la propia persona asignada. Si la
 * visita queda a nombre de otro —el dueño que asigna, o un asistente que carga en
 * el calendario de su agente— se nombra a esa persona; sin nombre a mano, "La
 * persona asignada".
 */
export function tituloConflictoVisita(quien: { esUnoMismo: boolean; nombre?: string | null }): string {
  if (quien.esUnoMismo) return 'Se superpone con otra visita'
  return `${quien.nombre?.trim() || 'La persona asignada'} ya tiene una visita cerca`
}
