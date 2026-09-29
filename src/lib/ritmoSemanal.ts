/**
 * El ritmo de una meta semanal: cuánto debería llevar el agente a esta altura
 * de la semana del modelo de gestión (miércoles a martes).
 *
 * Funciones puras, sin React ni Supabase.
 */

const ZONA_AR = 'America/Argentina/Buenos_Aires'

/**
 * `en-CA` formatea como `YYYY-MM-DD`. Se arma una sola vez: construir un
 * `Intl.DateTimeFormat` es caro y esto corre en cada render de la tarjeta.
 */
const FORMATO_DIA_AR = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA_AR,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/**
 * Hoy como `YYYY-MM-DD` en hora argentina, no en la del navegador.
 *
 * `hoyComoClave()` de `lib/calendario` usa la zona local, que alcanza para los
 * formularios. Acá no: la semana la corta la base en hora argentina, y un
 * agente con el navegador en otra zona vería el ritmo corrido un día.
 */
export function hoyEnArgentina(ahora: Date = new Date()): string {
  return FORMATO_DIA_AR.format(ahora)
}

/** Días enteros entre dos claves `YYYY-MM-DD`, sin que el horario de verano mueva nada. */
function diasEntre(desde: string, hasta: string): number {
  const aUtc = (clave: string) => {
    const [a, m, d] = clave.split('-').map(Number)
    return Date.UTC(a, m - 1, d)
  }
  return Math.round((aUtc(hasta) - aUtc(desde)) / 86_400_000)
}

export interface Ritmo {
  /** Día de la semana de gestión: miércoles = 1, martes = 7. */
  dia: number
  /** Cuánto debería llevar al empezar hoy para llegar a la meta a ritmo parejo. */
  esperado: number
  alDia: boolean
  /** Cuánto le falta para alcanzar `esperado`. 0 si ya está al día. */
  faltan: number
}

export function calcularRitmo(
  valor: number,
  meta: number,
  semanaInicio: string,
  hoy: string,
): Ritmo {
  const dia = Math.min(Math.max(diasEntre(semanaInicio, hoy) + 1, 1), 7)
  // Con el día anterior: lo esperado es lo que ya debería estar hecho al
  // arrancar hoy. Con `dia` el miércoles a la mañana ya pedía actividades.
  const esperado = Math.round((meta * (dia - 1)) / 7)
  return {
    dia,
    esperado,
    alDia: valor >= esperado,
    faltan: Math.max(0, esperado - valor),
  }
}
