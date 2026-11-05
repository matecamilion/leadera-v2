/**
 * enviar-push
 *
 * Manda una notificación Web Push a todos los dispositivos de una lista de
 * usuarios. Es interna: la llaman otras funciones y crons con la service role
 * key; el navegador nunca la llama. No decide QUÉ avisar, sólo entrega.
 *
 * Quién recibe: usuarios activos de cuentas no bloqueadas. Es el mismo
 * criterio con el que la app corta el acceso (`estaBloqueada`): VENCIDA y
 * CANCELADA. Un usuario que no puede abrir la app no recibe avisos de ella.
 *
 * Un dispositivo que el servicio push da por inexistente (404/410) se borra
 * de `push_suscripciones`. Un error de red o un 429/5xx se informa como
 * reintentable y NO se borra: el que llama decide si reintenta.
 *
 * Entrada (cualquier clave desconocida o valor mal escrito devuelve 400 sin
 * mandar nada):
 *   {
 *     "user_ids": ["<uuid>", ...],                  1 a 200, sin repetidos
 *     "payload": { "title", "body", "url", "tag"? }  url: ruta interna "/..."
 *     "ttl": 3600,                                   segundos, 60 a 86400
 *     "dry_run": true                                arma los pedidos, no manda
 *                                                    ni borra nada
 *   }
 *
 * Secretos: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT.
 */
import { adminClient, bearerToken } from '../_shared/supabase.ts'
import { rolDelJwt } from '../_shared/jwt.ts'
import type { ErrorCode } from '../_shared/http.ts'
import { cargarVapid, enviarPush, type ResultadoPush, type SuscripcionPush } from '../_shared/push.ts'
import { leerEntrada } from './entrada.ts'

/** Estados de cuenta que no reciben avisos. Mismo criterio que `estaBloqueada` en el front. */
const ESTADOS_SIN_PUSH = ['VENCIDA', 'CANCELADA']

/** Envíos en paralelo. */
const TAMANO_LOTE_ENVIO = 10

/** Ids por consulta `.in()`: 200 uuid en una sola URL se acercan al límite de PostgREST. */
const TAMANO_LOTE_CONSULTA = 50

const MAX_ERRORES_INFORMADOS = 20

type Admin = ReturnType<typeof adminClient>

Deno.serve(async (req) => {
  if (req.method !== 'POST') return responderError('Método no permitido.', 405, 'METODO_NO_PERMITIDO')
  if (rolDelJwt(bearerToken(req)) !== 'service_role') {
    return responderError('Requiere service role.', 403, 'SIN_PERMISO')
  }

  const leida = leerEntrada(await req.text())
  if ('error' in leida) return responderError(leida.error, 400, 'INPUT_INVALIDO')
  const { user_ids, payload, ttl, dry_run } = leida.entrada

  try {
    cargarVapid()
  } catch (err) {
    console.error('enviar-push:', err instanceof Error ? err.message : 'configuración VAPID inválida')
    return responderError('Falta configurar las claves VAPID.', 500, 'CONFIG_FALTANTE')
  }

  const admin = adminClient()

  let destinatarios: string[]
  let suscripciones: SuscripcionPush[]
  try {
    destinatarios = await leerDestinatarios(admin, user_ids)
    suscripciones = await leerSuscripciones(admin, destinatarios)
  } catch (err) {
    console.error('enviar-push: lectura', err instanceof Error ? err.message : err)
    return responderError('No se pudieron leer los destinatarios.', 500, 'ERROR_INTERNO')
  }

  const resultados: ResultadoPush[] = []
  for (const lote of enLotes(suscripciones, TAMANO_LOTE_ENVIO)) {
    const salidas = await Promise.allSettled(
      lote.map((s) => enviarPush(s, payload, { ttl, dryRun: dry_run })),
    )
    salidas.forEach((salida, i) => {
      if (salida.status === 'fulfilled') return resultados.push(salida.value)
      console.error('enviar-push: falló un envío', salida.reason instanceof Error ? salida.reason.message : 'error')
      resultados.push({ id: lote[i].id, resultado: 'error' })
    })
  }

  const aEliminar = resultados.filter((r) => r.resultado === 'eliminar').map((r) => r.id)
  const eliminadas = dry_run ? 0 : await eliminarSuscripciones(admin, aEliminar)

  const cuenta = (resultado: ResultadoPush['resultado']) =>
    resultados.filter((r) => r.resultado === resultado).length

  return Response.json({
    modo: dry_run ? 'dry_run' : 'real',
    destinatarios: destinatarios.length,
    suscripciones: suscripciones.length,
    enviadas: cuenta('ok'),
    simuladas: cuenta('dry_run'),
    eliminadas,
    rechazadas: cuenta('rechazada'),
    reintentables: cuenta('reintentable'),
    errores: resultados
      .filter((r) => r.resultado === 'error')
      .slice(0, MAX_ERRORES_INFORMADOS)
      .map((r) => ({ host: r.host ?? null, status: r.status ?? null })),
  })
})

function responderError(error: string, status: number, code: ErrorCode): Response {
  return Response.json({ error, code }, { status })
}

function* enLotes<T>(items: T[], tamano: number): Generator<T[]> {
  for (let i = 0; i < items.length; i += tamano) yield items.slice(i, i + tamano)
}

// ---------------------------------------------------------------------------
// Lecturas y borrado
// ---------------------------------------------------------------------------

/** Usuarios activos cuya inmobiliaria no está bloqueada. */
async function leerDestinatarios(admin: Admin, userIds: string[]): Promise<string[]> {
  const perfiles: { id: string; inmobiliaria_id: string }[] = []
  for (const lote of enLotes(userIds, TAMANO_LOTE_CONSULTA)) {
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

async function leerSuscripciones(admin: Admin, userIds: string[]): Promise<SuscripcionPush[]> {
  const suscripciones: SuscripcionPush[] = []
  for (const lote of enLotes(userIds, TAMANO_LOTE_CONSULTA)) {
    const { data, error } = await admin
      .from('push_suscripciones')
      .select('id, endpoint, p256dh, auth')
      .in('user_id', lote)
    if (error) throw new Error(`push_suscripciones: ${error.message}`)
    suscripciones.push(...(data ?? []))
  }
  return suscripciones
}

/** Devuelve cuántas filas se borraron. Un error se loguea y no corta la respuesta. */
async function eliminarSuscripciones(admin: Admin, ids: string[]): Promise<number> {
  let borradas = 0
  for (const lote of enLotes(ids, TAMANO_LOTE_CONSULTA)) {
    const { data, error } = await admin.from('push_suscripciones').delete().in('id', lote).select('id')
    if (error) console.error('enviar-push: no se pudieron borrar suscripciones vencidas', error.message)
    else borradas += data?.length ?? 0
  }
  return borradas
}
