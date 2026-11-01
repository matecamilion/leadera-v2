/**
 * Lógica de google-calendar-sync, sin red ni base: todo lo que toca el mundo
 * entra por `DepsSync`. Así el orden de las operaciones —lo que más importa acá—
 * se puede testear con dobles: con un usuario inválido NO se debe llamar a
 * Google ni leer `google_calendar_tokens`.
 *
 * Un ASISTENTE no tiene calendario propio: sus cambios se reflejan en el Google
 * del agente al que asiste (`duenoCalendario`). El dueño del calendario sale de
 * la base con el JWT validado; el cuerpo del request nunca aporta un id de
 * agente.
 */
import { MARCA_ORIGEN } from '../_shared/google.ts'
import {
  type AgenteCalendario,
  armarEquipoIds,
  type PerfilCalendario,
  resolverDuenoCalendario,
} from '../_shared/equipoCalendario.ts'

/**
 * Huso con el que se interpretan `fecha` y `hora`.
 *
 * Las dos columnas son `date` y `time` sin huso, y el resto de la app las trata
 * como hora de pared local —`momentoDeLaInteraccion` en `api/visitas.ts` las
 * arma con `new Date(a, m, d, hh, mm)`, que usa el del navegador—. Se declara
 * el mismo huso acá para que el evento caiga en Google a la hora que el agente
 * ve en LeadEra y no tres horas después.
 */
export const ZONA = 'America/Argentina/Buenos_Aires'

/** Cuánto dura un evento sin hora de fin. No hay dato para diferenciar tarea de visita. */
export const DURACION_HORAS = 1

export type Tipo = 'tarea' | 'visita'
export type Accion = 'crear' | 'editar' | 'borrar'

export interface Entrada {
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

export interface FilaToken {
  id: string
  access_token: string
  refresh_token: string | null
  token_expiry: string | null
  google_calendar_id: string | null
  conectado: boolean
}

/** Google distingue evento de día completo (`date`) de evento con hora (`dateTime`). */
export type Momento = { date: string } | { dateTime: string; timeZone: string }

/** El evento tal como lo espera la Calendar API. */
export interface EventoGoogle {
  summary: string
  description?: string | null
  start: Momento
  end: Momento
  /** La marca de origen, ver `MARCA_ORIGEN`. */
  extendedProperties: { private: Record<string, string> }
}

export interface Registro {
  tipo: Tipo
  titulo: string
  descripcion: string | null
  fecha: string
  hora: string | null
  /** Sufijo de estado, o null si el estado no merece uno. */
  estadoVisible: string | null
  google_event_id: string | null
}

/** Quién dispara la llamada: para los logs. Nunca tokens ni cuerpos de Google. */
export interface Disparador {
  id: string
  rol: string
}

export type ResultadoEditar =
  | { estado: 'ok'; id: string }
  | { estado: 'no_existe' }
  | { estado: 'error' }

export type ResultadoObtener =
  | { estado: 'ok'; cancelado: boolean; marcado: boolean }
  | { estado: 'no_existe' }
  | { estado: 'error' }

export interface GoogleApi {
  /** Devuelve el id del evento creado, o null si Google lo rechazó. */
  crear(calendarioId: string, evento: EventoGoogle, acceso: string): Promise<string | null>
  /** 404 y 410 son `no_existe`; cualquier otro error, `error`. */
  editar(
    calendarioId: string,
    eventId: string,
    evento: EventoGoogle,
    acceso: string,
  ): Promise<ResultadoEditar>
  /** 404 y 410 son `no_existe`. `marcado`: lleva la marca de origen de LeadEra. */
  obtener(calendarioId: string, eventId: string, acceso: string): Promise<ResultadoObtener>
  /** true si el evento quedó borrado. */
  borrar(calendarioId: string, eventId: string, acceso: string): Promise<boolean>
}

export interface DepsSync {
  /** El perfil del usuario y, si asiste a alguien, el de su agente: una sola lectura. */
  leerPerfiles(userId: string): Promise<{
    usuario: PerfilCalendario | null
    agente: AgenteCalendario | null
  }>
  /** Ids de los asistentes del dueño del calendario, de su inmobiliaria. */
  leerAsistentesIds(duenoCalendario: string, inmobiliariaId: string): Promise<string[]>
  leerToken(duenoCalendario: string): Promise<FilaToken | null>
  asegurarAccessToken(fila: FilaToken, disparadoPor: Disparador): Promise<string | null>
  leerRegistro(
    tipo: Tipo,
    id: string,
    contexto: { inmobiliariaId: string; equipoIds: string[] },
  ): Promise<Registro | null>
  guardarEventId(tipo: Tipo, id: string, eventId: string): Promise<void>
  google: GoogleApi
  log(mensaje: string): void
}

export type Salida =
  | { tipo: 'json'; status: number; cuerpo: Record<string, unknown> }
  | { tipo: 'error'; status: number; mensaje: string; code: string }

const noPermiso: Salida = {
  tipo: 'error',
  status: 403,
  mensaje: 'No tenés permiso para sincronizar este calendario',
  code: 'SIN_PERMISO',
}

/**
 * Hace el sync de una tarea o visita. `userId` es el del JWT ya validado.
 *
 * Orden, que fija un test: perfiles -> autorización -> (solo entonces) equipo,
 * token y Google. Ninguna llamada a Google ni lectura de `google_calendar_tokens`
 * ocurre antes de saber que el usuario puede operar ese calendario.
 */
export async function ejecutarSync(
  deps: DepsSync,
  userId: string,
  entrada: Entrada,
): Promise<Salida> {
  // --- 1. Autorización: en cada request, sin cache ---------------------------
  const { usuario, agente } = await deps.leerPerfiles(userId)
  const resolucion = resolverDuenoCalendario(usuario, agente)
  if (!resolucion.ok || !usuario) {
    const motivo = resolucion.ok ? 'perfil_inexistente' : resolucion.motivo
    deps.log(
      `google-calendar-sync: ${userId} (rol ${usuario?.rol ?? 'sin perfil'}) rechazado: ${motivo}`,
    )
    return noPermiso
  }

  const { duenoCalendario } = resolucion
  const disparadoPor: Disparador = { id: usuario.id, rol: usuario.rol }
  const esAsistente = usuario.rol === 'ASISTENTE'
  // Para el asistente el estado de la conexión es del agente: no hay nada que
  // él pueda hacer, y el cliente no debe ofrecerle reconectar.
  const loResuelveElAgente = esAsistente ? { lo_resuelve_el_agente: true } : {}

  // --- 2. ¿El dueño del calendario conectó Google? ----------------------------
  const fila = await deps.leerToken(duenoCalendario)
  if (!fila || !fila.conectado) {
    return {
      tipo: 'json',
      status: 200,
      cuerpo: { synced: false, reason: 'not_connected', ...loResuelveElAgente },
    }
  }

  // --- 3. Access token fresco -------------------------------------------------
  const acceso = await deps.asegurarAccessToken(fila, disparadoPor)
  if (!acceso) {
    return {
      tipo: 'json',
      status: 200,
      cuerpo: { synced: false, reason: 'reauth_required', ...loResuelveElAgente },
    }
  }

  const calendarioId = fila.google_calendar_id ?? 'primary'

  // --- 4. Borrar: no necesita la fila, que ya no existe -----------------------
  if (entrada.accion === 'borrar') {
    return await borrar(deps, calendarioId, acceso, entrada, disparadoPor)
  }

  // --- 5. Leer el registro, y que sea del equipo ------------------------------
  const asistentesIds = await deps.leerAsistentesIds(duenoCalendario, usuario.inmobiliaria_id)
  const equipoIds = armarEquipoIds(duenoCalendario, asistentesIds)

  const registro = await deps.leerRegistro(entrada.tipo, entrada.registro_id, {
    inmobiliariaId: usuario.inmobiliaria_id,
    equipoIds,
  })
  if (!registro) {
    // No existe, o es de otro equipo u otra inmobiliaria. No se distingue en la
    // respuesta: decir "existe pero no es tuyo" ya filtra información.
    return {
      tipo: 'error',
      status: 404,
      mensaje: 'No se encontró la tarea o la visita, o no es de tu equipo',
      code: 'REGISTRO_NO_ENCONTRADO',
    }
  }

  // El evento se arma UNA vez: si hay que recrearlo, es el mismo cuerpo y la
  // misma marca de origen que un alta normal, así el import no lo reimporta.
  const evento = armarEvento(registro)

  // --- 6. Crear o editar --------------------------------------------------------
  // Un `editar` sobre algo que nunca se sincronizó —se creó con el agente
  // desconectado y recién ahora conectó— se trata como alta: el PATCH no
  // tendría a qué apuntar y la alternativa sería no reflejarlo nunca.
  let eventId: string | null
  if (entrada.accion === 'crear' || !registro.google_event_id) {
    eventId = await deps.google.crear(calendarioId, evento, acceso)
  } else {
    const resultado = await deps.google.editar(
      calendarioId,
      registro.google_event_id,
      evento,
      acceso,
    )
    if (resultado.estado === 'ok') {
      eventId = resultado.id
    } else if (resultado.estado === 'no_existe') {
      // El evento no está en el calendario del agente (404/410): lo más común es
      // una fila que apuntaba al calendario de un asistente, o un evento borrado
      // a mano en Google. Se recrea con el mismo contenido y se guarda el id
      // nuevo. Cualquier otro error NO recrea: duplicaría el evento.
      deps.log(
        `google-calendar-sync: evento de ${entrada.tipo} ${entrada.registro_id} inexistente ` +
          `en el calendario de ${duenoCalendario}; se recrea (lo disparó ${disparadoPor.id}, ${disparadoPor.rol})`,
      )
      eventId = await deps.google.crear(calendarioId, evento, acceso)
    } else {
      eventId = null
    }
  }

  if (!eventId) {
    return { tipo: 'error', status: 502, mensaje: 'Google rechazó el evento', code: 'GOOGLE_API_ERROR' }
  }

  // Sólo se escribe si cambió: un PATCH devuelve el mismo id que ya estaba.
  if (eventId !== registro.google_event_id) {
    await deps.guardarEventId(entrada.tipo, entrada.registro_id, eventId)
  }

  return { tipo: 'json', status: 200, cuerpo: { synced: true, google_event_id: eventId } }
}

/**
 * Borra el evento, pero solo si es de LeadEra.
 *
 * La fila ya no existe, así que no hay forma de comprobar a qué equipo
 * pertenecía. El único control es la marca de origen que LeadEra pone en todo
 * lo que crea: sin ella el evento es de la agenda personal del agente y no se
 * toca. Un evento que ya no está en Google cuenta como borrado.
 */
async function borrar(
  deps: DepsSync,
  calendarioId: string,
  acceso: string,
  entrada: Entrada,
  disparadoPor: Disparador,
): Promise<Salida> {
  if (!entrada.google_event_id) {
    // El registro nunca llegó a Google —se creó con el agente desconectado—, así
    // que no hay nada que borrar allá.
    return { tipo: 'json', status: 200, cuerpo: { synced: false, reason: 'sin_evento' } }
  }

  const actual = await deps.google.obtener(calendarioId, entrada.google_event_id, acceso)

  if (actual.estado === 'no_existe' || (actual.estado === 'ok' && actual.cancelado)) {
    return { tipo: 'json', status: 200, cuerpo: { synced: true, google_event_id: null } }
  }
  if (actual.estado === 'error') {
    return { tipo: 'error', status: 502, mensaje: 'No se pudo leer el evento en Google', code: 'GOOGLE_API_ERROR' }
  }

  if (!actual.marcado) {
    deps.log(
      `google-calendar-sync: ${disparadoPor.id} (${disparadoPor.rol}) pidió borrar un evento sin ` +
        'la marca de origen de LeadEra; se rechaza',
    )
    return {
      tipo: 'error',
      status: 403,
      mensaje: 'Ese evento no fue creado por LeadEra',
      code: 'SIN_PERMISO',
    }
  }

  const ok = await deps.google.borrar(calendarioId, entrada.google_event_id, acceso)
  if (!ok) {
    return { tipo: 'error', status: 502, mensaje: 'Google rechazó el borrado del evento', code: 'GOOGLE_API_ERROR' }
  }
  return { tipo: 'json', status: 200, cuerpo: { synced: true, google_event_id: null } }
}

// ---------------------------------------------------------------------------
// Registro -> evento de Google
// ---------------------------------------------------------------------------

/**
 * Registro a evento de Google.
 *
 * La marca de origen va en el mismo cuerpo que se manda al crear, no en un
 * PATCH posterior: así no existe ningún momento en que el evento esté en
 * Google sin marcar. Va también en cada edición aunque un PATCH de Google no
 * borra `extendedProperties` si se omite —las claves no mandadas se
 * conservan—: reenviarla es gratis y, de paso, marca los eventos creados antes
 * de que existiera la marca la próxima vez que se editan.
 *
 * Una visita cancelada se edita a "(Cancelada)" en vez de borrarse: el agente
 * probablemente ya tiene ese bloque horario en la cabeza o se lo mostró a
 * alguien, y que el evento desaparezca sin dejar rastro es peor que verlo caído.
 */
export function armarEvento(registro: Registro): EventoGoogle {
  const summary = registro.estadoVisible
    ? `${registro.titulo} (${registro.estadoVisible})`
    : registro.titulo

  return {
    summary,
    description: registro.descripcion,
    ...momentos(registro.fecha, registro.hora),
    extendedProperties: { private: { [MARCA_ORIGEN.clave]: MARCA_ORIGEN.valor } },
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
