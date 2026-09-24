/**
 * avisos-vencimiento
 *
 * Le escribe al dueño de cada cuenta de cobro manual cuando se acerca o pasa
 * su vencimiento. La dispara el cron todos los días a las 10:00 de Argentina.
 *
 * Tres avisos por vencimiento, y cada día sale como mucho uno por cuenta —el
 * más avanzado que corresponda—:
 *   PREVIO             de D−3 a D−1
 *   DIA_VENCIMIENTO    de D a C−2
 *   ULTIMO_DIA_GRACIA  el día C−1
 * donde D es el día del vencimiento (`acceso_pagado_hasta`) y C el día en que
 * `procesar_transiciones_suscripcion()` pasa la cuenta a VENCIDA. Las ventanas
 * son de varios días para que un envío que falló se reintente al día
 * siguiente; si para entonces ya corresponde el aviso siguiente, el viejo se
 * descarta en vez de mandarse desactualizado.
 *
 * Qué cuentas: MANUAL, CLIENTE, ACTIVA o GRACIA y sin baja pedida. TRIAL,
 * VENCIDA (suspendida) y CANCELADA quedan afuera, igual que las de Mercado
 * Pago y las INTERNA/TESTING.
 *
 * No duplica: cada envío queda en `avisos_vencimiento` con clave única
 * (inmobiliaria, vencimiento, tipo). Antes de llamar a Resend la corrida
 * reclama la fila (ENVIANDO), así que dos corridas a la vez tampoco mandan el
 * mismo mail dos veces.
 *
 * Entrada (toda opcional, para probar a mano). Cuerpo vacío o `{}` es la
 * corrida real, que es como la llama el cron; cualquier clave desconocida o
 * valor mal escrito devuelve 400 sin ejecutar nada:
 *   { "dry_run": true }              → lista qué mandaría hoy. No manda ni
 *                                      escribe nada.
 *   { "destinatario": "a@b.com" }    → manda a esa dirección en vez de a la del
 *                                      dueño, y no escribe el registro: la
 *                                      prueba no le quita el aviso al dueño.
 *   { "hoy": "YYYY-MM-DD" }          → simula otro día. Sólo con dry_run o
 *                                      destinatario.
 *   { "inmobiliaria_id": "<uuid>" }  → una sola cuenta.
 *
 * Secretos: RESEND_API_KEY, AVISOS_REPLY_TO.
 */
import { adminClient, bearerToken } from '../_shared/supabase.ts'
import { formatearArs, NOMBRE_PLAN } from '../_shared/cobro.ts'
import { armarAviso, type TipoAviso } from '../_shared/plantillaAvisoVencimiento.ts'
import { leerEntrada, type Entrada } from './entrada.ts'
import { avisoDeHoy, fechaAR, formatearFecha, type AvisoDeHoy } from './fechas.ts'

const RESEND_API = 'https://api.resend.com/emails'
const REMITENTE = 'LeadEra <no-reply@mail.leadera.com.ar>'
const TIMEOUT_RESEND_MS = 15_000

/** Una fila ENVIANDO más vieja que esto es de una corrida que se cayó. */
const RECLAMO_VENCIDO_MS = 15 * 60_000

interface Cuenta {
  id: string
  nombre: string
  plan: string | null
  acceso_pagado_hasta: string
}

interface Dueno {
  inmobiliaria_id: string
  nombre: string | null
  email: string | null
}

interface FilaAviso {
  id: string
  estado: 'ENVIANDO' | 'ENVIADO' | 'ERROR'
  intentos: number
  actualizado_at: string
}

type Admin = ReturnType<typeof adminClient>

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Método no permitido', { status: 405 })
  if (rolDelJwt(bearerToken(req)) !== 'service_role') {
    return new Response('forbidden', { status: 403 })
  }

  const leida = leerEntrada(await req.text())
  if ('error' in leida) {
    return Response.json({ error: 'entrada_invalida', detalle: leida.error }, { status: 400 })
  }
  const entrada = leida.entrada
  const dryRun = entrada.dry_run === true
  const prueba = entrada.destinatario !== undefined

  // Simular otra fecha y escribirle al dueño real le mandaría un aviso que hoy
  // no le corresponde.
  if (entrada.hoy !== undefined && !dryRun && !prueba) {
    return Response.json(
      { error: 'entrada_invalida', detalle: '`hoy` sólo se acepta con dry_run o destinatario.' },
      { status: 400 },
    )
  }

  const apiKey = Deno.env.get('RESEND_API_KEY')
  const replyTo = Deno.env.get('AVISOS_REPLY_TO')
  const faltan = [!apiKey && 'RESEND_API_KEY', !replyTo && 'AVISOS_REPLY_TO'].filter(Boolean)
  if (faltan.length && !dryRun) {
    console.error('avisos-vencimiento: faltan secretos', faltan)
    return Response.json(
      { error: 'config_faltante', detalle: `Faltan los secretos: ${faltan.join(', ')}. No se envió nada.` },
      { status: 500 },
    )
  }

  const admin = adminClient()
  const hoy = entrada.hoy ?? fechaAR(Date.now())

  let query = admin
    .from('inmobiliarias')
    .select('id, nombre, plan, acceso_pagado_hasta')
    .eq('metodo_cobro', 'MANUAL')
    .eq('tipo_cuenta', 'CLIENTE')
    .in('estado_suscripcion', ['ACTIVA', 'GRACIA'])
    .eq('cancelacion_solicitada', false)
    .not('acceso_pagado_hasta', 'is', null)
  if (entrada.inmobiliaria_id) query = query.eq('id', entrada.inmobiliaria_id)

  const { data: cuentas, error: errCuentas } = await query
  if (errCuentas) {
    console.error('avisos-vencimiento: no se pudieron leer las cuentas', errCuentas)
    return Response.json({ error: 'lectura_cuentas', detalle: errCuentas.message }, { status: 500 })
  }

  // Sólo las cuentas a las que hoy les toca algo: el resto no necesita dueño
  // ni precio.
  const pendientes = ((cuentas ?? []) as Cuenta[])
    .map((cuenta) => ({ cuenta, aviso: avisoDeHoy(Date.parse(cuenta.acceso_pagado_hasta), hoy) }))
    .filter((p): p is { cuenta: Cuenta; aviso: AvisoDeHoy } => p.aviso !== null)

  const ids = pendientes.map((p) => p.cuenta.id)
  let duenos: Map<string, Dueno>
  let precios: Map<string, number>
  try {
    ;[duenos, precios] = await Promise.all([leerDuenos(admin, ids), leerPrecios(admin)])
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err)
    console.error('avisos-vencimiento: lectura de dueños o precios', detalle)
    return Response.json({ error: 'lectura_datos', detalle }, { status: 500 })
  }

  const resultados = []
  for (const { cuenta, aviso } of pendientes) {
    resultados.push(
      await procesar(admin, {
        cuenta,
        aviso,
        dueno: duenos.get(cuenta.id) ?? null,
        precio: cuenta.plan ? (precios.get(cuenta.plan) ?? null) : null,
        hoy,
        entrada,
        apiKey: apiKey ?? '',
        replyTo: replyTo ?? '',
      }),
    )
  }

  return Response.json({
    hoy,
    modo: dryRun ? 'dry_run' : prueba ? 'destinatario' : 'real',
    ...(faltan.length ? { config_faltante: faltan } : {}),
    cuentas_revisadas: cuentas?.length ?? 0,
    con_aviso_hoy: resultados.length,
    enviados: resultados.filter((r) => r.resultado === 'enviado').length,
    errores: resultados.filter((r) => r.resultado === 'error').length,
    resultados,
  })
})

// ---------------------------------------------------------------------------
// Una cuenta
// ---------------------------------------------------------------------------

async function procesar(
  admin: Admin,
  ctx: {
    cuenta: Cuenta
    aviso: AvisoDeHoy
    dueno: Dueno | null
    precio: number | null
    hoy: string
    entrada: Entrada
    apiKey: string
    replyTo: string
  },
) {
  const { cuenta, aviso, dueno, entrada } = ctx
  const email = dueno?.email?.trim() || null
  const destino = entrada.destinatario ?? email
  const problema = !dueno ? 'sin_dueno' : !email ? 'sin_email' : null

  const mail = armarAviso({
    tipo: aviso.tipo,
    nombre: dueno?.nombre?.trim() || null,
    inmobiliaria: cuenta.nombre,
    plan: cuenta.plan ? (NOMBRE_PLAN[cuenta.plan] ?? cuenta.plan) : 'sin plan',
    monto: ctx.precio === null ? null : formatearArs(ctx.precio),
    vencimiento: formatearFecha(aviso.vencimiento),
    corte: formatearFecha(aviso.corte),
    venceHoy: ctx.hoy === aviso.vencimiento,
  })

  const base = {
    inmobiliaria_id: cuenta.id,
    inmobiliaria: cuenta.nombre,
    dueno: dueno?.nombre ?? null,
    email,
    tipo: aviso.tipo,
    vencimiento: aviso.vencimiento,
    corte: aviso.corte,
    asunto: mail.asunto,
  }
  const clave = { inmobiliaria_id: cuenta.id, vencimiento: cuenta.acceso_pagado_hasta, tipo: aviso.tipo }

  try {
    if (entrada.dry_run) {
      const previa = await leerFila(admin, clave).catch(() => null)
      if (previa?.estado === 'ENVIADO') return { ...base, resultado: 'ya_enviado' }
      if (problema) return { ...base, resultado: 'error', error: problema }
      return { ...base, resultado: 'se_enviaria', ...(previa ? { reintento: previa.intentos + 1 } : {}) }
    }

    // Prueba: se manda aunque la cuenta no tenga dueño —justamente para ver
    // el mail— y no se toca el registro.
    if (entrada.destinatario) {
      const id = await enviar(ctx.apiKey, ctx.replyTo, entrada.destinatario, mail)
      return { ...base, destino, resultado: 'enviado', email_id: id }
    }

    const previa = await leerFila(admin, clave)
    if (previa?.estado === 'ENVIADO') return { ...base, resultado: 'ya_enviado' }
    if (
      previa?.estado === 'ENVIANDO' &&
      Date.now() - Date.parse(previa.actualizado_at) < RECLAMO_VENCIDO_MS
    ) {
      return { ...base, resultado: 'en_curso' }
    }

    if (problema) {
      await registrarError(admin, clave, previa, email, problema)
      return { ...base, resultado: 'error', error: problema }
    }

    const fila = await reclamar(admin, clave, previa, email)
    if (!fila) return { ...base, resultado: 'en_curso' }

    try {
      const id = await enviar(ctx.apiKey, ctx.replyTo, email!, mail)
      await actualizarFila(admin, fila.id, {
        estado: 'ENVIADO',
        resend_id: id,
        error: null,
        enviado_at: new Date().toISOString(),
      })
      return { ...base, resultado: 'enviado', email_id: id }
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : String(err)
      await actualizarFila(admin, fila.id, { estado: 'ERROR', error: mensaje.slice(0, 500) })
      throw err
    }
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : String(err)
    console.error(`avisos-vencimiento: ${cuenta.id} ${aviso.tipo}`, mensaje)
    return { ...base, resultado: 'error', error: mensaje }
  }
}

// ---------------------------------------------------------------------------
// Registro
// ---------------------------------------------------------------------------

interface Clave {
  inmobiliaria_id: string
  vencimiento: string
  tipo: TipoAviso
}

async function leerFila(admin: Admin, clave: Clave): Promise<FilaAviso | null> {
  const { data, error } = await admin
    .from('avisos_vencimiento')
    .select('id, estado, intentos, actualizado_at')
    .eq('inmobiliaria_id', clave.inmobiliaria_id)
    .eq('vencimiento', clave.vencimiento)
    .eq('tipo', clave.tipo)
    .maybeSingle<FilaAviso>()
  if (error) throw new Error(`No se pudo leer el registro: ${error.message}`)
  return data
}

/**
 * Toma la fila antes de mandar. Devuelve null si otra corrida la tomó primero:
 * el insert choca con la clave única, o el update no encuentra la fila como
 * la había leído.
 */
async function reclamar(
  admin: Admin,
  clave: Clave,
  previa: FilaAviso | null,
  email: string | null,
): Promise<{ id: string } | null> {
  const ahora = new Date().toISOString()

  if (!previa) {
    const { data, error } = await admin
      .from('avisos_vencimiento')
      .insert({ ...clave, estado: 'ENVIANDO', email, intentos: 1, actualizado_at: ahora })
      .select('id')
      .single<{ id: string }>()
    if (error?.code === '23505') return null
    if (error) throw new Error(`No se pudo registrar el aviso: ${error.message}`)
    return data
  }

  const { data, error } = await admin
    .from('avisos_vencimiento')
    .update({ estado: 'ENVIANDO', email, intentos: previa.intentos + 1, actualizado_at: ahora })
    .eq('id', previa.id)
    .eq('actualizado_at', previa.actualizado_at)
    .select('id')
    .maybeSingle<{ id: string }>()
  if (error) throw new Error(`No se pudo registrar el aviso: ${error.message}`)
  return data
}

/** Cuenta sin dueño o sin email: queda a la vista en vez de saltearse. */
async function registrarError(
  admin: Admin,
  clave: Clave,
  previa: FilaAviso | null,
  email: string | null,
  motivo: string,
) {
  const ahora = new Date().toISOString()
  const { error } = previa
    ? await admin
        .from('avisos_vencimiento')
        .update({ estado: 'ERROR', email, error: motivo, intentos: previa.intentos + 1, actualizado_at: ahora })
        .eq('id', previa.id)
    : await admin
        .from('avisos_vencimiento')
        .insert({ ...clave, estado: 'ERROR', email, error: motivo, intentos: 1, actualizado_at: ahora })
  if (error) throw new Error(`No se pudo registrar el error: ${error.message}`)
}

async function actualizarFila(admin: Admin, id: string, cambios: Record<string, unknown>) {
  const { error } = await admin
    .from('avisos_vencimiento')
    .update({ ...cambios, actualizado_at: new Date().toISOString() })
    .eq('id', id)
  if (error) console.error(`avisos-vencimiento: no se pudo actualizar la fila ${id}`, error)
}

// ---------------------------------------------------------------------------
// Lecturas
// ---------------------------------------------------------------------------

/** El dueño más antiguo de cada cuenta: mismo criterio que el panel admin. */
async function leerDuenos(admin: Admin, ids: string[]): Promise<Map<string, Dueno>> {
  const duenos = new Map<string, Dueno>()
  if (!ids.length) return duenos

  const { data, error } = await admin
    .from('profiles')
    .select('inmobiliaria_id, nombre, email')
    .eq('rol', 'DUENO')
    .in('inmobiliaria_id', ids)
    .order('created_at', { ascending: true })
  if (error) throw new Error(`No se pudieron leer los dueños: ${error.message}`)

  for (const fila of (data ?? []) as Dueno[]) {
    if (!duenos.has(fila.inmobiliaria_id)) duenos.set(fila.inmobiliaria_id, fila)
  }
  return duenos
}

async function leerPrecios(admin: Admin): Promise<Map<string, number>> {
  const { data, error } = await admin.from('planes_precio').select('plan, precio_ars_actual')
  if (error) throw new Error(`No se pudieron leer los precios: ${error.message}`)

  const precios = new Map<string, number>()
  for (const fila of (data ?? []) as { plan: string; precio_ars_actual: number | null }[]) {
    if (fila.precio_ars_actual !== null) precios.set(fila.plan, Number(fila.precio_ars_actual))
  }
  return precios
}

// ---------------------------------------------------------------------------
// Resend
// ---------------------------------------------------------------------------

async function enviar(
  apiKey: string,
  replyTo: string,
  destino: string,
  mail: { asunto: string; html: string; texto: string },
): Promise<string | null> {
  const respuesta = await fetch(RESEND_API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: REMITENTE,
      to: [destino],
      reply_to: replyTo,
      subject: mail.asunto,
      html: mail.html,
      text: mail.texto,
    }),
    signal: AbortSignal.timeout(TIMEOUT_RESEND_MS),
  })

  if (!respuesta.ok) {
    const detalle = (await respuesta.text()).slice(0, 300)
    throw new Error(`Resend ${respuesta.status}: ${detalle}`)
  }

  const datos = (await respuesta.json()) as { id?: string }
  return datos.id ?? null
}

function rolDelJwt(token: string | null): string | undefined {
  try {
    const payload = (token ?? '').split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(payload + '='.repeat((4 - (payload.length % 4)) % 4)))?.role
  } catch {
    return undefined
  }
}
