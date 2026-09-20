/**
 * google-calendar-import
 *
 * Fase 2: trae a LeadEra los eventos que el agente crea directo en su Google
 * Calendar. La dirección inversa a `google-calendar-sync`.
 *
 * La dispara un cron (ver la migración `..._google_calendar_importacion_cron`)
 * con la service role key. No la llama el frontend.
 *
 * Sólo procesa las cuentas con `importacion_activa = true`. La bandera arranca
 * apagada a propósito (ver la migración `..._importacion_opt_in`): la primera
 * corrida de una cuenta trae todo su calendario de los próximos 90 días,
 * incluida su agenda personal, así que eso se prende cuenta por cuenta.
 *
 * Por cada cuenta con `conectado = true` e `importacion_activa = true`:
 *   1. Lista eventos: con `sync_token` sólo lo cambiado desde la última vez;
 *      sin él, desde hoy hasta IMPORTAR_DIAS días adelante.
 *   2. Descarta lo que no se importa (ver `motivoParaSaltear`), en especial lo
 *      que creó LeadEra: por la marca de origen y, como segunda red, porque el
 *      `google_event_id` ya existe para ese agente.
 *   3. De una serie recurrente entra UNA sola fila, la primera ocurrencia: un
 *      "Gym" de todos los días son 90 eventos en la ventana inicial y 90 tareas
 *      no son una agenda, son ruido.
 *   4. "Visita: <dirección>" con match fuerte contra una propiedad → visita.
 *      Todo lo demás → tarea. Lead siempre vacío: lo completa el agente.
 *   5. Guarda el `nextSyncToken` sólo si todo lo leído se procesó bien; si algo
 *      falló, la corrida siguiente vuelve a leer lo mismo y el índice único
 *      (asignado_a, google_event_id) evita duplicar lo que ya entró.
 *
 * Una cuenta que falla no frena a las demás.
 *
 * Entrada opcional: `{ "agente_id": "<uuid>" }` limita la corrida a una sola
 * cuenta. Es para probar a mano sin tocar las cuentas reales.
 *
 * Secretos: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET.
 */
import { adminClient, bearerToken } from '../_shared/supabase.ts'
import { GOOGLE_TOKEN_URL, MARCA_ORIGEN } from '../_shared/google.ts'
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3/calendars'
const TIMEOUT_GOOGLE_MS = 15_000
const MARGEN_VENCIMIENTO_S = 60

/** Mismo huso con el que `google-calendar-sync` escribe: hora de pared argentina. */
const ZONA = 'America/Argentina/Buenos_Aires'
/** Offset fijo de ZONA (Argentina no tiene horario de verano). */
const OFFSET_ZONA = '-03:00'

/** Ventana de la primera corrida de una cuenta. */
const IMPORTAR_DIAS = 90

/** Corridas seguidas con error transitorio antes de registrarlo como error. */
const FALLOS_ANTES_DE_REGISTRAR = 3

/**
 * Umbral del match de dirección (0 a 1, ver `buscar_propiedad_por_direccion`).
 * Además del umbral se exige que coincida la altura y que no haya otra
 * propiedad casi igual de parecida: ver `elegirPropiedad`.
 */
const UMBRAL_MATCH = 0.6
/** Distancia mínima entre el mejor y el segundo para no considerarlo ambiguo. */
const MARGEN_AMBIGUEDAD = 0.1

const PREFIJO_VISITA = /^\s*visita\s*:\s*/i
const SUFIJO_ESTADO = /\s*\((cancelada|completada)\)\s*$/i

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface Cuenta {
  id: string
  agente_id: string
  access_token: string
  refresh_token: string | null
  token_expiry: string | null
  google_calendar_id: string | null
  sync_token: string | null
  importacion_activa: boolean
  importacion_fallos_seguidos: number
}

interface EventoGoogle {
  id: string
  /** Presente sólo en las instancias de una serie: el id del evento madre. */
  recurringEventId?: string
  status?: string
  summary?: string
  description?: string
  eventType?: string
  start?: { date?: string; dateTime?: string }
  attendees?: { self?: boolean; responseStatus?: string }[]
  extendedProperties?: { private?: Record<string, string> }
}

interface Resumen {
  agente_id: string
  modo: 'completo' | 'incremental'
  leidos: number
  visitas: number
  tareas: number
  tareas_posible_visita: number
  salteados: Record<string, number>
  resultado:
    | 'ok'
    | 'error'
    | 'error_transitorio'
    | 'sync_token_vencido'
    | 'reautorizar'
    | 'importacion_no_activada'
  error?: string
}

/** Un error con su clasificación: transitorio = se reintenta sin registrarlo. */
class ErrorImportacion extends Error {
  constructor(mensaje: string, readonly transitorio: boolean) {
    super(mensaje)
  }
}

/** Google dijo 410: el sync_token caducó. */
class SyncTokenVencido extends Error {}

// ---------------------------------------------------------------------------
// Entrada
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Método no permitido', { status: 405 })

  // La firma del JWT ya la verificó el gateway (verify_jwt = true): acá sólo se
  // exige que sea la service role y no la sesión de un agente, porque esta
  // función lee y escribe en las cuentas de todos.
  if (rolDelJwt(bearerToken(req)) !== 'service_role') {
    return new Response('forbidden', { status: 403 })
  }

  const entrada = (await req.json().catch(() => ({}))) as { agente_id?: string }
  const admin = adminClient()

  let query = admin
    .from('google_calendar_tokens')
    .select(
      'id, agente_id, access_token, refresh_token, token_expiry, google_calendar_id, sync_token, importacion_activa, importacion_fallos_seguidos',
    )
    .eq('conectado', true)
  if (entrada.agente_id) query = query.eq('agente_id', entrada.agente_id)

  const { data: cuentas, error } = await query
  if (error) {
    // Sin la lista de cuentas no hay nada que hacer; la próxima corrida reintenta.
    console.error('google-calendar-import: no se pudieron leer las cuentas', error)
    return Response.json({ error: 'lectura_cuentas', detalle: error.message }, { status: 500 })
  }

  const resumenes: Resumen[] = []
  // En serie y no en paralelo: son pocas cuentas y así un pico de Google o de
  // la base no se multiplica por la cantidad de agentes.
  for (const cuenta of (cuentas ?? []) as Cuenta[]) {
    // Sin opt-in no se toca nada de esa cuenta: ni Google, ni sus contadores de
    // error. Aparece en el resumen para que se vea que existe y está apagada.
    if (!cuenta.importacion_activa) {
      resumenes.push(resumenVacio(cuenta, 'importacion_no_activada'))
      continue
    }
    resumenes.push(await importarCuenta(admin, cuenta))
  }

  return Response.json({ cuentas: resumenes.length, resumenes })
})

// ---------------------------------------------------------------------------
// Por cuenta
// ---------------------------------------------------------------------------

function resumenVacio(cuenta: Cuenta, resultado: Resumen['resultado']): Resumen {
  return {
    agente_id: cuenta.agente_id,
    modo: cuenta.sync_token ? 'incremental' : 'completo',
    leidos: 0,
    visitas: 0,
    tareas: 0,
    tareas_posible_visita: 0,
    salteados: {},
    resultado,
  }
}

async function importarCuenta(admin: SupabaseClient, cuenta: Cuenta): Promise<Resumen> {
  const resumen = resumenVacio(cuenta, 'ok')

  try {
    const acceso = await accesoVigente(admin, cuenta)
    if (!acceso) {
      // `accesoVigente` ya bajó `conectado` si el permiso fue revocado. No es un
      // error de importación: la UI le pide al agente que reconecte.
      resumen.resultado = 'reautorizar'
      return resumen
    }

    const { data: perfil, error: errorPerfil } = await admin
      .from('profiles')
      .select('inmobiliaria_id')
      .eq('id', cuenta.agente_id)
      .maybeSingle()
    if (errorPerfil) throw errorDeBase(errorPerfil)
    if (!perfil) throw new ErrorImportacion('El agente no tiene perfil', false)

    const hoy = fechaEnZona(new Date())
    const calendario = cuenta.google_calendar_id ?? 'primary'

    let pageToken: string | undefined
    let nextSyncToken: string | undefined
    let fallosDeEventos = 0
    /** Ids madre de las series que ya tuvieron su ocurrencia en esta corrida. */
    const series = new Set<string>()

    do {
      const pagina = await listarEventos(calendario, acceso, cuenta.sync_token, hoy, pageToken)
      pageToken = pagina.nextPageToken
      nextSyncToken = pagina.nextSyncToken ?? nextSyncToken
      resumen.leidos += pagina.items.length

      const yaExisten = await idsExistentes(admin, cuenta.agente_id, pagina.items.map((e) => e.id))

      // Por fecha de inicio: de una serie recurrente se queda la primera
      // ocurrencia, y "primera" sólo significa algo si vienen ordenadas. Google
      // no garantiza el orden (con syncToken ni siquiera se puede pedir).
      const ordenados = [...pagina.items].sort((a, b) =>
        (momentoEnZona(a).fecha ?? '').localeCompare(momentoEnZona(b).fecha ?? ''),
      )

      for (const evento of ordenados) {
        const motivo = motivoParaSaltear(evento, hoy, yaExisten)
        if (motivo) {
          resumen.salteados[motivo] = (resumen.salteados[motivo] ?? 0) + 1
          continue
        }

        if (evento.recurringEventId && (await yaHaySerie(admin, cuenta, evento.recurringEventId, series))) {
          resumen.salteados.ocurrencia_repetida = (resumen.salteados.ocurrencia_repetida ?? 0) + 1
          continue
        }

        try {
          const creado = await importarEvento(admin, evento, cuenta.agente_id, perfil.inmobiliaria_id)
          if (creado === 'visita') resumen.visitas++
          else if (creado === 'tarea') resumen.tareas++
          else if (creado === 'posible_visita') resumen.tareas_posible_visita++
          else resumen.salteados.ya_importado = (resumen.salteados.ya_importado ?? 0) + 1
        } catch (err) {
          fallosDeEventos++
          console.error(`google-calendar-import: evento ${evento.id} de ${cuenta.agente_id}`, err)
        }
      }
    } while (pageToken)

    if (fallosDeEventos > 0) {
      // Sin avanzar el sync_token: la próxima corrida relee y reintenta. Lo que
      // sí entró no se duplica por el índice único.
      throw new ErrorImportacion(`${fallosDeEventos} evento(s) no se pudieron importar`, false)
    }

    await admin
      .from('google_calendar_tokens')
      .update({
        sync_token: nextSyncToken ?? cuenta.sync_token,
        importacion_ultima_at: new Date().toISOString(),
        importacion_ultimo_error: null,
        importacion_fallos_seguidos: 0,
      })
      .eq('id', cuenta.id)

    return resumen
  } catch (err) {
    if (err instanceof SyncTokenVencido) {
      // La próxima corrida, sin token, hace la traída completa. No es un error
      // de la cuenta: Google los invalida cada tanto.
      await admin.from('google_calendar_tokens').update({ sync_token: null }).eq('id', cuenta.id)
      resumen.resultado = 'sync_token_vencido'
      return resumen
    }

    const transitorio = err instanceof ErrorImportacion ? err.transitorio : esTransitorio(err)
    const mensaje = err instanceof Error ? err.message : String(err)
    const fallos = cuenta.importacion_fallos_seguidos + 1
    const registrar = !transitorio || fallos >= FALLOS_ANTES_DE_REGISTRAR

    console.error(
      `google-calendar-import: cuenta ${cuenta.agente_id} (${transitorio ? 'transitorio' : 'error'}, ${fallos} seguidos)`,
      mensaje,
    )

    await admin
      .from('google_calendar_tokens')
      .update({
        importacion_fallos_seguidos: fallos,
        ...(registrar
          ? { importacion_ultimo_error: `${new Date().toISOString()} — ${mensaje}`.slice(0, 1000) }
          : {}),
      })
      .eq('id', cuenta.id)

    resumen.resultado = registrar ? 'error' : 'error_transitorio'
    resumen.error = mensaje
    return resumen
  }
}

/**
 * Por qué no se importa un evento, o null si se importa.
 *
 * El orden importa sólo para el conteo del resumen: cada evento cuenta en el
 * primer motivo que le toca.
 */
function motivoParaSaltear(evento: EventoGoogle, hoy: string, yaExisten: Set<string>): string | null {
  if (evento.extendedProperties?.private?.[MARCA_ORIGEN.clave] === MARCA_ORIGEN.valor) {
    return 'creado_por_leadera'
  }
  // Segunda red para eventos que LeadEra empujó antes de que existiera la marca
  // y nunca se marcaron (una cuenta que reconecta con eventos viejos).
  if (yaExisten.has(evento.id)) return 'ya_existe_en_leadera'
  // Borrados en Google. Qué hacer con lo ya importado cuando se borra allá
  // queda fuera de esta fase.
  if (evento.status === 'cancelled') return 'cancelado'
  // Cumpleaños, "fuera de la oficina", ubicación de trabajo, etc.: no son
  // compromisos del agente.
  if (evento.eventType && evento.eventType !== 'default') return 'tipo_no_importable'
  if (evento.attendees?.some((a) => a.self && a.responseStatus === 'declined')) return 'rechazado'

  const fecha = momentoEnZona(evento).fecha
  if (!fecha) return 'sin_fecha'
  // El incremental devuelve también cambios en eventos viejos: lo pasado no
  // se trae, igual que en la primera corrida.
  if (fecha < hoy) return 'pasado'
  return null
}

/**
 * Crea la visita o la tarea. Devuelve qué creó, o 'duplicado' si otra corrida
 * ya lo había importado (índice único por agente + evento).
 */
async function importarEvento(
  admin: SupabaseClient,
  evento: EventoGoogle,
  agenteId: string,
  inmobiliariaId: string,
): Promise<'visita' | 'tarea' | 'posible_visita' | 'duplicado'> {
  const titulo = (evento.summary ?? '').trim() || '(Sin título)'
  const descripcion = evento.description?.trim() || null
  const { fecha, hora } = momentoEnZona(evento)

  const comun = {
    inmobiliaria_id: inmobiliariaId,
    creado_por: agenteId,
    asignado_a: agenteId,
    fecha,
    hora,
    lead_id: null,
    google_event_id: evento.id,
    origen_importacion: 'google_calendar',
  }

  let tipo: 'tarea' | 'posible_visita' = 'tarea'
  let tituloTarea = titulo

  if (PREFIJO_VISITA.test(titulo)) {
    const direccion = titulo.replace(PREFIJO_VISITA, '').replace(SUFIJO_ESTADO, '').trim()
    const propiedadId = direccion ? await elegirPropiedad(admin, inmobiliariaId, direccion) : null

    if (propiedadId) {
      const { error } = await admin
        .from('visitas')
        .insert({ ...comun, propiedad_id: propiedadId, notas: descripcion })
      if (error) return duplicadoOError(error)
      return 'visita'
    }

    tipo = 'posible_visita'
    tituloTarea = `Posible visita: ${direccion || '(sin dirección)'} — revisar y asociar propiedad manualmente`
  }

  const { error } = await admin
    .from('tareas')
    .insert({ ...comun, titulo: tituloTarea, descripcion })
  if (error) return duplicadoOError(error)
  return tipo
}

/**
 * La propiedad de la dirección, sólo si el match es inequívoco.
 *
 * Tres condiciones, las tres necesarias:
 *  1. Puntaje ≥ UMBRAL_MATCH.
 *  2. Misma altura. El parecido de texto no distingue "Alvear 3355" de
 *     "Alvear 3356" (dan ~0.7), y confundirlas es mandar al agente a otra
 *     casa. Si el evento no trae altura no hay match fuerte posible.
 *  3. Que el segundo candidato con esa altura no esté a menos de
 *     MARGEN_AMBIGUEDAD: dos unidades del mismo edificio ("…, piso 2" y
 *     "…, piso 6") son ambiguas y las resuelve el agente.
 */
async function elegirPropiedad(
  admin: SupabaseClient,
  inmobiliariaId: string,
  direccion: string,
): Promise<string | null> {
  const { data, error } = await admin.rpc('buscar_propiedad_por_direccion', {
    p_inmobiliaria_id: inmobiliariaId,
    p_direccion: direccion,
  })
  if (error) throw errorDeBase(error)

  const altura = primeraAltura(direccion)
  if (!altura) return null

  const candidatos = ((data ?? []) as { propiedad_id: string; direccion: string; puntaje: number }[])
    .filter((c) => primeraAltura(c.direccion) === altura)

  const [mejor, segundo] = candidatos
  if (!mejor || mejor.puntaje < UMBRAL_MATCH) return null
  if (segundo && mejor.puntaje - segundo.puntaje < MARGEN_AMBIGUEDAD) return null
  return mejor.propiedad_id
}

/**
 * ¿La serie recurrente ya tiene una fila en LeadEra?
 *
 * Mira primero lo importado en esta misma corrida y, si no, la base: una serie
 * que entró la semana pasada no tiene que volver a entrar porque Google mande
 * otra ocurrencia en el incremental.
 *
 * El id de una instancia es `<id madre>_<fecha>`, así que la serie entera se
 * busca por prefijo. `escaparLike` es por las dudas: los ids de Google son
 * alfanuméricos, pero un `%` en un LIKE armado con datos ajenos no se deja
 * pasar aunque hoy no pueda aparecer.
 *
 * Devuelve true y marca la serie como ocupada, así la próxima ocurrencia de
 * la misma corrida se saltea sin volver a consultar.
 */
async function yaHaySerie(
  admin: SupabaseClient,
  cuenta: Cuenta,
  recurringEventId: string,
  series: Set<string>,
): Promise<boolean> {
  // Ya pasó una ocurrencia de esta serie en esta corrida: las que siguen se
  // saltean sin volver a consultar.
  if (series.has(recurringEventId)) return true
  series.add(recurringEventId)

  const patron = `${escaparLike(recurringEventId)}%`
  const [tareas, visitas] = await Promise.all([
    admin.from('tareas').select('id').eq('asignado_a', cuenta.agente_id).like('google_event_id', patron).limit(1),
    admin.from('visitas').select('id').eq('asignado_a', cuenta.agente_id).like('google_event_id', patron).limit(1),
  ])
  if (tareas.error) throw errorDeBase(tareas.error)
  if (visitas.error) throw errorDeBase(visitas.error)

  return (tareas.data?.length ?? 0) > 0 || (visitas.data?.length ?? 0) > 0
}

/** Los comodines de LIKE, neutralizados. */
function escaparLike(texto: string): string {
  return texto.replace(/[\\%_]/g, (c) => `\\${c}`)
}

function primeraAltura(texto: string): string | null {
  return texto.match(/\d+/)?.[0] ?? null
}

// ---------------------------------------------------------------------------
// Base
// ---------------------------------------------------------------------------

/** Qué eventos de la página ya están en LeadEra para este agente. */
async function idsExistentes(admin: SupabaseClient, agenteId: string, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set()

  const [tareas, visitas] = await Promise.all([
    admin.from('tareas').select('google_event_id').eq('asignado_a', agenteId).in('google_event_id', ids),
    admin.from('visitas').select('google_event_id').eq('asignado_a', agenteId).in('google_event_id', ids),
  ])
  if (tareas.error) throw errorDeBase(tareas.error)
  if (visitas.error) throw errorDeBase(visitas.error)

  return new Set([...(tareas.data ?? []), ...(visitas.data ?? [])].map((f) => f.google_event_id as string))
}

/** 23505 = violó el índice único: otra corrida ya lo importó. No es un error. */
function duplicadoOError(error: { code?: string; message: string }): 'duplicado' {
  if (error.code === '23505') return 'duplicado'
  throw errorDeBase(error)
}

/**
 * Error de la base, clasificado.
 *
 * PGRST303 ("JWT issued at future") es un desfase de reloj entre la función y
 * la API: ya pasó una vez y el reintento anduvo sin cambiar nada.
 */
function errorDeBase(error: { code?: string; message: string }): ErrorImportacion {
  const transitorio = error.code === 'PGRST303' || /issued at future|timeout|connection/i.test(error.message)
  return new ErrorImportacion(`Base: ${error.code ?? ''} ${error.message}`.trim(), transitorio)
}

/** Para errores que no pasaron por `ErrorImportacion`: red caída, timeout. */
function esTransitorio(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  return err.name === 'TimeoutError' || err.name === 'AbortError' || err instanceof TypeError
}

// ---------------------------------------------------------------------------
// Google
// ---------------------------------------------------------------------------

async function listarEventos(
  calendario: string,
  acceso: string,
  syncToken: string | null,
  hoy: string,
  pageToken?: string,
): Promise<{ items: EventoGoogle[]; nextPageToken?: string; nextSyncToken?: string }> {
  const params = new URLSearchParams({
    // Una fila por ocurrencia: una reunión semanal son varias tareas, cada una
    // en su fecha, que es como el agente la tiene en la agenda.
    singleEvents: 'true',
    maxResults: '250',
  })

  if (syncToken) {
    // Con syncToken Google no acepta timeMin/timeMax: devuelve todo lo que
    // cambió, y lo viejo se descarta en `motivoParaSaltear`.
    params.set('syncToken', syncToken)
  } else {
    params.set('timeMin', `${hoy}T00:00:00${OFFSET_ZONA}`)
    params.set('timeMax', `${sumarDias(hoy, IMPORTAR_DIAS)}T00:00:00${OFFSET_ZONA}`)
  }
  if (pageToken) params.set('pageToken', pageToken)

  const url = `${CALENDAR_API}/${encodeURIComponent(calendario)}/events?${params}`
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${acceso}` },
    signal: AbortSignal.timeout(TIMEOUT_GOOGLE_MS),
  })

  if (r.status === 410) throw new SyncTokenVencido()
  if (!r.ok) {
    const detalle = (await r.text()).slice(0, 300)
    // 429 y 5xx son de Google y pasan solos; el resto (403 sin permiso, 404
    // calendario) no se arregla reintentando.
    throw new ErrorImportacion(`Google ${r.status}: ${detalle}`, r.status === 429 || r.status >= 500)
  }

  return await r.json()
}

/**
 * Access token usable, renovándolo si venció. null si el agente tiene que
 * volver a autorizar.
 *
 * Mismo criterio que `google-calendar-sync`: un 4xx al renovar es el permiso
 * revocado y baja `conectado`; un fallo de red o un 5xx es transitorio y no
 * desconecta a nadie.
 */
async function accesoVigente(admin: SupabaseClient, cuenta: Cuenta): Promise<string | null> {
  const vence = cuenta.token_expiry ? Date.parse(cuenta.token_expiry) : 0
  if (vence - MARGEN_VENCIMIENTO_S * 1000 > Date.now()) return cuenta.access_token

  if (!cuenta.refresh_token) {
    await admin.from('google_calendar_tokens').update({ conectado: false }).eq('id', cuenta.id)
    return null
  }

  const r = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: cuenta.refresh_token,
      client_id: Deno.env.get('GOOGLE_CLIENT_ID') ?? '',
      client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '',
      grant_type: 'refresh_token',
    }),
    signal: AbortSignal.timeout(TIMEOUT_GOOGLE_MS),
  })

  if (!r.ok) {
    if (r.status >= 400 && r.status < 500) {
      await admin
        .from('google_calendar_tokens')
        .update({ conectado: false, updated_at: new Date().toISOString() })
        .eq('id', cuenta.id)
      return null
    }
    throw new ErrorImportacion(`Google ${r.status} al renovar el token`, true)
  }

  const datos = (await r.json()) as { access_token?: string; expires_in?: number }
  if (!datos.access_token) throw new ErrorImportacion('Google no devolvió access_token', true)

  await admin
    .from('google_calendar_tokens')
    .update({
      access_token: datos.access_token,
      token_expiry: new Date(Date.now() + (datos.expires_in ?? 3600) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', cuenta.id)

  return datos.access_token
}

// ---------------------------------------------------------------------------
// Fechas
// ---------------------------------------------------------------------------

/** `YYYY-MM-DD` del instante, en ZONA. */
function fechaEnZona(instante: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(instante)
}

/**
 * Fecha y hora de pared del inicio del evento, en ZONA.
 *
 * Día completo → hora null, igual que una tarea sin hora en LeadEra. Con hora
 * se pasa a la hora argentina aunque el evento se haya cargado en otro huso:
 * es la hora que el agente ve en el calendario de LeadEra.
 */
function momentoEnZona(evento: EventoGoogle): { fecha: string | null; hora: string | null } {
  if (evento.start?.date) return { fecha: evento.start.date, hora: null }
  if (!evento.start?.dateTime) return { fecha: null, hora: null }

  const instante = new Date(evento.start.dateTime)
  const hora = new Intl.DateTimeFormat('en-GB', {
    timeZone: ZONA,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(instante)
  return { fecha: fechaEnZona(instante), hora }
}

function sumarDias(fecha: string, dias: number): string {
  const [a, m, d] = fecha.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10)
}

function rolDelJwt(token: string | null): string | undefined {
  try {
    const payload = (token ?? '').split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(payload + '='.repeat((4 - (payload.length % 4)) % 4)))?.role
  } catch {
    return undefined
  }
}
