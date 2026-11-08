/**
 * avisos-visitas
 *
 * Avisos push de visitas. La dispara el cron cada 10 minutos.
 *
 *   VISITA_PROXIMA  faltan 60 minutos o menos y la visita no empezó.
 *   VISITA_POST     "¿Cómo te fue?" desde 30 minutos después de la hora de la
 *                   visita y hasta 3 horas después (ver `_shared/avisosVisitas.ts`).
 *
 * Qué visitas: AGENDADA y con hora, de ayer, hoy y mañana (día de Argentina).
 * Quién recibe: el equipo del `asignado_a` de la visita —su agente (`asiste_a`
 * o él mismo) y los asistentes de ese agente—, solo miembros activos de cuentas
 * no bloqueadas y con al menos un dispositivo.
 *
 * No duplica: cada aviso tiene una fila en `avisos_push_enviados` con clave
 * (usuario, tipo, fecha de la visita, ref), donde ref = visita_id@inicio ISO: si
 * cambia la hora de la visita, el aviso es nuevo. Antes de mandar, la corrida
 * reclama la fila (ENVIANDO), igual que `resumen-diario`. Una ENVIANDO de más de
 * 15 minutos es de una corrida caída y se retoma; una ERROR se reintenta hasta
 * MAX_INTENTOS veces.
 *
 * La entrega la hace `enviar-push` con la credencial con la que llegó este
 * pedido (ya verificada como service role).
 *
 * Entrada (toda opcional). Cuerpo vacío o `{}` es la corrida real, que es como
 * la llama el cron; cualquier clave desconocida o valor mal escrito devuelve
 * 400 sin ejecutar nada:
 *   { "dry_run": true }                     → devuelve los avisos que mandaría,
 *                                             sin escribir el registro ni enviar.
 *   { "ahora": "2026-11-08T15:00:00-03:00" } → simula otro momento. Solo con dry_run.
 */
import { adminClient, bearerToken } from '../_shared/supabase.ts'
import { rolDelJwt } from '../_shared/jwt.ts'
import type { ErrorCode } from '../_shared/http.ts'
import {
  decidirAviso,
  fechasDeLectura,
  inicioDeVisita,
  lugarDeVisita,
  nombreDeLead,
  refDeVisita,
  tagDeAviso,
  textoDeAviso,
  type TipoAviso,
  urlDeAviso,
} from '../_shared/avisosVisitas.ts'
// Reutiliza las decisiones de resumen-diario por import relativo (acopla las
// dos funciones: si cambian allá, cambian acá).
import {
  decidirReclamo,
  type FilaLog,
  interpretarRespuestaPush,
  type RespuestaPush,
} from '../resumen-diario/decisiones.ts'
import { leerEntrada } from './entrada.ts'

/** Una fila en ERROR con tantos intentos ya no se retoma. */
const MAX_INTENTOS = 3

/** El recordatorio no sirve pasada la visita; el post, un rato más. */
const TTL_SEGUNDOS: Record<TipoAviso, number> = { VISITA_PROXIMA: 3_600, VISITA_POST: 10_800 }
const TIMEOUT_PUSH_MS = 20_000

const CONCURRENCIA = 5
/** Pasado esto no se arrancan avisos nuevos; la corrida siguiente retoma. */
const LIMITE_ARRANQUE_MS = 100_000

/** Ids por consulta `.in()`: demasiados uuid en una sola URL pasan el límite de PostgREST. */
const TAMANO_LOTE_CONSULTA = 50
const TAMANO_PAGINA = 1000
const MAX_RESULTADOS_INFORMADOS = 20

/**
 * Estados de cuenta que no reciben avisos. Misma lista que `resumen-diario` y
 * `enviar-push`, y el mismo criterio con el que la app corta el acceso
 * (`estaBloqueada`): VENCIDA y CANCELADA. Si cambia allá, cambia acá.
 */
const ESTADOS_SIN_PUSH = ['VENCIDA', 'CANCELADA']

type Admin = ReturnType<typeof adminClient>

interface Aviso {
  user_id: string
  tipo: TipoAviso
  /** Día de Argentina de la visita. */
  fecha: string
  ref: string
  title: string
  body: string
  url: string
  tag: string
}

type EstadoResultado = 'ENVIADO' | 'OMITIDO' | 'ERROR' | 'SALTADO'

interface Resultado {
  user_id: string
  tipo: TipoAviso
  ref: string
  estado: EstadoResultado
  motivo?: string
}

interface Contexto {
  urlPush: string
  token: string
}

interface FilaVisita {
  id: string
  inmobiliaria_id: string
  lead_id: string | null
  asignado_a: string
  fecha: string
  hora: string
  titulo_externo: string | null
  leads: { nombre: string; apellido: string | null } | null
  propiedades: { direccion: string } | null
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return responderError('Método no permitido.', 405, 'METODO_NO_PERMITIDO')
  const token = bearerToken(req)
  if (rolDelJwt(token) !== 'service_role') {
    return responderError('Requiere service role.', 403, 'SIN_PERMISO')
  }

  const leida = leerEntrada(await req.text())
  if ('error' in leida) return responderError(leida.error, 400, 'INPUT_INVALIDO')
  const entrada = leida.entrada
  const dryRun = entrada.dry_run === true
  const ahoraMs = entrada.ahora ? Date.parse(entrada.ahora) : Date.now()

  const urlBase = Deno.env.get('SUPABASE_URL')
  if (!urlBase) {
    console.error('avisos-visitas: falta SUPABASE_URL')
    return responderError('Falta configurar SUPABASE_URL.', 500, 'CONFIG_FALTANTE')
  }
  const urlPush = `${urlBase.replace(/\/+$/, '')}/functions/v1/enviar-push`

  const inicio = Date.now()
  const admin = adminClient()

  let avisos: Aviso[]
  try {
    avisos = await armarAvisos(admin, ahoraMs)
  } catch (err) {
    console.error('avisos-visitas: lectura', mensajeDe(err))
    return responderError('No se pudieron leer las visitas.', 500, 'ERROR_INTERNO')
  }

  if (dryRun) {
    return Response.json({
      modo: 'dry_run',
      ahora: new Date(ahoraMs).toISOString(),
      avisos: avisos.length,
      resultados: avisos.map((a) => ({
        destinatario: a.user_id,
        tipo: a.tipo,
        ref: a.ref,
        title: a.title,
        body: a.body,
        url: a.url,
      })),
    })
  }

  const ctx: Contexto = { urlPush, token: token! }
  const cola = [...avisos]
  const resultados: Resultado[] = []
  const trabajador = async () => {
    while (cola.length && Date.now() - inicio < LIMITE_ARRANQUE_MS) {
      resultados.push(await procesar(admin, ctx, cola.shift()!))
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCIA }, trabajador))

  const cuenta = (estado: EstadoResultado) => resultados.filter((r) => r.estado === estado).length

  return Response.json({
    modo: 'real',
    ahora: new Date(ahoraMs).toISOString(),
    avisos: avisos.length,
    enviados: cuenta('ENVIADO'),
    omitidos: cuenta('OMITIDO'),
    errores: cuenta('ERROR'),
    saltados: cuenta('SALTADO'),
    pendientes: cola.length,
    resultados: resultados.slice(0, MAX_RESULTADOS_INFORMADOS),
  })
})

function responderError(error: string, status: number, code: ErrorCode): Response {
  return Response.json({ error, code }, { status })
}

function mensajeDe(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function* enLotes<T>(items: T[], tamano: number): Generator<T[]> {
  for (let i = 0; i < items.length; i += tamano) yield items.slice(i, i + tamano)
}

// ---------------------------------------------------------------------------
// Qué avisos corresponden
// ---------------------------------------------------------------------------

/** Un aviso por cada destinatario de cada visita que está en alguna ventana. */
async function armarAvisos(admin: Admin, ahoraMs: number): Promise<Aviso[]> {
  const candidatas: { visita: FilaVisita; tipo: TipoAviso; inicioMs: number }[] = []
  for (const visita of await leerVisitas(admin, fechasDeLectura(ahoraMs))) {
    const inicioMs = inicioDeVisita(visita.fecha, visita.hora)
    const tipo = decidirAviso(ahoraMs, inicioMs)
    if (tipo) candidatas.push({ visita, tipo, inicioMs })
  }
  if (!candidatas.length) return []

  const equipos = await leerEquipos(admin, [...new Set(candidatas.map((c) => c.visita.asignado_a))])
  const vigentes = await leerCuentasVigentes(admin, [...new Set(candidatas.map((c) => c.visita.inmobiliaria_id))])
  const conDispositivo = await leerConDispositivo(admin, [...new Set([...equipos.values()].flat())])

  const avisos: Aviso[] = []
  for (const { visita, tipo, inicioMs } of candidatas) {
    if (!vigentes.has(visita.inmobiliaria_id)) continue
    const texto = textoDeAviso({
      tipo,
      hora: visita.hora,
      nombre: nombreDeLead(visita.leads),
      lugar: lugarDeVisita(visita.propiedades?.direccion ?? null, visita.titulo_externo),
    })
    for (const userId of equipos.get(visita.asignado_a) ?? []) {
      if (!conDispositivo.has(userId)) continue
      avisos.push({
        user_id: userId,
        tipo,
        fecha: visita.fecha,
        ref: refDeVisita(visita.id, inicioMs),
        ...texto,
        url: urlDeAviso(visita.lead_id),
        tag: tagDeAviso(tipo, visita.id),
      })
    }
  }
  return avisos
}

/** Visitas AGENDADA con hora en esos días. */
async function leerVisitas(admin: Admin, fechas: string[]): Promise<FilaVisita[]> {
  const visitas: FilaVisita[] = []
  for (let desde = 0; ; desde += TAMANO_PAGINA) {
    const { data, error } = await admin
      .from('visitas')
      .select(
        'id, inmobiliaria_id, lead_id, asignado_a, fecha, hora, titulo_externo, leads(nombre, apellido), propiedades(direccion)',
      )
      .in('fecha', fechas)
      .eq('estado', 'AGENDADA')
      .not('hora', 'is', null)
      .order('id')
      .range(desde, desde + TAMANO_PAGINA - 1)
      .returns<FilaVisita[]>()
    if (error) throw new Error(`visitas: ${error.message}`)
    visitas.push(...(data ?? []))
    if ((data?.length ?? 0) < TAMANO_PAGINA) break
  }
  return visitas
}

/**
 * Para cada `asignado_a`, el equipo al que se le avisa: su agente (`asiste_a`,
 * o él mismo si no asiste a nadie) y los asistentes de ese agente, solo activos.
 * Si el agente está inactivo no recibe, pero sus asistentes activos sí.
 */
async function leerEquipos(admin: Admin, asignados: string[]): Promise<Map<string, string[]>> {
  const agenteDe = new Map<string, string>()
  for (const lote of enLotes(asignados, TAMANO_LOTE_CONSULTA)) {
    const { data, error } = await admin.from('profiles').select('id, asiste_a').in('id', lote)
    if (error) throw new Error(`profiles: ${error.message}`)
    for (const p of data ?? []) agenteDe.set(p.id, p.asiste_a ?? p.id)
  }

  const miembrosDe = new Map<string, string[]>()
  const agregar = (p: { id: string; asiste_a: string | null }) => {
    const agente = p.asiste_a ?? p.id
    const miembros = miembrosDe.get(agente) ?? []
    if (!miembros.includes(p.id)) miembros.push(p.id)
    miembrosDe.set(agente, miembros)
  }
  for (const lote of enLotes([...new Set(agenteDe.values())], TAMANO_LOTE_CONSULTA)) {
    for (const columna of ['id', 'asiste_a']) {
      const { data, error } = await admin
        .from('profiles')
        .select('id, asiste_a')
        .in(columna, lote)
        .eq('activo', true)
      if (error) throw new Error(`profiles: ${error.message}`)
      for (const p of data ?? []) agregar(p)
    }
  }

  return new Map(asignados.map((a) => [a, miembrosDe.get(agenteDe.get(a) ?? '') ?? []]))
}

async function leerCuentasVigentes(admin: Admin, inmobiliariaIds: string[]): Promise<Set<string>> {
  const vigentes = new Set<string>()
  for (const lote of enLotes(inmobiliariaIds, TAMANO_LOTE_CONSULTA)) {
    const { data, error } = await admin
      .from('inmobiliarias')
      .select('id')
      .in('id', lote)
      .not('estado_suscripcion', 'in', `(${ESTADOS_SIN_PUSH.join(',')})`)
    if (error) throw new Error(`inmobiliarias: ${error.message}`)
    for (const fila of data ?? []) vigentes.add(fila.id)
  }
  return vigentes
}

/** Sin dispositivo no hay a dónde mandar: ni siquiera se registra el aviso. */
async function leerConDispositivo(admin: Admin, userIds: string[]): Promise<Set<string>> {
  const conDispositivo = new Set<string>()
  for (const lote of enLotes(userIds, TAMANO_LOTE_CONSULTA)) {
    const { data, error } = await admin.from('push_suscripciones').select('user_id').in('user_id', lote)
    if (error) throw new Error(`push_suscripciones: ${error.message}`)
    for (const fila of data ?? []) conDispositivo.add(fila.user_id)
  }
  return conDispositivo
}

// ---------------------------------------------------------------------------
// Un aviso
// ---------------------------------------------------------------------------

/**
 * Reclama, manda y cierra. Nunca tira: un error en un aviso queda en su fila
 * como ERROR y no frena al resto.
 */
async function procesar(admin: Admin, ctx: Contexto, aviso: Aviso): Promise<Resultado> {
  const base = { user_id: aviso.user_id, tipo: aviso.tipo, ref: aviso.ref }
  let filaId: string | null = null
  try {
    filaId = await reclamar(admin, aviso)
    if (!filaId) return { ...base, estado: 'SALTADO' }

    const respuesta = await llamarEnviarPush(ctx, aviso)
    const desenlace = interpretarRespuestaPush(respuesta, false)

    if (desenlace.estado === 'ENVIADO') {
      await cerrar(admin, filaId, {
        estado: 'ENVIADO',
        dispositivos: desenlace.dispositivos,
        enviados: desenlace.enviados,
        enviado_at: new Date().toISOString(),
      })
      return { ...base, estado: 'ENVIADO' }
    }

    await cerrar(admin, filaId, {
      estado: desenlace.estado,
      dispositivos: desenlace.dispositivos,
      ...(desenlace.estado === 'ERROR' ? { error: desenlace.motivo } : {}),
    })
    return { ...base, estado: desenlace.estado, motivo: desenlace.motivo }
  } catch (err) {
    const motivo = mensajeDe(err)
    console.error(`avisos-visitas: ${aviso.user_id} ${aviso.ref}`, motivo)
    await cerrar(admin, filaId, { estado: 'ERROR', error: motivo.slice(0, 500) })
    return { ...base, estado: 'ERROR', motivo: motivo.slice(0, 200) }
  }
}

/**
 * Manda el aviso a UN usuario con `enviar-push`, con la credencial con la que
 * llegó este pedido, que arriba se verificó como service role.
 */
async function llamarEnviarPush(ctx: Contexto, aviso: Aviso): Promise<RespuestaPush> {
  const res = await fetch(ctx.urlPush, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ctx.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_ids: [aviso.user_id],
      payload: { title: aviso.title, body: aviso.body, url: aviso.url, tag: aviso.tag },
      ttl: TTL_SEGUNDOS[aviso.tipo],
      dry_run: false,
    }),
    redirect: 'manual',
    signal: AbortSignal.timeout(TIMEOUT_PUSH_MS),
  })
  if (!res.ok) throw new Error(`enviar-push respondió ${res.status}`)

  const cuerpo = (await res.json()) as Record<string, unknown>
  const numero = (valor: unknown) => (Number.isFinite(Number(valor)) ? Number(valor) : 0)
  return {
    destinatarios: numero(cuerpo.destinatarios),
    suscripciones: numero(cuerpo.suscripciones),
    enviadas: numero(cuerpo.enviadas),
    simuladas: numero(cuerpo.simuladas),
    eliminadas: numero(cuerpo.eliminadas),
    rechazadas: numero(cuerpo.rechazadas),
    reintentables: numero(cuerpo.reintentables),
  }
}

// ---------------------------------------------------------------------------
// Registro
// ---------------------------------------------------------------------------

/**
 * Toma la fila del aviso antes de mandar. Devuelve su id, o null si hay que
 * saltear: ya está resuelta, la tiene otra corrida, agotó los reintentos, o esa
 * otra corrida la tomó primero (el insert choca con la clave única, o el update
 * no la encuentra como se la había leído).
 */
async function reclamar(admin: Admin, aviso: Aviso): Promise<string | null> {
  const ahora = new Date().toISOString()
  const clave = { user_id: aviso.user_id, tipo: aviso.tipo, fecha: aviso.fecha, ref: aviso.ref }

  const { data, error } = await admin
    .from('avisos_push_enviados')
    .insert({ ...clave, estado: 'ENVIANDO', intentos: 1, actualizado_at: ahora })
    .select('id')
    .single<{ id: string }>()
  if (!error) return data.id
  if (error.code !== '23505') throw new Error(`No se pudo registrar el aviso: ${error.message}`)

  const { data: previa, error: errPrevia } = await admin
    .from('avisos_push_enviados')
    .select('id, estado, intentos, actualizado_at')
    .match(clave)
    .maybeSingle<FilaLog & { id: string; intentos: number }>()
  if (errPrevia) throw new Error(`No se pudo leer el registro: ${errPrevia.message}`)
  if (!previa || decidirReclamo(previa, Date.now()) === 'saltar') return null
  if (previa.estado === 'ERROR' && previa.intentos >= MAX_INTENTOS) return null

  const { data: tomada, error: errTomar } = await admin
    .from('avisos_push_enviados')
    .update({ estado: 'ENVIANDO', intentos: previa.intentos + 1, error: null, actualizado_at: ahora })
    .eq('id', previa.id)
    .eq('actualizado_at', previa.actualizado_at)
    .select('id')
    .maybeSingle<{ id: string }>()
  if (errTomar) throw new Error(`No se pudo registrar el aviso: ${errTomar.message}`)
  return tomada?.id ?? null
}

/**
 * Deja escrito cómo terminó el aviso. Nunca tira: si el push ya salió, un fallo
 * al registrarlo no tiene que convertirlo en ERROR y volver a mandarlo.
 */
async function cerrar(
  admin: Admin,
  filaId: string | null,
  campos: {
    estado: 'ENVIADO' | 'OMITIDO' | 'ERROR'
    dispositivos?: number
    enviados?: number
    error?: string
    enviado_at?: string
  },
): Promise<void> {
  if (!filaId) return
  const { error } = await admin
    .from('avisos_push_enviados')
    .update({ ...campos, actualizado_at: new Date().toISOString() })
    .eq('id', filaId)
  if (error) console.error(`avisos-visitas: no se pudo cerrar la fila ${filaId}`, error.message)
}
