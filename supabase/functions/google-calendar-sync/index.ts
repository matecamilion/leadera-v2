/**
 * google-calendar-sync
 *
 * Refleja una tarea o una visita de LeadEra como evento en el Google Calendar
 * del agente. Fase 1: one-way push, LeadEra -> Google.
 *
 * El contrato de entrada ya contempla las dos direcciones —`tipo` + `accion` +
 * `registro_id`— para que traer eventos de Google no obligue a rediseñarlo,
 * pero hoy sólo se llama desde LeadEra.
 *
 * "No conectado" NO es un error: la mayoría de los agentes no va a conectar
 * Calendar, y sus altas de tarea tienen que seguir andando igual. Por eso ese
 * caso vuelve 200 con `{ synced: false, reason: 'not_connected' }` y el
 * frontend lo ignora en silencio.
 *
 * Requiere sesión: el calendario que se toca es el del agente del JWT, y el
 * registro tiene que ser suyo. Sin ese chequeo, un agente podría empujar al
 * suyo propio la tarea de un compañero y leerle el título en el camino.
 *
 * Secretos: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET.
 */
import { preflight } from '../_shared/cors.ts'
import { errorResponse, jsonResponse } from '../_shared/http.ts'
import { adminClient, bearerToken } from '../_shared/supabase.ts'
import { GOOGLE_TOKEN_URL } from '../_shared/google.ts'
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3/calendars'
const TIMEOUT_GOOGLE_MS = 15_000

/**
 * Huso con el que se interpretan `fecha` y `hora`.
 *
 * Las dos columnas son `date` y `time` sin huso, y el resto de la app las trata
 * como hora de pared local —`momentoDeLaInteraccion` en `api/visitas.ts` las
 * arma con `new Date(a, m, d, hh, mm)`, que usa el del navegador—. Se declara
 * el mismo huso acá para que el evento caiga en Google a la hora que el agente
 * ve en LeadEra y no tres horas después.
 */
const ZONA = 'America/Argentina/Buenos_Aires'

/** Cuánto dura un evento sin hora de fin. No hay dato para diferenciar tarea de visita. */
const DURACION_HORAS = 1

/** Margen para considerar vencido un token: renovarlo justo al filo llega tarde. */
const MARGEN_VENCIMIENTO_S = 60

type Tipo = 'tarea' | 'visita'
type Accion = 'crear' | 'editar' | 'borrar'

interface Entrada {
  tipo: Tipo
  accion: Accion
  registro_id: string
  /**
   * Sólo para `borrar`: el id del evento en Google.
   *
   * Lo manda el frontend porque para cuando este sync corre, la fila de la
   * tarea o la visita ya se borró de Supabase —el borrado es un DELETE real, no
   * un soft-delete— y no hay de dónde leerlo, ni siquiera con service_role.
   */
  google_event_id?: string | null
}

interface FilaToken {
  id: string
  access_token: string
  refresh_token: string | null
  token_expiry: string | null
  google_calendar_id: string | null
  conectado: boolean
}

/** El evento tal como lo espera la Calendar API. */
interface EventoGoogle {
  summary: string
  description?: string | null
  start: Momento
  end: Momento
}

/** Google distingue evento de día completo (`date`) de evento con hora (`dateTime`). */
type Momento = { date: string } | { dateTime: string; timeZone: string }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(req)
  if (req.method !== 'POST') {
    return errorResponse(req, 'Método no permitido', 405, 'METODO_NO_PERMITIDO')
  }

  try {
    const admin = adminClient()

    // --- 1. Autenticación -------------------------------------------------
    const token = bearerToken(req)
    if (!token) {
      return errorResponse(req, 'Falta el token de autenticación', 401, 'NO_AUTENTICADO')
    }

    const { data: userData, error: userError } = await admin.auth.getUser(token)
    if (userError || !userData?.user) {
      return errorResponse(req, 'Sesión inválida o expirada', 401, 'NO_AUTENTICADO')
    }
    const agenteId = userData.user.id

    // --- 2. Entrada -------------------------------------------------------
    let entrada: Entrada
    try {
      entrada = await req.json()
    } catch {
      return errorResponse(req, 'El cuerpo no es JSON válido', 400, 'JSON_INVALIDO')
    }

    if (
      (entrada?.tipo !== 'tarea' && entrada?.tipo !== 'visita') ||
      !['crear', 'editar', 'borrar'].includes(entrada?.accion) ||
      typeof entrada?.registro_id !== 'string'
    ) {
      return errorResponse(
        req,
        'Se esperaba { tipo: "tarea"|"visita", accion: "crear"|"editar"|"borrar", registro_id: uuid }',
        400,
        'INPUT_INVALIDO',
      )
    }

    // --- 3. ¿El agente conectó Calendar? ----------------------------------
    const { data: fila, error: errorToken } = await admin
      .from('google_calendar_tokens')
      .select('id, access_token, refresh_token, token_expiry, google_calendar_id, conectado')
      .eq('agente_id', agenteId)
      .maybeSingle<FilaToken>()

    if (errorToken) {
      console.error(`google-calendar-sync: no se pudo leer el token de ${agenteId}`, errorToken)
      return errorResponse(req, 'No se pudo leer la conexión con Google', 500, 'ERROR_INTERNO')
    }

    // Sin fila o desconectado: estado normal, no error. El frontend no muestra nada.
    if (!fila || !fila.conectado) {
      return jsonResponse(req, { synced: false, reason: 'not_connected' })
    }

    // --- 4. Access token fresco -------------------------------------------
    const acceso = await asegurarAccessToken(admin, fila)
    if (!acceso) {
      return jsonResponse(req, { synced: false, reason: 'reauth_required' })
    }

    const calendarioId = fila.google_calendar_id ?? 'primary'

    // --- 5. Borrar: no necesita la fila, que ya no existe -----------------
    if (entrada.accion === 'borrar') {
      if (!entrada.google_event_id) {
        // El registro nunca llegó a Google —se creó con el agente
        // desconectado—, así que no hay nada que borrar allá.
        return jsonResponse(req, { synced: false, reason: 'sin_evento' })
      }

      const ok = await borrarEvento(calendarioId, entrada.google_event_id, acceso)
      if (!ok) {
        return errorResponse(req, 'Google rechazó el borrado del evento', 502, 'GOOGLE_API_ERROR')
      }

      // Defensivo: si la fila todavía existe —un cancelar que no borra, un
      // reintento— se le limpia el id, que ya no apunta a nada. Si no existe,
      // el update afecta 0 filas y no es un error.
      await admin
        .from(entrada.tipo === 'tarea' ? 'tareas' : 'visitas')
        .update({ google_event_id: null })
        .eq('id', entrada.registro_id)

      return jsonResponse(req, { synced: true, google_event_id: null })
    }

    // --- 6. Leer el registro, y que sea del agente ------------------------
    const registro = await leerRegistro(admin, entrada.tipo, entrada.registro_id, agenteId)
    if (!registro) {
      // No existe, o es de otro agente. No se distingue en la respuesta: decir
      // "existe pero no es tuyo" ya filtra información.
      return errorResponse(
        req,
        'No se encontró la tarea o la visita, o no es tuya',
        404,
        'REGISTRO_NO_ENCONTRADO',
      )
    }

    const evento = armarEvento(registro)

    // --- 7. Crear o editar -------------------------------------------------
    // Un `editar` sobre algo que nunca se sincronizó —se creó con el agente
    // desconectado y recién ahora conectó— se trata como alta: el PATCH no
    // tendría a qué apuntar y la alternativa sería no reflejarlo nunca.
    const esAlta = entrada.accion === 'crear' || !registro.google_event_id

    const eventId = esAlta
      ? await crearEvento(calendarioId, evento, acceso)
      : await editarEvento(calendarioId, registro.google_event_id as string, evento, acceso)

    if (!eventId) {
      return errorResponse(req, 'Google rechazó el evento', 502, 'GOOGLE_API_ERROR')
    }

    // Sólo se escribe si cambió: un PATCH devuelve el mismo id que ya estaba.
    if (eventId !== registro.google_event_id) {
      const { error: errorGuardado } = await admin
        .from(entrada.tipo === 'tarea' ? 'tareas' : 'visitas')
        .update({ google_event_id: eventId })
        .eq('id', entrada.registro_id)

      if (errorGuardado) {
        // El evento ya existe en Google. Perder el id acá significa que un
        // futuro editar va a crear un duplicado, así que se avisa fuerte, pero
        // no se le dice al usuario que falló algo que del lado de Google salió.
        console.error(
          `google-calendar-sync: evento ${eventId} creado en Google pero no se pudo guardar ` +
            `en ${entrada.tipo} ${entrada.registro_id}`,
          errorGuardado,
        )
      }
    }

    return jsonResponse(req, { synced: true, google_event_id: eventId })
  } catch (err) {
    console.error('google-calendar-sync: error inesperado', err)
    return errorResponse(req, 'Error interno del servidor', 500, 'ERROR_INTERNO')
  }
})

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

/**
 * Devuelve un access_token usable, renovándolo si hace falta. null si el agente
 * tiene que volver a autorizar.
 *
 * Cuando el refresh falla se baja `conectado` en la fila y no se borra nada: el
 * refresh_token revocado no sirve, pero la fila es lo que le permite a la UI
 * decir "reconectá" en vez de "conectá", y al callback conservar el histórico.
 */
async function asegurarAccessToken(
  admin: SupabaseClient,
  fila: FilaToken,
): Promise<string | null> {
  const vencimiento = fila.token_expiry ? Date.parse(fila.token_expiry) : 0
  const vigente = vencimiento - MARGEN_VENCIMIENTO_S * 1000 > Date.now()
  if (vigente) return fila.access_token

  if (!fila.refresh_token) {
    await marcarDesconectado(admin, fila.id)
    return null
  }

  const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')
  if (!clientId || !clientSecret) {
    console.error('google-calendar-sync: faltan GOOGLE_CLIENT_ID y/o GOOGLE_CLIENT_SECRET')
    return null
  }

  let respuesta: Response
  try {
    respuesta = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: fila.refresh_token,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
      }),
      signal: AbortSignal.timeout(TIMEOUT_GOOGLE_MS),
    })
  } catch (err) {
    // Google no contestó. NO se desconecta: el refresh_token puede estar
    // perfecto y ser un problema de red. Se falla este sync y listo.
    console.error('google-calendar-sync: no se pudo contactar a Google para refrescar', err)
    return null
  }

  if (!respuesta.ok) {
    const detalle = (await respuesta.text()).slice(0, 500)
    console.error(`google-calendar-sync: refresh rechazado (${respuesta.status}): ${detalle}`)
    // Un 4xx acá sí es el refresh_token revocado o vencido: el agente sacó el
    // permiso desde su cuenta de Google. Ahí sí se marca para que la UI se lo
    // pida de nuevo. Un 5xx es de Google y no amerita desconectar a nadie.
    if (respuesta.status >= 400 && respuesta.status < 500) {
      await marcarDesconectado(admin, fila.id)
    }
    return null
  }

  const datos = (await respuesta.json()) as { access_token?: string; expires_in?: number }
  if (!datos.access_token) return null

  const expiry = new Date(Date.now() + (datos.expires_in ?? 3600) * 1000).toISOString()

  const { error } = await admin
    .from('google_calendar_tokens')
    .update({
      access_token: datos.access_token,
      token_expiry: expiry,
      updated_at: new Date().toISOString(),
    })
    .eq('id', fila.id)

  if (error) {
    // Se sigue igual con el token en mano: no guardarlo sólo significa que el
    // próximo sync vuelve a refrescar, que es barato.
    console.error('google-calendar-sync: no se pudo guardar el access_token renovado', error)
  }

  return datos.access_token
}

async function marcarDesconectado(admin: SupabaseClient, filaId: string): Promise<void> {
  const { error } = await admin
    .from('google_calendar_tokens')
    .update({ conectado: false, updated_at: new Date().toISOString() })
    .eq('id', filaId)

  if (error) console.error('google-calendar-sync: no se pudo marcar desconectado', error)
}

// ---------------------------------------------------------------------------
// Lectura y mapeo
// ---------------------------------------------------------------------------

interface Registro {
  tipo: Tipo
  titulo: string
  descripcion: string | null
  fecha: string
  hora: string | null
  /** Sufijo de estado, o null si el estado no merece uno. */
  estadoVisible: string | null
  google_event_id: string | null
}

/**
 * Lee la tarea o la visita, siempre que sea del agente.
 *
 * El filtro por agente va a mano y no por RLS porque el cliente es service_role,
 * que la saltea. Se acepta `asignado_a` o `creado_por`, el mismo criterio con el
 * que el módulo de tareas decide qué le pertenece a quién.
 */
async function leerRegistro(
  admin: SupabaseClient,
  tipo: Tipo,
  id: string,
  agenteId: string,
): Promise<Registro | null> {
  const propio = `asignado_a.eq.${agenteId},creado_por.eq.${agenteId}`

  if (tipo === 'tarea') {
    const { data } = await admin
      .from('tareas')
      .select('titulo, descripcion, fecha, hora, estado, google_event_id')
      .eq('id', id)
      .or(propio)
      .maybeSingle<{
        titulo: string
        descripcion: string | null
        fecha: string
        hora: string | null
        estado: string
        google_event_id: string | null
      }>()

    if (!data) return null

    return {
      tipo,
      titulo: data.titulo,
      descripcion: data.descripcion,
      fecha: data.fecha,
      hora: data.hora,
      estadoVisible:
        data.estado === 'COMPLETADA'
          ? 'Completada'
          : data.estado === 'CANCELADA'
            ? 'Cancelada'
            : null,
      google_event_id: data.google_event_id,
    }
  }

  // La visita no tiene título propio: se arma con la dirección de la propiedad,
  // igual que `visitaAEvento` en `hooks/useTareas.ts`, para que el evento en
  // Google se lea igual que la fila en el calendario de LeadEra.
  const { data } = await admin
    .from('visitas')
    .select('fecha, hora, notas, estado, google_event_id, propiedades(direccion)')
    .eq('id', id)
    .or(propio)
    .maybeSingle<{
      fecha: string
      hora: string | null
      notas: string | null
      estado: string
      google_event_id: string | null
      propiedades: { direccion: string } | null
    }>()

  if (!data) return null

  return {
    tipo,
    titulo: `Visita: ${data.propiedades?.direccion ?? 'Propiedad'}`,
    descripcion: data.notas,
    fecha: data.fecha,
    hora: data.hora,
    estadoVisible: data.estado === 'CANCELADA' ? 'Cancelada' : null,
    google_event_id: data.google_event_id,
  }
}

/**
 * Registro a evento de Google.
 *
 * Una visita cancelada se edita a "(Cancelada)" en vez de borrarse: el agente
 * probablemente ya tiene ese bloque horario en la cabeza o se lo mostró a
 * alguien, y que el evento desaparezca sin dejar rastro es peor que verlo caído.
 */
function armarEvento(registro: Registro): EventoGoogle {
  const summary = registro.estadoVisible
    ? `${registro.titulo} (${registro.estadoVisible})`
    : registro.titulo

  return {
    summary,
    description: registro.descripcion,
    ...momentos(registro.fecha, registro.hora),
  }
}

/**
 * Inicio y fin del evento.
 *
 * Sin hora es un evento de día completo. Ahí `end.date` de Google es EXCLUSIVO:
 * para que ocupe un solo día hay que mandar el día siguiente, o el evento no
 * aparece.
 */
function momentos(fecha: string, hora: string | null): { start: Momento; end: Momento } {
  if (!hora) {
    return { start: { date: fecha }, end: { date: sumarUnDia(fecha) } }
  }

  // `time` de Postgres llega como `HH:MM:SS`; se normaliza a `HH:MM` y se
  // completan los segundos, que RFC3339 exige.
  const inicio = hora.slice(0, 5)
  const fin = sumarHoras(fecha, inicio, DURACION_HORAS)

  return {
    start: { dateTime: `${fecha}T${inicio}:00`, timeZone: ZONA },
    end: { dateTime: `${fin.fecha}T${fin.hora}:00`, timeZone: ZONA },
  }
}

/**
 * Aritmética de fechas en UTC a propósito.
 *
 * `Date.UTC` se usa como calculadora, no como huso: entra hora de pared y sale
 * hora de pared, con el desborde de día resuelto. Construir el Date con el
 * constructor local haría que el resultado dependiera del reloj del server,
 * que en Supabase es UTC y no el del agente.
 */
function sumarUnDia(fecha: string): string {
  const [a, m, d] = fecha.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d + 1)).toISOString().slice(0, 10)
}

function sumarHoras(
  fecha: string,
  hora: string,
  horas: number,
): { fecha: string; hora: string } {
  const [a, m, d] = fecha.split('-').map(Number)
  const [hh, mm] = hora.split(':').map(Number)
  const t = new Date(Date.UTC(a, m - 1, d, hh + horas, mm)).toISOString()
  return { fecha: t.slice(0, 10), hora: t.slice(11, 16) }
}

// ---------------------------------------------------------------------------
// Calendar API
// ---------------------------------------------------------------------------

function urlEventos(calendarioId: string, eventId?: string): string {
  const base = `${CALENDAR_API}/${encodeURIComponent(calendarioId)}/events`
  return eventId ? `${base}/${encodeURIComponent(eventId)}` : base
}

/** Devuelve el id del evento creado, o null si Google lo rechazó. */
async function crearEvento(
  calendarioId: string,
  evento: EventoGoogle,
  acceso: string,
): Promise<string | null> {
  const respuesta = await llamarGoogle(urlEventos(calendarioId), 'POST', evento, acceso)
  if (!respuesta) return null

  const datos = (await respuesta.json()) as { id?: string }
  return datos.id ?? null
}

/** Devuelve el id del evento editado, o null si Google lo rechazó. */
async function editarEvento(
  calendarioId: string,
  eventId: string,
  evento: EventoGoogle,
  acceso: string,
): Promise<string | null> {
  const respuesta = await llamarGoogle(
    urlEventos(calendarioId, eventId),
    'PATCH',
    evento,
    acceso,
  )
  if (!respuesta) return null

  const datos = (await respuesta.json()) as { id?: string }
  return datos.id ?? eventId
}

/**
 * true si el evento ya no está en Google, se haya borrado ahora o antes.
 *
 * 404 y 410 cuentan como éxito: el objetivo era que no estuviera, y ya no está.
 * Tratarlos como falla dejaría al frontend reintentando un borrado imposible.
 */
async function borrarEvento(
  calendarioId: string,
  eventId: string,
  acceso: string,
): Promise<boolean> {
  let respuesta: Response
  try {
    respuesta = await fetch(urlEventos(calendarioId, eventId), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${acceso}` },
      signal: AbortSignal.timeout(TIMEOUT_GOOGLE_MS),
    })
  } catch (err) {
    console.error('google-calendar-sync: no se pudo contactar a Google para borrar', err)
    return false
  }

  if (respuesta.ok || respuesta.status === 404 || respuesta.status === 410) return true

  console.error(
    `google-calendar-sync: Google respondió ${respuesta.status} al borrar ${eventId}: ` +
      (await respuesta.text()).slice(0, 500),
  )
  return false
}

/** POST/PATCH contra la Calendar API. null si no contestó o rechazó. */
async function llamarGoogle(
  url: string,
  metodo: 'POST' | 'PATCH',
  cuerpo: EventoGoogle,
  acceso: string,
): Promise<Response | null> {
  let respuesta: Response
  try {
    respuesta = await fetch(url, {
      method: metodo,
      headers: {
        Authorization: `Bearer ${acceso}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(TIMEOUT_GOOGLE_MS),
    })
  } catch (err) {
    console.error(`google-calendar-sync: no se pudo contactar a Google (${metodo})`, err)
    return null
  }

  if (!respuesta.ok) {
    console.error(
      `google-calendar-sync: Google respondió ${respuesta.status} en ${metodo}: ` +
        (await respuesta.text()).slice(0, 500),
    )
    return null
  }

  return respuesta
}
