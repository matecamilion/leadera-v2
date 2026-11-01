/**
 * Llamadas a la Calendar API de Google.
 *
 * Aparte de `index.ts` para poder testear con un `fetch` simulado cómo se
 * traducen los estados HTTP (404 y 410 son "ya no existe") sin tocar la red.
 *
 * Solo se registra el estado HTTP: el cuerpo de la respuesta puede traer datos
 * de la agenda del agente y no se escribe en los logs.
 */
import { MARCA_ORIGEN } from '../_shared/google.ts'
import type {
  EventoGoogle,
  GoogleApi,
  ResultadoEditar,
  ResultadoObtener,
} from './logica.ts'

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3/calendars'
const TIMEOUT_GOOGLE_MS = 15_000

function urlEventos(calendarioId: string, eventId?: string): string {
  const base = `${CALENDAR_API}/${encodeURIComponent(calendarioId)}/events`
  return eventId ? `${base}/${encodeURIComponent(eventId)}` : base
}

/** 404 y 410 son "ya no existe": Google responde uno u otro según el evento. */
function noExiste(status: number): boolean {
  return status === 404 || status === 410
}

/** Una llamada a la Calendar API. `null` si Google no contestó. */
async function llamar(
  metodo: 'POST' | 'PATCH' | 'GET' | 'DELETE',
  url: string,
  acceso: string,
  cuerpo?: EventoGoogle,
): Promise<Response | null> {
  try {
    return await fetch(url, {
      method: metodo,
      headers: {
        Authorization: `Bearer ${acceso}`,
        ...(cuerpo ? { 'Content-Type': 'application/json' } : {}),
      },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_GOOGLE_MS),
    })
  } catch (err) {
    console.error(`google-calendar-sync: no se pudo contactar a Google (${metodo})`, err)
    return null
  }
}

export const googleReal: GoogleApi = {
  async crear(calendarioId, evento, acceso) {
    const respuesta = await llamar('POST', urlEventos(calendarioId), acceso, evento)
    if (!respuesta) return null
    if (!respuesta.ok) {
      console.error(`google-calendar-sync: Google respondió ${respuesta.status} en POST`)
      return null
    }
    const datos = (await respuesta.json()) as { id?: string }
    return datos.id ?? null
  },

  async editar(calendarioId, eventId, evento, acceso): Promise<ResultadoEditar> {
    const respuesta = await llamar('PATCH', urlEventos(calendarioId, eventId), acceso, evento)
    if (!respuesta) return { estado: 'error' }
    if (noExiste(respuesta.status)) return { estado: 'no_existe' }
    if (!respuesta.ok) {
      console.error(`google-calendar-sync: Google respondió ${respuesta.status} en PATCH`)
      return { estado: 'error' }
    }
    const datos = (await respuesta.json()) as { id?: string }
    return { estado: 'ok', id: datos.id ?? eventId }
  },

  async obtener(calendarioId, eventId, acceso): Promise<ResultadoObtener> {
    // `fields` pide solo lo que hace falta para decidir: el estado y la marca.
    const url = `${urlEventos(calendarioId, eventId)}?fields=id,status,extendedProperties`
    const respuesta = await llamar('GET', url, acceso)
    if (!respuesta) return { estado: 'error' }
    if (noExiste(respuesta.status)) return { estado: 'no_existe' }
    if (!respuesta.ok) {
      console.error(`google-calendar-sync: Google respondió ${respuesta.status} en GET`)
      return { estado: 'error' }
    }
    const datos = (await respuesta.json()) as {
      status?: string
      extendedProperties?: { private?: Record<string, string> }
    }
    return {
      estado: 'ok',
      cancelado: datos.status === 'cancelled',
      marcado: datos.extendedProperties?.private?.[MARCA_ORIGEN.clave] === MARCA_ORIGEN.valor,
    }
  },

  async borrar(calendarioId, eventId, acceso) {
    const respuesta = await llamar('DELETE', urlEventos(calendarioId, eventId), acceso)
    if (!respuesta) return false
    if (respuesta.ok || noExiste(respuesta.status)) return true
    console.error(`google-calendar-sync: Google respondió ${respuesta.status} en DELETE`)
    return false
  },
}
