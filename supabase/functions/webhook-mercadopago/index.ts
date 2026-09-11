/**
 * webhook-mercadopago
 *
 * Recibe las notificaciones de Mercado Pago sobre las suscripciones y sincroniza
 * el estado de la inmobiliaria.
 *
 * Este endpoint lo llama el servidor de Mercado Pago, nunca un navegador: no
 * hay preflight que responder ni origen que permitir, así que —a diferencia del
 * resto de las funciones— acá no se usa `_shared/cors.ts`. Devolver headers CORS
 * sería ruido; el `Access-Control-Allow-Origin` de la allowlist no lo mira nadie.
 * Por la misma razón va con `verify_jwt = false`: Mercado Pago no tiene ni puede
 * tener un JWT de Supabase. Quien autoriza es la firma HMAC del header
 * `x-signature`, y sin firma válida no se toca la base.
 *
 * Contrato de respuesta: si la notificación está firmada, SIEMPRE 200. Mercado
 * Pago reintenta cada 15 minutos ante cualquier cosa que no sea 2xx, y un error
 * interno nuestro no se arregla haciendo que reintenten: se arregla mirando el
 * log. El único no-200 es el 401 de firma inválida.
 *
 * Secretos: MP_ACCESS_TOKEN (para leer los recursos) y MP_WEBHOOK_SECRET (para
 * validar la firma).
 */
import { adminClient } from '../_shared/supabase.ts'
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { decidirCancelacion } from './cancelacion.ts'

const MP_API = 'https://api.mercadopago.com'
const TIMEOUT_MP_MS = 10_000

/**
 * Tipos de notificación de suscripciones.
 *
 * - `subscription_preapproval`: cambió la suscripción en sí (se autorizó, se
 *   pausó, se canceló). Se lee en GET /preapproval/{id}.
 * - `subscription_authorized_payment`: se generó un cobro recurrente de esa
 *   suscripción, que es el que puede salir aprobado o rechazado. Se lee en
 *   GET /authorized_payments/{id}.
 *
 * `payment` también llega y NO se procesa acá a propósito. El cobro mensual de
 * un preapproval ya viene por `subscription_authorized_payment`; procesarlo
 * también como `payment` sería contarlo dos veces, porque cada tipo trae su
 * propio `data.id` y por lo tanto pasa el filtro de idempotencia por separado.
 *
 * Nota sobre la documentación: la página de webhooks de suscripciones dice que
 * `subscription_preapproval` se consulta en `/preapproval/search`. Eso es el
 * buscador; para un id puntual el recurso es `/preapproval/{id}`, que es además
 * el mismo que `actualizar-precios-planes` ya usa con PUT. Se usa ese.
 */
const TIPO_PREAPPROVAL = 'subscription_preapproval'
const TIPO_PAGO_RECURRENTE = 'subscription_authorized_payment'

/** Estados de `payment.status` de Mercado Pago que cuentan como cobro exitoso. */
const PAGO_APROBADO = ['approved', 'authorized']

interface Notificacion {
  dataId: string
  tipo: string
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return json({ error: 'Método no permitido' }, 405)
  }

  try {
    const url = new URL(req.url)
    const cuerpoCrudo = await req.text()

    let cuerpo: Record<string, unknown> = {}
    try {
      cuerpo = cuerpoCrudo ? JSON.parse(cuerpoCrudo) : {}
    } catch {
      // Un body ilegible no llega a firmar bien igual; se sigue para que el
      // rechazo salga por el camino de la firma y no por el del parseo.
    }

    const notificacion = leerNotificacion(url, cuerpo)
    if (!notificacion) {
      console.error('webhook-mercadopago: notificación sin data.id o sin tipo', {
        query: url.search,
        cuerpo,
      })
      // Firmada o no, sin id no hay nada que procesar. 200 para que no reintenten
      // eternamente algo que nunca vamos a poder resolver.
      return json({ ok: true, ignorado: 'notificación sin data.id o sin tipo' })
    }

    // --- 1. Firma ---------------------------------------------------------
    const secreto = Deno.env.get('MP_WEBHOOK_SECRET')
    if (!secreto) {
      console.error(
        'webhook-mercadopago: falta MP_WEBHOOK_SECRET, no se puede validar la firma. ' +
          'Configuralo con `supabase secrets set MP_WEBHOOK_SECRET=...`',
      )
      // Sin secreto no se puede distinguir a Mercado Pago de cualquiera: se
      // rechaza, que es lo seguro. Nunca procesar "confiando" en que viene bien.
      return json({ error: 'Webhook sin configurar' }, 401)
    }

    const requestId = req.headers.get('x-request-id') ?? ''
    const firma = req.headers.get('x-signature') ?? ''

    if (!(await firmaValida(firma, requestId, notificacion.dataId, url, secreto))) {
      console.error('webhook-mercadopago: firma inválida', {
        dataId: notificacion.dataId,
        tipo: notificacion.tipo,
        requestId,
      })
      return json({ error: 'Firma inválida' }, 401)
    }

    const admin = adminClient()

    // --- 2. Idempotencia --------------------------------------------------
    // La marca se pone ANTES de procesar: si el procesamiento falla a la mitad,
    // no queremos que el reintento de Mercado Pago vuelva a correr algo que
    // pudo haber quedado hecho a medias. El precio de esa decisión es que un
    // fallo hay que resolverlo mirando eventos_facturacion, no esperando el
    // reintento; por eso todo error se registra ahí.
    const { error: errorMarca } = await admin
      .from('eventos_mp_procesados')
      .insert({ mp_data_id: notificacion.dataId, tipo: notificacion.tipo })

    if (errorMarca) {
      // 23505 = unique_violation: ya lo habíamos procesado.
      if (errorMarca.code === '23505') {
        return json({ ok: true, repetido: true })
      }
      console.error('webhook-mercadopago: no se pudo marcar el evento', errorMarca)
      return json({ ok: true, error_interno: 'no se pudo marcar el evento' })
    }

    // --- 3. Procesamiento -------------------------------------------------
    // Cualquier cosa que pase acá adentro se registra pero no cambia el 200.
    try {
      const resultado = await procesar(admin, notificacion)
      return json({ ok: true, ...resultado })
    } catch (err) {
      console.error('webhook-mercadopago: falló el procesamiento', notificacion, err)
      return json({ ok: true, error_interno: mensajeDeError(err) })
    }
  } catch (err) {
    // Ni siquiera llegamos a leer la notificación. 200 igual: reintentar no lo
    // va a arreglar.
    console.error('webhook-mercadopago: error inesperado', err)
    return json({ ok: true, error_interno: 'error inesperado' })
  }
})

// ---------------------------------------------------------------------------
// Lectura de la notificación
// ---------------------------------------------------------------------------

/**
 * El `data.id` y el tipo, que según la notificación vienen en el body o en la
 * query string. Mercado Pago manda las dos formas según el origen del aviso, así
 * que se miran las dos y gana la que esté.
 */
function leerNotificacion(url: URL, cuerpo: Record<string, unknown>): Notificacion | null {
  const data = cuerpo.data as { id?: unknown } | undefined

  const dataId =
    url.searchParams.get('data.id') ??
    url.searchParams.get('id') ??
    (typeof data?.id === 'string' ? data.id : null) ??
    (typeof data?.id === 'number' ? String(data.id) : null)

  const tipo =
    (typeof cuerpo.type === 'string' ? cuerpo.type : null) ??
    (typeof cuerpo.topic === 'string' ? cuerpo.topic : null) ??
    url.searchParams.get('type') ??
    url.searchParams.get('topic')

  if (!dataId || !tipo) return null
  return { dataId, tipo }
}

// ---------------------------------------------------------------------------
// Firma
// ---------------------------------------------------------------------------

/**
 * ¿La firma del header `x-signature` es de Mercado Pago?
 *
 * El header viene como `ts=<unix>,v1=<hmac hex>`. Se firma el manifiesto
 * `id:{data.id};request-id:{x-request-id};ts:{ts};` con HMAC-SHA256 y la clave
 * secreta de la aplicación.
 *
 * Dos ambigüedades de la documentación, resueltas probando varios candidatos:
 *
 *  1. Mercado Pago pide el id en minúsculas cuando es alfanumérico, pero no
 *     aclara qué pasa con los que ya vienen en minúscula ni con los numéricos.
 *  2. El id puede haber salido de la query string o del body, y si difieren no
 *     hay forma de saber cuál usó Mercado Pago para firmar.
 *
 * Se arman los manifiestos candidatos y se acepta si alguno verifica. Esto no
 * afloja la seguridad: pasar de 1 a unos pocos MAC válidos sobre 2^256 no le
 * sirve a nadie que no tenga la clave.
 *
 * La comparación la hace `crypto.subtle.verify`, que compara en tiempo constante
 * dentro de la implementación de Web Crypto. Por eso no hay ningún `===` entre
 * el hash calculado y el recibido.
 *
 * No se valida que el `ts` sea reciente a propósito: los reintentos de Mercado
 * Pago reenvían la notificación original —misma firma, mismo ts— horas después,
 * y una ventana de frescura los rechazaría en loop. Contra la reinyección de una
 * notificación vieja protege `eventos_mp_procesados`, no el reloj.
 */
async function firmaValida(
  header: string,
  requestId: string,
  dataIdUsado: string,
  url: URL,
  secreto: string,
): Promise<boolean> {
  const partes = new Map<string, string>()
  for (const trozo of header.split(',')) {
    const [clave, valor] = trozo.split('=', 2)
    if (clave && valor) partes.set(clave.trim(), valor.trim())
  }

  const ts = partes.get('ts')
  const v1 = partes.get('v1')
  if (!ts || !v1) return false

  const firmaRecibida = hexABytes(v1)
  if (!firmaRecibida) return false

  const clave = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secreto),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  )

  // Ids candidatos: el que se usó para procesar, más el de la query y el crudo,
  // cada uno tal cual y en minúsculas.
  const ids = new Set<string>([dataIdUsado])
  const idQuery = url.searchParams.get('data.id') ?? url.searchParams.get('id')
  if (idQuery) ids.add(idQuery)
  for (const id of [...ids]) ids.add(id.toLowerCase())

  for (const id of ids) {
    const manifiesto = `id:${id};request-id:${requestId};ts:${ts};`
    const ok = await crypto.subtle.verify(
      'HMAC',
      clave,
      firmaRecibida,
      new TextEncoder().encode(manifiesto),
    )
    if (ok) return true
  }

  return false
}

/**
 * Hex a bytes. null si el string no es hexadecimal válido.
 *
 * El buffer se crea explícito para que el tipo quede `Uint8Array<ArrayBuffer>`:
 * `crypto.subtle.verify` no acepta el `ArrayBufferLike` que infiere el
 * constructor pelado, porque podría ser un SharedArrayBuffer.
 */
function hexABytes(hex: string): Uint8Array<ArrayBuffer> | null {
  if (hex.length === 0 || hex.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(hex)) return null
  const bytes = new Uint8Array(new ArrayBuffer(hex.length / 2))
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

// ---------------------------------------------------------------------------
// Procesamiento
// ---------------------------------------------------------------------------

interface ResultadoProceso {
  tipo: string
  accion: string
  inmobiliaria_id?: string
}

async function procesar(
  admin: SupabaseClient,
  notificacion: Notificacion,
): Promise<ResultadoProceso> {
  const accessToken = requireEnv('MP_ACCESS_TOKEN')

  if (notificacion.tipo === TIPO_PREAPPROVAL) {
    return await manejarPreapproval(admin, notificacion.dataId, accessToken)
  }
  if (notificacion.tipo === TIPO_PAGO_RECURRENTE) {
    return await manejarPagoRecurrente(admin, notificacion.dataId, accessToken)
  }

  // `payment` y cualquier otro tipo caen acá: se reconocen y se dejan pasar.
  return { tipo: notificacion.tipo, accion: 'ignorado' }
}

/**
 * Cambió la suscripción en sí.
 *
 * `authorized` es la suscripción ya vinculada y cobrable; `cancelled` es la baja,
 * la haya hecho el usuario o Mercado Pago, y se resuelve en `manejarBaja` sin
 * cortar el período ya pago. `pending` (todavía no autorizada) y
 * `paused` no mueven el estado: ninguno de los dos es un cobro fallido, y
 * mandarlos a GRACIA le pondría un reloj de vencimiento a alguien que no debe
 * nada.
 */
async function manejarPreapproval(
  admin: SupabaseClient,
  preapprovalId: string,
  accessToken: string,
): Promise<ResultadoProceso> {
  const preapproval = await traerDeMp(
    `${MP_API}/preapproval/${encodeURIComponent(preapprovalId)}`,
    accessToken,
  )

  const inmobiliariaId = textoDe(preapproval.external_reference)
  const estadoMp = textoDe(preapproval.status)

  const inmobiliaria = await buscarInmobiliaria(admin, inmobiliariaId, {
    preapprovalId,
    tipo: TIPO_PREAPPROVAL,
  })
  if (!inmobiliaria) return { tipo: TIPO_PREAPPROVAL, accion: 'inmobiliaria_desconocida' }

  if (estadoMp === 'authorized') {
    // El estado se leyó recién de Mercado Pago: si dice `authorized`, esta
    // suscripción cobra, así que una baja vieja que haya quedado marcada ya no
    // aplica. Sin esto, quien vuelve a suscribirse después de cancelar arrastra
    // `cancelacion_solicitada` y el cron lo cortaría en su próxima fecha de cobro.
    await marcarActiva(admin, inmobiliaria, textoDe(preapproval.next_payment_date), preapproval, {
      limpiarCancelacion: true,
    })
    return { tipo: TIPO_PREAPPROVAL, accion: 'activada', inmobiliaria_id: inmobiliaria.id }
  }

  if (estadoMp === 'cancelled') {
    return await manejarBaja(admin, inmobiliaria, preapprovalId, preapproval)
  }

  await registrarEvento(admin, inmobiliaria.id, 'suscripcion_sin_cambio', {
    detalle: `Estado '${estadoMp}' de la suscripción ${preapprovalId}: no mueve el estado de la cuenta`,
    raw_payload: preapproval,
  })
  return { tipo: TIPO_PREAPPROVAL, accion: 'sin_cambio', inmobiliaria_id: inmobiliaria.id }
}

/**
 * Mercado Pago informó la suscripción como `cancelled`.
 *
 * El aviso llega cuando se da de baja el cobro —desde `cancelar-suscripcion` o
 * desde la cuenta de Mercado Pago del dueño—, no cuando se termina lo que pagó.
 * Qué se hace con la cuenta lo decide `decidirCancelacion`; ver `cancelacion.ts`.
 */
async function manejarBaja(
  admin: SupabaseClient,
  inmobiliaria: InmobiliariaWebhook,
  preapprovalId: string,
  preapproval: Record<string, unknown>,
): Promise<ResultadoProceso> {
  const decision = decidirCancelacion(
    inmobiliaria,
    textoDe(preapproval.next_payment_date),
    new Date(),
  )

  if (decision.accion === 'diferir') {
    // El estado NO se toca: sigue ACTIVA hasta `fecha_proximo_cobro` y el paso a
    // CANCELADA lo da el cron. La fecha se reescribe por si venía de Mercado
    // Pago porque la base no la tenía; sin ella el cron nunca la cortaría.
    const { error } = await admin
      .from('inmobiliarias')
      .update({ cancelacion_solicitada: true, fecha_proximo_cobro: decision.accesoHasta })
      .eq('id', inmobiliaria.id)
    if (error) throw new Error(`no se pudo registrar la baja: ${error.message}`)

    await registrarEvento(admin, inmobiliaria.id, 'suscripcion_cancelada', {
      detalle:
        `Mercado Pago informó la suscripción ${preapprovalId} como cancelled. ` +
        `Mantiene acceso hasta ${decision.accesoHasta}.`,
      raw_payload: preapproval,
    })
    return { tipo: TIPO_PREAPPROVAL, accion: 'baja_diferida', inmobiliaria_id: inmobiliaria.id }
  }

  if (decision.accion === 'mantener_trial') {
    await registrarEvento(admin, inmobiliaria.id, 'suscripcion_cancelada', {
      detalle:
        `Mercado Pago informó la suscripción ${preapprovalId} como cancelled. ` +
        'La cuenta sigue en período de prueba hasta que venza.',
      raw_payload: preapproval,
    })
    return { tipo: TIPO_PREAPPROVAL, accion: 'baja_en_trial', inmobiliaria_id: inmobiliaria.id }
  }

  const { error } = await admin
    .from('inmobiliarias')
    .update({ estado_suscripcion: 'CANCELADA' })
    .eq('id', inmobiliaria.id)
  if (error) throw new Error(`no se pudo cancelar la inmobiliaria: ${error.message}`)

  await registrarEvento(admin, inmobiliaria.id, 'suscripcion_cancelada', {
    detalle: `Mercado Pago informó la suscripción ${preapprovalId} como cancelled`,
    raw_payload: preapproval,
  })
  return { tipo: TIPO_PREAPPROVAL, accion: 'cancelada', inmobiliaria_id: inmobiliaria.id }
}

/**
 * Llegó un cobro mensual de la suscripción.
 *
 * El resultado real está en `payment.status` del recurso, no en el `status` del
 * authorized_payment (que describe el ciclo de cobro, no si entró la plata).
 */
async function manejarPagoRecurrente(
  admin: SupabaseClient,
  pagoId: string,
  accessToken: string,
): Promise<ResultadoProceso> {
  const pago = await traerDeMp(
    `${MP_API}/authorized_payments/${encodeURIComponent(pagoId)}`,
    accessToken,
  )

  const preapprovalId = textoDe(pago.preapproval_id)
  const pagoInterno = (pago.payment ?? {}) as Record<string, unknown>
  const estadoPago = textoDe(pagoInterno.status) ?? textoDe(pago.status)
  const mpPaymentId = textoDe(pagoInterno.id) ?? null
  const monto = numeroDe(pago.transaction_amount)

  // El authorized_payment no siempre trae external_reference; cuando falta, la
  // inmobiliaria se resuelve por el preapproval, que sí lo tiene.
  let inmobiliariaId = textoDe(pago.external_reference)
  let preapproval: Record<string, unknown> | null = null

  if (!inmobiliariaId && preapprovalId) {
    preapproval = await traerDeMp(
      `${MP_API}/preapproval/${encodeURIComponent(preapprovalId)}`,
      accessToken,
    )
    inmobiliariaId = textoDe(preapproval.external_reference)
  }

  const inmobiliaria = await buscarInmobiliaria(admin, inmobiliariaId, {
    preapprovalId: preapprovalId ?? pagoId,
    tipo: TIPO_PAGO_RECURRENTE,
  })
  if (!inmobiliaria) {
    return { tipo: TIPO_PAGO_RECURRENTE, accion: 'inmobiliaria_desconocida' }
  }

  if (estadoPago && PAGO_APROBADO.includes(estadoPago)) {
    // La fecha del próximo cobro la sabe el preapproval, no el pago.
    if (!preapproval && preapprovalId) {
      preapproval = await traerDeMp(
        `${MP_API}/preapproval/${encodeURIComponent(preapprovalId)}`,
        accessToken,
      ).catch(() => null)
    }

    await marcarActiva(admin, inmobiliaria, textoDe(preapproval?.next_payment_date), pago, {
      monto,
      mpPaymentId,
    })
    return { tipo: TIPO_PAGO_RECURRENTE, accion: 'pago_aprobado', inmobiliaria_id: inmobiliaria.id }
  }

  // Todo lo que no es aprobado se trata como cobro fallido: la cuenta entra en
  // gracia y el cron aparte decide cuándo vence.
  await admin
    .from('inmobiliarias')
    .update({
      estado_suscripcion: 'GRACIA',
      fecha_ultimo_pago_fallido: new Date().toISOString(),
    })
    .eq('id', inmobiliaria.id)

  await registrarEvento(admin, inmobiliaria.id, 'pago_rechazado', {
    detalle: `Cobro ${pagoId} en estado '${estadoPago ?? 'desconocido'}'`,
    monto,
    mpPaymentId,
    raw_payload: pago,
  })
  return { tipo: TIPO_PAGO_RECURRENTE, accion: 'pago_rechazado', inmobiliaria_id: inmobiliaria.id }
}

interface InmobiliariaWebhook {
  id: string
  plan: string | null
  estado_suscripcion: string
  fecha_proximo_cobro: string | null
}

/**
 * Pasa la cuenta a ACTIVA, le sincroniza el cupo del plan y anota el evento.
 *
 * `fecha_ultimo_pago_fallido` se limpia: si venía de GRACIA, el pago que acaba
 * de entrar deja esa marca sin sentido, y el cron de vencimiento la mira.
 */
async function marcarActiva(
  admin: SupabaseClient,
  inmobiliaria: InmobiliariaWebhook,
  proximoCobro: string | null | undefined,
  payload: unknown,
  extra?: { monto?: number | null; mpPaymentId?: string | null; limpiarCancelacion?: boolean },
): Promise<void> {
  const cambios: Record<string, unknown> = {
    estado_suscripcion: 'ACTIVA',
    fecha_ultimo_pago_fallido: null,
  }
  if (proximoCobro) cambios.fecha_proximo_cobro = proximoCobro
  if (extra?.limpiarCancelacion) cambios.cancelacion_solicitada = false

  const cupo = await limiteDelPlan(admin, inmobiliaria.plan)
  if (cupo.aplicar) cambios.limite_usuarios = cupo.limite

  const { error } = await admin.from('inmobiliarias').update(cambios).eq('id', inmobiliaria.id)
  if (error) throw new Error(`no se pudo activar la inmobiliaria: ${error.message}`)

  const cupoDescripto = !cupo.aplicar
    ? 'sin cambio'
    : cupo.limite === null
      ? 'sin tope'
      : String(cupo.limite)

  await registrarEvento(admin, inmobiliaria.id, 'pago_aprobado', {
    detalle:
      `Suscripción activa. Plan ${inmobiliaria.plan ?? 'sin definir'}, ` +
      `cupo ${cupoDescripto}` +
      (proximoCobro ? `, próximo cobro ${proximoCobro}` : ''),
    monto: extra?.monto ?? null,
    mpPaymentId: extra?.mpPaymentId ?? null,
    raw_payload: payload,
  })
}

/**
 * El cupo que le corresponde al plan, listo para copiar a `inmobiliarias`.
 *
 * Hay tres respuestas posibles y las tres importan, por eso no alcanza con
 * devolver `number | null`:
 *   - `{ aplicar: true, limite: 5 }`    → el plan tiene tope
 *   - `{ aplicar: true, limite: null }` → el plan NO tiene tope (NULL es el
 *     valor real que se escribe, no una ausencia)
 *   - `{ aplicar: false }`              → no sabemos; se deja el cupo como
 *     estaba, que es mejor que bajárselo a alguien que acaba de pagar
 */
type CupoDelPlan = { aplicar: true; limite: number | null } | { aplicar: false }

async function limiteDelPlan(admin: SupabaseClient, plan: string | null): Promise<CupoDelPlan> {
  if (!plan) return { aplicar: false }

  const { data, error } = await admin
    .from('planes_cupo')
    .select('limite_usuarios')
    .eq('plan', plan)
    .maybeSingle<{ limite_usuarios: number | null }>()

  if (error || !data) {
    console.error(`webhook-mercadopago: no se pudo leer el cupo del plan ${plan}`, error)
    return { aplicar: false }
  }

  // NULL en `planes_cupo` significa "sin tope", y ahora `inmobiliarias` también
  // lo admite, así que se copia tal cual. `hayCupo` lee ese NULL como "siempre
  // hay lugar" sin comparar contra ningún número.
  return {
    aplicar: true,
    limite: data.limite_usuarios === null ? null : Number(data.limite_usuarios),
  }
}

/**
 * La inmobiliaria del evento, o null si no se puede identificar.
 *
 * Una notificación cuyo `external_reference` no corresponde a ninguna fila es
 * una anomalía —una suscripción de otro entorno apuntando a este webhook, o una
 * inmobiliaria borrada—. Se registra en el log y se sigue: no se puede anotar en
 * `eventos_facturacion` porque esa tabla exige un `inmobiliaria_id` que existe.
 */
async function buscarInmobiliaria(
  admin: SupabaseClient,
  inmobiliariaId: string | null | undefined,
  contexto: { preapprovalId: string; tipo: string },
): Promise<InmobiliariaWebhook | null> {
  if (!inmobiliariaId) {
    console.error('webhook-mercadopago: notificación sin external_reference', contexto)
    return null
  }

  const { data, error } = await admin
    .from('inmobiliarias')
    .select('id, plan, estado_suscripcion, fecha_proximo_cobro')
    .eq('id', inmobiliariaId)
    .maybeSingle<InmobiliariaWebhook>()

  if (error) {
    // Un id con formato inválido hace que Postgres rechace la comparación; es
    // el mismo caso que "no existe" desde el punto de vista del webhook.
    console.error('webhook-mercadopago: no se pudo buscar la inmobiliaria', {
      ...contexto,
      inmobiliariaId,
      error: error.message,
    })
    return null
  }

  if (!data) {
    console.error('webhook-mercadopago: external_reference no corresponde a ninguna inmobiliaria', {
      ...contexto,
      inmobiliariaId,
    })
    return null
  }

  return data
}

interface DatosEvento {
  detalle: string
  monto?: number | null
  mpPaymentId?: string | null
  raw_payload?: unknown
}

async function registrarEvento(
  admin: SupabaseClient,
  inmobiliariaId: string,
  tipo: string,
  datos: DatosEvento,
): Promise<void> {
  const { error } = await admin.from('eventos_facturacion').insert({
    inmobiliaria_id: inmobiliariaId,
    tipo,
    detalle: datos.detalle,
    monto: datos.monto ?? null,
    moneda: 'ARS',
    mp_payment_id: datos.mpPaymentId ?? null,
    raw_payload: datos.raw_payload ?? null,
  })

  // El estado de la cuenta ya se actualizó; perder el log no justifica romper.
  if (error) {
    console.error(`webhook-mercadopago: no se pudo registrar el evento ${tipo}`, error)
  }
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

/** GET a la API de Mercado Pago. La notificación avisa qué cambió, no cómo quedó. */
async function traerDeMp(url: string, accessToken: string): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MP_MS),
  })

  if (!res.ok) {
    const cuerpo = (await res.text()).slice(0, 500)
    throw new Error(`Mercado Pago respondió ${res.status} en ${url}: ${cuerpo}`)
  }

  return (await res.json()) as Record<string, unknown>
}

function textoDe(valor: unknown): string | null {
  if (typeof valor === 'string' && valor.trim()) return valor.trim()
  if (typeof valor === 'number') return String(valor)
  return null
}

function numeroDe(valor: unknown): number | null {
  const n = Number(valor)
  return Number.isFinite(n) ? n : null
}

function requireEnv(nombre: string): string {
  const valor = Deno.env.get(nombre)
  if (!valor) throw new Error(`Falta la variable de entorno ${nombre}`)
  return valor
}

function mensajeDeError(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`
  return String(err)
}

function json(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
