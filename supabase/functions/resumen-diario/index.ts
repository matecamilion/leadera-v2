/**
 * resumen-diario
 *
 * Le manda a cada usuario con notificaciones activadas un push con el resumen
 * de su día: visitas, seguimientos, leads prioritarios y leads nuevos, los
 * mismos cuatro números de las tarjetas de Mi día (`resumen_mi_dia`). La
 * dispara el cron todos los días a las 9:05 de Argentina.
 *
 * Quién recibe: usuarios con al menos un dispositivo en `push_suscripciones`,
 * activos y de cuentas no bloqueadas. Si los cuatro números son 0 no se manda
 * nada y el día queda OMITIDO.
 *
 * No duplica: cada usuario y día tiene una fila en `avisos_push_enviados`
 * (clave única usuario + tipo + fecha). Antes de mandar, la corrida la reclama
 * (ENVIANDO): dos corridas a la vez no mandan dos veces. Una ENVIANDO de más de
 * 15 minutos es de una corrida que se cayó y se retoma; una ERROR se reintenta.
 *
 * La entrega la hace `enviar-push`, a la que se la llama con la misma
 * credencial de service role con la que llegó este pedido (ya verificada acá).
 *
 * Si la corrida se alarga, deja de arrancar usuarios nuevos y los informa como
 * `pendientes`: volver a llamarla retoma lo que falta sin duplicar nada.
 *
 * Entrada (toda opcional). Cuerpo vacío o `{}` es la corrida real, que es como
 * la llama el cron; cualquier clave desconocida o valor mal escrito devuelve
 * 400 sin ejecutar nada:
 *   { "dry_run": true }              → calcula y arma todo, llama a enviar-push
 *                                      en dry_run y NO escribe el registro.
 *   { "destinatario": "<uuid>" }     → solo ese usuario.
 *   { "hoy": "YYYY-MM-DD" }          → simula otro día. Solo con dry_run.
 *
 * Secretos: ninguno propio (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY las pone
 * Supabase; las claves VAPID las usa enviar-push).
 */
import { adminClient, bearerToken } from '../_shared/supabase.ts'
import { rolDelJwt } from '../_shared/jwt.ts'
import type { ErrorCode } from '../_shared/http.ts'
import { hoyEnZona } from '../_shared/reporteSemanal.ts'
import { armarResumen, type ConteosDelDia } from '../_shared/resumenTexto.ts'
import { decidirReclamo, type FilaLog, interpretarRespuestaPush, type RespuestaPush } from './decisiones.ts'
import { leerEntrada } from './entrada.ts'

const TIPO = 'RESUMEN_DIARIO'
const RUTA_AVISO = '/mi-dia'

/** Un resumen de la mañana no tiene que llegar a la tarde: 4 horas. */
const TTL_SEGUNDOS = 14_400
const TIMEOUT_PUSH_MS = 20_000

const CONCURRENCIA = 5
/** Pasado esto no se arrancan usuarios nuevos; la corrida siguiente retoma. */
const LIMITE_ARRANQUE_MS = 100_000

/** Ids por consulta `.in()`: demasiados uuid en una sola URL pasan el límite de PostgREST. */
const TAMANO_LOTE_CONSULTA = 50
const TAMANO_PAGINA = 1000
const MAX_RESULTADOS_INFORMADOS = 20

/**
 * Estados de cuenta que no reciben avisos. Es la misma lista que usa
 * `enviar-push` (ESTADOS_SIN_PUSH) y el mismo criterio con el que la app corta
 * el acceso (`estaBloqueada`): VENCIDA y CANCELADA. Si cambia allá, cambia acá.
 */
const ESTADOS_SIN_PUSH = ['VENCIDA', 'CANCELADA']

type Admin = ReturnType<typeof adminClient>

type EstadoResultado = 'ENVIADO' | 'SE_ENVIARIA' | 'OMITIDO' | 'ERROR' | 'SALTADO'

interface Resultado {
  user_id: string
  estado: EstadoResultado
  resumen?: ConteosDelDia
  title?: string
  motivo?: string
}

interface Contexto {
  userId: string
  hoy: string
  dryRun: boolean
  urlPush: string
  token: string
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

  const urlBase = Deno.env.get('SUPABASE_URL')
  if (!urlBase) {
    console.error('resumen-diario: falta SUPABASE_URL')
    return responderError('Falta configurar SUPABASE_URL.', 500, 'CONFIG_FALTANTE')
  }
  const urlPush = `${urlBase.replace(/\/+$/, '')}/functions/v1/enviar-push`

  const inicio = Date.now()
  const admin = adminClient()
  const hoy = entrada.hoy ?? hoyEnZona()

  let candidatos: string[]
  try {
    candidatos = await leerCandidatos(admin, entrada.destinatario)
  } catch (err) {
    console.error('resumen-diario: lectura de candidatos', mensajeDe(err))
    return responderError('No se pudieron leer los destinatarios.', 500, 'ERROR_INTERNO')
  }

  const cola = [...candidatos]
  const resultados: Resultado[] = []
  const trabajador = async () => {
    while (cola.length && Date.now() - inicio < LIMITE_ARRANQUE_MS) {
      const userId = cola.shift()!
      resultados.push(await procesar(admin, { userId, hoy, dryRun, urlPush, token: token! }))
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCIA }, trabajador))

  const cuenta = (estado: EstadoResultado) => resultados.filter((r) => r.estado === estado).length

  return Response.json({
    modo: dryRun ? 'dry_run' : 'real',
    hoy,
    candidatos: candidatos.length,
    enviados: cuenta('ENVIADO'),
    simulados: cuenta('SE_ENVIARIA'),
    omitidos: cuenta('OMITIDO'),
    errores: cuenta('ERROR'),
    saltados: cuenta('SALTADO'),
    pendientes: cola.length,
    ...(entrada.destinatario && candidatos.length === 0
      ? { motivo: 'El destinatario no tiene dispositivos, está inactivo o su cuenta está bloqueada.' }
      : {}),
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
// Candidatos
// ---------------------------------------------------------------------------

/**
 * Usuarios con al menos un dispositivo, activos y de cuentas no bloqueadas.
 * Con `destinatario`, solo ese usuario (si no cumple, la lista queda vacía).
 */
async function leerCandidatos(admin: Admin, destinatario?: string): Promise<string[]> {
  const conDispositivo = new Set<string>()
  for (let desde = 0; ; desde += TAMANO_PAGINA) {
    let consulta = admin
      .from('push_suscripciones')
      .select('user_id')
      .order('id')
      .range(desde, desde + TAMANO_PAGINA - 1)
    if (destinatario) consulta = consulta.eq('user_id', destinatario)
    const { data, error } = await consulta
    if (error) throw new Error(`push_suscripciones: ${error.message}`)
    for (const fila of data ?? []) conDispositivo.add(fila.user_id)
    if ((data?.length ?? 0) < TAMANO_PAGINA) break
  }
  if (!conDispositivo.size) return []

  const perfiles: { id: string; inmobiliaria_id: string }[] = []
  for (const lote of enLotes([...conDispositivo], TAMANO_LOTE_CONSULTA)) {
    const { data, error } = await admin
      .from('profiles')
      .select('id, inmobiliaria_id')
      .in('id', lote)
      .eq('activo', true)
    if (error) throw new Error(`profiles: ${error.message}`)
    perfiles.push(...(data ?? []))
  }
  if (!perfiles.length) return []

  const vigentes = new Set<string>()
  const inmobiliariaIds = [...new Set(perfiles.map((p) => p.inmobiliaria_id))]
  for (const lote of enLotes(inmobiliariaIds, TAMANO_LOTE_CONSULTA)) {
    const { data, error } = await admin
      .from('inmobiliarias')
      .select('id')
      .in('id', lote)
      .not('estado_suscripcion', 'in', `(${ESTADOS_SIN_PUSH.join(',')})`)
    if (error) throw new Error(`inmobiliarias: ${error.message}`)
    for (const fila of data ?? []) vigentes.add(fila.id)
  }

  return perfiles.filter((p) => vigentes.has(p.inmobiliaria_id)).map((p) => p.id)
}

// ---------------------------------------------------------------------------
// Un usuario
// ---------------------------------------------------------------------------

/**
 * Reclama, calcula, arma el texto y manda. Nunca tira: un error en un usuario
 * queda en su fila como ERROR y no frena al resto.
 */
async function procesar(admin: Admin, ctx: Contexto): Promise<Resultado> {
  let filaId: string | null = null
  try {
    if (!ctx.dryRun) {
      filaId = await reclamar(admin, ctx.userId, ctx.hoy)
      if (!filaId) return { user_id: ctx.userId, estado: 'SALTADO' }
    }

    const conteos = await contar(admin, ctx.userId, ctx.hoy)
    const texto = armarResumen(conteos)
    if (!texto) {
      await cerrar(admin, filaId, { estado: 'OMITIDO', resumen: conteos })
      return { user_id: ctx.userId, estado: 'OMITIDO', resumen: conteos, motivo: 'nada pendiente' }
    }

    const respuesta = await llamarEnviarPush(ctx, {
      title: texto.title,
      body: texto.body,
      url: RUTA_AVISO,
      tag: `resumen:${ctx.hoy}`,
    })
    const desenlace = interpretarRespuestaPush(respuesta, ctx.dryRun)

    if (desenlace.estado === 'ENVIADO') {
      await cerrar(admin, filaId, {
        estado: 'ENVIADO',
        resumen: conteos,
        dispositivos: desenlace.dispositivos,
        enviados: desenlace.enviados,
        enviado_at: new Date().toISOString(),
      })
      return {
        user_id: ctx.userId,
        estado: ctx.dryRun ? 'SE_ENVIARIA' : 'ENVIADO',
        resumen: conteos,
        title: texto.title,
      }
    }

    await cerrar(admin, filaId, {
      estado: desenlace.estado,
      resumen: conteos,
      dispositivos: desenlace.dispositivos,
      ...(desenlace.estado === 'ERROR' ? { error: desenlace.motivo } : {}),
    })
    return { user_id: ctx.userId, estado: desenlace.estado, resumen: conteos, motivo: desenlace.motivo }
  } catch (err) {
    const motivo = mensajeDe(err)
    console.error(`resumen-diario: ${ctx.userId}`, motivo)
    await cerrar(admin, filaId, { estado: 'ERROR', error: motivo.slice(0, 500) })
    return { user_id: ctx.userId, estado: 'ERROR', motivo: motivo.slice(0, 200) }
  }
}

async function contar(admin: Admin, userId: string, hoy: string): Promise<ConteosDelDia> {
  const { data, error } = await admin.rpc('resumen_mi_dia', { p_user_id: userId, p_hoy: hoy })
  if (error) throw new Error(`resumen_mi_dia: ${error.message}`)
  const fila = Array.isArray(data) ? data[0] : data
  if (!fila) throw new Error('resumen_mi_dia no devolvió filas')
  return {
    prioritarios: Number(fila.prioritarios),
    nuevos: Number(fila.nuevos),
    seguimientos: Number(fila.seguimientos),
    visitas_hoy: Number(fila.visitas_hoy),
  }
}

/**
 * Manda el aviso a UN usuario con `enviar-push`. Se usa la credencial con la
 * que llegó este pedido, que arriba se verificó como service role: es la que
 * `enviar-push` exige.
 */
async function llamarEnviarPush(
  ctx: Contexto,
  payload: { title: string; body: string; url: string; tag: string },
): Promise<RespuestaPush> {
  const res = await fetch(ctx.urlPush, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ctx.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_ids: [ctx.userId], payload, ttl: TTL_SEGUNDOS, dry_run: ctx.dryRun }),
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
 * Toma la fila del día antes de mandar. Devuelve su id, o null si hay que
 * saltear: ya está resuelta, la tiene otra corrida, o esa otra corrida la
 * tomó primero (el insert choca con la clave única, o el update no la
 * encuentra como se la había leído).
 */
async function reclamar(admin: Admin, userId: string, hoy: string): Promise<string | null> {
  const ahora = new Date().toISOString()
  const clave = { user_id: userId, tipo: TIPO, fecha: hoy }

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
 * Deja escrito cómo terminó el aviso. No hace nada sin fila (dry_run) y nunca
 * tira: si el push ya salió, un fallo al registrarlo no tiene que convertirlo
 * en ERROR y volver a mandarlo.
 */
async function cerrar(
  admin: Admin,
  filaId: string | null,
  campos: {
    estado: 'ENVIADO' | 'OMITIDO' | 'ERROR'
    resumen?: ConteosDelDia
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
  if (error) console.error(`resumen-diario: no se pudo cerrar la fila ${filaId}`, error.message)
}
