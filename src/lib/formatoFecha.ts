/**
 * Formato de fechas del listado de leads.
 *
 * `tiempoTranscurrido` replica tiempo-transcurrido-pipe.ts del Angular:
 * misma cascada de umbrales y mismas cadenas, para que el listado se lea igual.
 */

/** Ídem TiempoTranscurridoPipe: instantes / N horas / Ayer / N días / fecha real. */
export function tiempoTranscurrido(fecha: string | null | undefined): string {
  if (!fecha) return 'Sin contacto'

  const pasada = new Date(fecha)
  if (Number.isNaN(pasada.getTime())) return 'Sin contacto'

  const diferenciaEnMs = Date.now() - pasada.getTime()
  const segundos = Math.floor(diferenciaEnMs / 1000)
  const minutos = Math.floor(segundos / 60)
  const horas = Math.floor(minutos / 60)
  const dias = Math.floor(horas / 24)

  if (dias === 0) {
    if (horas === 0) return 'Hace instantes'
    return `${horas} ${horas === 1 ? 'hora' : 'horas'}`
  }
  if (dias === 1) return 'Ayer'
  if (dias < 30) return `${dias} días`

  return pasada.toLocaleDateString('es-AR')
}

/** Un seguimiento vencido es el que ya quedó atrás. Ídem esVencido() del original. */
export function esVencido(fecha: string | null | undefined): boolean {
  if (!fecha) return false
  const f = new Date(fecha)
  if (Number.isNaN(f.getTime())) return false
  return f.getTime() < Date.now()
}

/** dd/mm/yyyy, o '—' si no hay fecha. */
export function formatearFecha(fecha: string | null | undefined): string {
  if (!fecha) return '—'
  const f = new Date(fecha)
  if (Number.isNaN(f.getTime())) return '—'
  return f.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/**
 * Cuánto pasó, para usar dentro de una frase: "hoy", "ayer", "hace 5 días",
 * "hace 4 semanas", "hace 3 meses", "hace 2 años". Vacío si no hay fecha.
 *
 * A diferencia de `tiempoTranscurrido`, no cae a una fecha suelta después de
 * un mes: sirve para frases como "Buscaba hace 4 semanas".
 */
export function haceCuantoTiempo(fecha: string | null | undefined): string {
  if (!fecha) return ''
  const pasada = new Date(fecha)
  if (Number.isNaN(pasada.getTime())) return ''

  const dias = Math.max(0, Math.floor((Date.now() - pasada.getTime()) / 86_400_000))
  if (dias === 0) return 'hoy'
  if (dias === 1) return 'ayer'
  if (dias < 14) return `hace ${dias} días`
  if (dias < 60) return `hace ${Math.floor(dias / 7)} semanas`
  if (dias < 365) {
    const meses = Math.floor(dias / 30)
    return `hace ${meses} ${meses === 1 ? 'mes' : 'meses'}`
  }
  const anios = Math.floor(dias / 365)
  return `hace ${anios} ${anios === 1 ? 'año' : 'años'}`
}
