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
