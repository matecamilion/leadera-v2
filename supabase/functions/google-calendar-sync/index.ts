/**
 * google-calendar-sync
 *
 * Refleja una tarea o una visita de LeadEra como evento en el Google Calendar
 * del agente. One-way push, LeadEra -> Google.
 *
 * Un ASISTENTE no tiene calendario propio: opera el de su agente
 * (`profiles.asiste_a`) y lo que hace se refleja en el Google DEL AGENTE, con el
 * token del agente. Solo el agente (o el dueño que hace de agente) conecta
 * Google. La decisión de a qué calendario se empuja y la validación de que el
 * asistente pertenece a ese agente viven en `logica.ts`, que se testea sin red;
 * este archivo es el HTTP y las lecturas/escrituras reales.
 *
 * El contrato de entrada ya contempla las dos direcciones —`tipo` + `accion` +
 * `registro_id`— para que traer eventos de Google no obligue a rediseñarlo,
 * pero hoy sólo se llama desde LeadEra. El cuerpo nunca aporta un id de agente:
 * el dueño del calendario sale de la base con el JWT validado.
 *
 * "No conectado" NO es un error: la mayoría de los agentes no va a conectar
 * Calendar, y sus altas de tarea tienen que seguir andando igual. Por eso ese
 * caso vuelve 200 con `{ synced: false, reason: 'not_connected' }` y el
 * frontend lo ignora en silencio.
 *
 * Logs: se registra quién dispara cada llamada (id y rol) y los estados HTTP de
 * Google. Nunca tokens ni cuerpos de respuesta de Google.
 *
 * Secretos: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET.
 */
import { preflight } from '../_shared/cors.ts'
import { errorResponse, jsonResponse, type ErrorCode } from '../_shared/http.ts'
import { adminClient, bearerToken } from '../_shared/supabase.ts'
import { GOOGLE_TOKEN_URL } from '../_shared/google.ts'
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { googleReal } from './googleApi.ts'
import { ErrorLecturaPerfil, leerPerfilesDe } from './perfiles.ts'
import {
  type Disparador,
  type DepsSync,
  type Entrada,
  type FilaToken,
  type FilaVisita,
  type Registro,
  type Tipo,
  ejecutarSync,
  visitaARegistro,
} from './logica.ts'

const TIMEOUT_GOOGLE_MS = 15_000

/** Margen para considerar vencido un token: renovarlo justo al filo llega tarde. */
const MARGEN_VENCIMIENTO_S = 60

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

    // --- 3. Todo lo demás: autorización, token y Google -------------------
    const salida = await ejecutarSync(depsReales(admin), userData.user.id, entrada)

    return salida.tipo === 'json'
      ? jsonResponse(req, salida.cuerpo, salida.status)
      : errorResponse(req, salida.mensaje, salida.status, salida.code as ErrorCode)
  } catch (err) {
    // Un fallo de lectura de base se distingue en el log de un rechazo por
    // permiso (403): el cliente ignora los errores del sync, así que el log es
    // lo único que dice cuál de las dos cosas pasó.
    if (err instanceof ErrorLecturaPerfil) {
      console.error(`google-calendar-sync: no se pudo leer el perfil (error de base, no de permiso): ${err.message}`)
    } else {
      console.error('google-calendar-sync: error inesperado', err)
    }
    return errorResponse(req, 'Error interno del servidor', 500, 'ERROR_INTERNO')
  }
})

// ---------------------------------------------------------------------------
// Dependencias reales
// ---------------------------------------------------------------------------

function depsReales(admin: SupabaseClient): DepsSync {
  return {
    log: (mensaje) => console.warn(mensaje),

    // Perfil del usuario y, solo si es un asistente con `asiste_a`, el de su
    // agente: DOS consultas simples por id, sin embeds ni hints de FK (la FK
    // `profiles_asiste_a_fkey` es autorreferenciada y el embed es ambiguo).
    leerPerfiles: (userId) =>
      leerPerfilesDe(
        (id) =>
          admin
            .from('profiles')
            .select('id, rol, activo, asiste_a, inmobiliaria_id')
            .eq('id', id)
            .maybeSingle(),
        userId,
      ),

    // Incluye inactivos: lo que cargó un asistente antes de darse de baja sigue
    // siendo del calendario del equipo.
    async leerAsistentesIds(duenoCalendario, inmobiliariaId) {
      const { data, error } = await admin
        .from('profiles')
        .select('id')
        .eq('asiste_a', duenoCalendario)
        .eq('inmobiliaria_id', inmobiliariaId)

      if (error) throw error
      return (data ?? []).map((f: { id: string }) => f.id)
    },

    async leerToken(duenoCalendario) {
      const { data, error } = await admin
        .from('google_calendar_tokens')
        .select('id, access_token, refresh_token, token_expiry, google_calendar_id, conectado')
        .eq('agente_id', duenoCalendario)
        .maybeSingle<FilaToken>()

      if (error) throw error
      return data
    },

    asegurarAccessToken: (fila, disparadoPor) => asegurarAccessToken(admin, fila, disparadoPor),

    leerRegistro: (tipo, id, contexto) => leerRegistro(admin, tipo, id, contexto),

    async guardarEventId(tipo, id, eventId) {
      const { error } = await admin
        .from(tipo === 'tarea' ? 'tareas' : 'visitas')
        .update({ google_event_id: eventId })
        .eq('id', id)

      if (error) {
        // El evento ya existe en Google. Perder el id acá significa que un
        // futuro editar va a crear un duplicado, así que se avisa fuerte, pero
        // no se le dice al usuario que falló algo que del lado de Google salió.
        console.error(
          `google-calendar-sync: evento ${eventId} creado en Google pero no se pudo guardar ` +
            `en ${tipo} ${id}`,
          error,
        )
      }
    },

    google: googleReal,
  }
}

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
 * La fila es la del AGENTE aunque dispare la llamada un asistente, por eso cada
 * baja registra quién la provocó.
 */
async function asegurarAccessToken(
  admin: SupabaseClient,
  fila: FilaToken,
  disparadoPor: Disparador,
): Promise<string | null> {
  const vencimiento = fila.token_expiry ? Date.parse(fila.token_expiry) : 0
  const vigente = vencimiento - MARGEN_VENCIMIENTO_S * 1000 > Date.now()
  if (vigente) return fila.access_token

  if (!fila.refresh_token) {
    await marcarDesconectado(admin, fila.id, disparadoPor, 'sin refresh_token')
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
    // Solo el estado: el cuerpo no se registra.
    console.error(
      `google-calendar-sync: refresh rechazado (${respuesta.status}); ` +
        `lo disparó ${disparadoPor.id} (${disparadoPor.rol})`,
    )
    // Un 4xx acá sí es el refresh_token revocado o vencido: el agente sacó el
    // permiso desde su cuenta de Google. Ahí sí se marca para que la UI se lo
    // pida de nuevo. Un 5xx es de Google y no amerita desconectar a nadie.
    if (respuesta.status >= 400 && respuesta.status < 500) {
      await marcarDesconectado(admin, fila.id, disparadoPor, `refresh ${respuesta.status}`)
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

async function marcarDesconectado(
  admin: SupabaseClient,
  filaId: string,
  disparadoPor: Disparador,
  motivo: string,
): Promise<void> {
  console.warn(
    `google-calendar-sync: se marca desconectada la conexión ${filaId} (${motivo}); ` +
      `lo disparó ${disparadoPor.id} (${disparadoPor.rol})`,
  )

  const { error } = await admin
    .from('google_calendar_tokens')
    .update({ conectado: false, updated_at: new Date().toISOString() })
    .eq('id', filaId)

  if (error) console.error('google-calendar-sync: no se pudo marcar desconectado', error)
}

// ---------------------------------------------------------------------------
// Lectura del registro
// ---------------------------------------------------------------------------

/**
 * Lee la tarea o la visita, siempre que sea del equipo del dueño del calendario.
 *
 * Los filtros van a mano y no por RLS porque el cliente es service_role, que la
 * saltea: la misma inmobiliaria que el usuario, y que la fila la haya creado o
 * la tenga asignada alguien del equipo (el agente y sus asistentes).
 */
async function leerRegistro(
  admin: SupabaseClient,
  tipo: Tipo,
  id: string,
  contexto: { inmobiliariaId: string; equipoIds: string[] },
): Promise<Registro | null> {
  const ids = contexto.equipoIds.join(',')
  const delEquipo = `asignado_a.in.(${ids}),creado_por.in.(${ids})`

  if (tipo === 'tarea') {
    const { data } = await admin
      .from('tareas')
      .select('titulo, descripcion, fecha, hora, estado, google_event_id')
      .eq('id', id)
      .eq('inmobiliaria_id', contexto.inmobiliariaId)
      .or(delEquipo)
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

  // El título y la descripción de la visita los arma `visitaARegistro`: la
  // dirección de la propiedad, o el título de una visita externa.
  const { data } = await admin
    .from('visitas')
    .select(
      'fecha, hora, notas, estado, google_event_id, titulo_externo, link_externo, propiedades(direccion)',
    )
    .eq('id', id)
    .eq('inmobiliaria_id', contexto.inmobiliariaId)
    .or(delEquipo)
    .maybeSingle<FilaVisita>()

  if (!data) return null

  return visitaARegistro(data)
}
