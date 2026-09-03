/**
 * actualizar-precios-planes
 *
 * Recalcula el precio en ARS de cada plan a partir del dólar MEP y lleva ese
 * precio nuevo a las suscripciones vivas de Mercado Pago.
 *
 * Está pensada para correr semanalmente por cron, pero por ahora se invoca a
 * mano. No la puede llamar un usuario común: exige el service role key (ver
 * `esServiceRole`), porque toca la facturación de todas las inmobiliarias.
 *
 * Orden de las operaciones (importa):
 *   1. Cotización. Si no se puede obtener una cotización sana, no se toca nada.
 *   2. planes_precio + historial_precios_planes. La base es la fuente de verdad.
 *   3. Mercado Pago, en tandas cortas. Un error individual no corta el proceso:
 *      se registra en eventos_facturacion y se reporta al final.
 *
 * Secreto requerido: MP_ACCESS_TOKEN (`supabase secrets set MP_ACCESS_TOKEN=...`).
 *
 * Body opcional: { "simular": true } calcula y reporta sin escribir en la base
 * ni llamar a Mercado Pago. Útil para la primera prueba manual.
 */
import { preflight } from '../_shared/cors.ts'
import { errorResponse, jsonResponse } from '../_shared/http.ts'
import { adminClient, bearerToken } from '../_shared/supabase.ts'
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

/** Dólar MEP ("bolsa"). Se usa el valor de venta, que es el que paga quien compra dólares. */
const DOLAR_MEP_URL = 'https://dolarapi.com/v1/dolares/bolsa'
const MP_PREAPPROVAL_URL = 'https://api.mercadopago.com/preapproval'

const TIMEOUT_COTIZACION_MS = 10_000
const TIMEOUT_MP_MS = 15_000

/** Intentos contra dolarapi.com antes de dar por caída la cotización. */
const INTENTOS_COTIZACION = 3

/**
 * Banda de sanidad para la cotización, en ARS por USD. No busca ser precisa:
 * sólo descartar respuestas absurdas (0, negativos, un campo que cambió de
 * unidad) antes de escribir precios a partir de ellas.
 */
const COTIZACION_MINIMA = 100
const COTIZACION_MAXIMA = 1_000_000

/** Estados de suscripción que se cobran, y por lo tanto hay que reajustar en MP. */
const ESTADOS_COBRABLES = ['ACTIVA', 'GRACIA']

/** Cuántas suscripciones se actualizan en paralelo contra la API de Mercado Pago. */
const CONCURRENCIA_MP = 5

const TIPO_EVENTO_OK = 'precio_actualizado'
const TIPO_EVENTO_ERROR = 'error_actualizacion_precio'

type Plan = 'SOLO' | 'AGENCIA_CHICA' | 'AGENCIA_GRANDE'

interface FilaPlan {
  plan: Plan
  precio_usd: number
  precio_ars_actual: number | null
  cotizacion_usada: number | null
}

interface PlanRecalculado {
  plan: Plan
  precio_usd: number
  precio_ars_anterior: number | null
  precio_ars: number
}

interface Suscripcion {
  id: string
  nombre: string
  plan: Plan | null
  estado_suscripcion: string
  mp_preapproval_id: string
}

interface ErrorSuscripcion {
  inmobiliaria_id: string
  nombre: string
  plan: Plan | null
  mp_preapproval_id: string
  motivo: string
}

interface Cotizacion {
  venta: number
  fecha_actualizacion: string | null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(req)
  if (req.method !== 'POST') {
    return errorResponse(req, 'Método no permitido', 405, 'METODO_NO_PERMITIDO')
  }

  try {
    // --- 1. Autorización: sólo service role ------------------------------
    const token = bearerToken(req)
    if (!token) {
      return errorResponse(req, 'Falta el token de autenticación', 401, 'NO_AUTENTICADO')
    }
    if (!esServiceRole(token)) {
      return errorResponse(
        req,
        'Esta función sólo se puede invocar con el service role key',
        403,
        'SIN_PERMISO',
      )
    }

    // El body es opcional: sin body, corrida real.
    const simular = await leerFlagSimular(req)

    // --- 2. El token de Mercado Pago tiene que estar configurado ---------
    // Se chequea antes de escribir nada: si falta, la corrida no puede
    // terminar el trabajo, y no tiene sentido dejar la base adelantada
    // respecto de Mercado Pago.
    const mpAccessToken = Deno.env.get('MP_ACCESS_TOKEN')
    if (!simular && !mpAccessToken) {
      return errorResponse(
        req,
        'Falta el secreto MP_ACCESS_TOKEN. Configuralo con `supabase secrets set MP_ACCESS_TOKEN=...` ' +
          'o desde el dashboard (Edge Functions → Secrets) antes de correr esta función.',
        500,
        'CONFIG_FALTANTE',
      )
    }

    const admin = adminClient()

    // --- 3. Cotización del MEP -------------------------------------------
    let cotizacion: Cotizacion
    try {
      cotizacion = await obtenerCotizacionMep()
    } catch (err) {
      // Nada se escribió todavía: es mejor no tocar precios que tocarlos con
      // un dato inválido.
      console.error('actualizar-precios-planes: no se pudo obtener el dólar MEP', err)
      return errorResponse(
        req,
        'No se pudo obtener una cotización válida del dólar MEP, no se actualizó ningún precio: ' +
          mensajeDeError(err),
        503,
        'COTIZACION_NO_DISPONIBLE',
      )
    }

    // --- 4. Recalcular los precios de los planes -------------------------
    const { data: filas, error: errorPlanes } = await admin
      .from('planes_precio')
      .select('plan, precio_usd, precio_ars_actual, cotizacion_usada')
      .returns<FilaPlan[]>()

    if (errorPlanes) {
      console.error('actualizar-precios-planes: no se pudo leer planes_precio', errorPlanes)
      return errorResponse(
        req,
        'No se pudieron leer los precios de los planes',
        500,
        'ERROR_INTERNO',
      )
    }
    if (!filas || filas.length === 0) {
      return errorResponse(req, 'No hay planes cargados en planes_precio', 500, 'ERROR_INTERNO')
    }

    const recalculados: PlanRecalculado[] = []
    for (const fila of filas) {
      const precioUsd = Number(fila.precio_usd)
      if (!Number.isFinite(precioUsd) || precioUsd <= 0) {
        console.error(
          `actualizar-precios-planes: precio_usd inválido para el plan ${fila.plan}`,
          fila.precio_usd,
        )
        return errorResponse(
          req,
          `El plan ${fila.plan} tiene un precio_usd inválido, no se actualizó ningún precio`,
          500,
          'ERROR_INTERNO',
        )
      }
      recalculados.push({
        plan: fila.plan,
        precio_usd: precioUsd,
        precio_ars_anterior:
          fila.precio_ars_actual === null ? null : Number(fila.precio_ars_actual),
        precio_ars: redondearACentena(precioUsd * cotizacion.venta),
      })
    }

    if (!simular) {
      const motivoFalla = await guardarPrecios(admin, recalculados, cotizacion.venta)
      if (motivoFalla) {
        console.error('actualizar-precios-planes: falló el guardado de precios', motivoFalla)
        return errorResponse(
          req,
          `No se pudieron guardar los precios: ${motivoFalla}`,
          500,
          'ERROR_INTERNO',
        )
      }
    }

    const precioPorPlan = new Map<Plan, number>(recalculados.map((p) => [p.plan, p.precio_ars]))

    // --- 5. Suscripciones vivas en Mercado Pago --------------------------
    const { data: suscripciones, error: errorSusc } = await admin
      .from('inmobiliarias')
      .select('id, nombre, plan, estado_suscripcion, mp_preapproval_id')
      .not('mp_preapproval_id', 'is', null)
      .in('estado_suscripcion', ESTADOS_COBRABLES)
      .returns<Suscripcion[]>()

    if (errorSusc) {
      // Los precios de los planes ya quedaron actualizados; lo que no se pudo
      // hacer es propagarlos. Se reporta como error para que la corrida no
      // pase por exitosa.
      console.error('actualizar-precios-planes: no se pudieron leer las suscripciones', errorSusc)
      return errorResponse(
        req,
        'Los precios de los planes se actualizaron, pero no se pudieron leer las suscripciones para propagarlos a Mercado Pago',
        500,
        'ERROR_INTERNO',
      )
    }

    // --- 6. Propagar a Mercado Pago --------------------------------------
    const pendientes = suscripciones ?? []
    const errores: ErrorSuscripcion[] = []
    let actualizadas = 0

    if (!simular) {
      for (const tanda of enTandas(pendientes, CONCURRENCIA_MP)) {
        const resultados = await Promise.all(
          tanda.map((s) => actualizarSuscripcion(admin, s, precioPorPlan, mpAccessToken!)),
        )
        for (const resultado of resultados) {
          if (resultado === null) actualizadas++
          else errores.push(resultado)
        }
      }
    }

    // --- 7. Respuesta -----------------------------------------------------
    return jsonResponse(req, {
      simulado: simular,
      cotizacion: {
        fuente: DOLAR_MEP_URL,
        venta: cotizacion.venta,
        fecha_actualizacion: cotizacion.fecha_actualizacion,
      },
      planes: recalculados,
      suscripciones: {
        total: pendientes.length,
        actualizadas,
        con_error: errores.length,
      },
      errores,
    })
  } catch (err) {
    console.error('actualizar-precios-planes: error inesperado', err)
    return errorResponse(req, 'Error interno del servidor', 500, 'ERROR_INTERNO')
  }
})

/**
 * ¿El token es el service role key del proyecto?
 *
 * Se aceptan dos formas: que sea exactamente el key inyectado en la función
 * (cubre el formato nuevo `sb_secret_...`) o que sea un JWT con el claim
 * `role: service_role` (cubre keys legacy y rotaciones). No alcanza con que el
 * gateway haya validado el JWT: cualquier usuario logueado pasa ese filtro.
 */
function esServiceRole(token: string): boolean {
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (serviceRoleKey && igualdadConstante(token, serviceRoleKey)) return true

  const partes = token.split('.')
  if (partes.length !== 3) return false
  try {
    const payload = JSON.parse(decodificarBase64Url(partes[1]))
    return payload?.role === 'service_role'
  } catch {
    return false
  }
}

/** Comparación de strings sin early-return, para no filtrar el key por tiempo. */
function igualdadConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let distintos = 0
  for (let i = 0; i < a.length; i++) {
    distintos |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return distintos === 0
}

function decodificarBase64Url(segmento: string): string {
  const base64 = segmento.replace(/-/g, '+').replace(/_/g, '/')
  const relleno = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
  return new TextDecoder().decode(Uint8Array.from(atob(relleno), (c) => c.charCodeAt(0)))
}

/** `simular: true` en el body. Sin body, o body que no es JSON: corrida real. */
async function leerFlagSimular(req: Request): Promise<boolean> {
  try {
    const texto = await req.text()
    if (!texto.trim()) return false
    return JSON.parse(texto)?.simular === true
  } catch {
    return false
  }
}

/**
 * Cotización de venta del MEP. Reintenta ante fallos de red o respuestas
 * inválidas, y tira si no logra un número dentro de la banda de sanidad.
 */
async function obtenerCotizacionMep(): Promise<Cotizacion> {
  let ultimoError = 'sin detalle'

  for (let intento = 1; intento <= INTENTOS_COTIZACION; intento++) {
    try {
      const res = await fetch(DOLAR_MEP_URL, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_COTIZACION_MS),
      })

      if (!res.ok) {
        ultimoError = `dolarapi.com respondió ${res.status}`
      } else {
        const cuerpo = await res.json()
        const venta = Number(cuerpo?.venta)

        if (!Number.isFinite(venta) || venta < COTIZACION_MINIMA || venta > COTIZACION_MAXIMA) {
          ultimoError = `la cotización recibida no es plausible (venta: ${JSON.stringify(cuerpo?.venta)})`
        } else {
          return {
            venta,
            fecha_actualizacion:
              typeof cuerpo?.fechaActualizacion === 'string' ? cuerpo.fechaActualizacion : null,
          }
        }
      }
    } catch (err) {
      ultimoError = mensajeDeError(err)
    }

    // Espera creciente entre intentos, por si es un hipo momentáneo.
    if (intento < INTENTOS_COTIZACION) {
      await new Promise((resolve) => setTimeout(resolve, 500 * intento))
    }
  }

  throw new Error(`${INTENTOS_COTIZACION} intentos fallidos (${ultimoError})`)
}

/** ROUND(monto, -2): a la centena más cercana, para que el precio quede "lindo". */
function redondearACentena(monto: number): number {
  return Math.round(monto / 100) * 100
}

/**
 * Escribe los precios nuevos en planes_precio y deja la huella en
 * historial_precios_planes. Devuelve null si salió todo bien, o el motivo.
 */
async function guardarPrecios(
  admin: SupabaseClient,
  planes: PlanRecalculado[],
  cotizacion: number,
): Promise<string | null> {
  const actualizadoAt = new Date().toISOString()

  // Fila por fila (planes_precio tiene `plan` como clave y sólo tres filas): un
  // upsert insertaría un plan nuevo si alguna vez llegara un valor del enum que
  // no está cargado, y acá se quiere actualizar lo que existe, nada más.
  for (const plan of planes) {
    const { error } = await admin
      .from('planes_precio')
      .update({
        precio_ars_actual: plan.precio_ars,
        cotizacion_usada: cotizacion,
        actualizado_at: actualizadoAt,
      })
      .eq('plan', plan.plan)

    if (error) return `no se pudo actualizar el plan ${plan.plan} (${error.message})`
  }

  const { error: errorHistorial } = await admin.from('historial_precios_planes').insert(
    planes.map((plan) => ({
      plan: plan.plan,
      precio_usd: plan.precio_usd,
      precio_ars: plan.precio_ars,
      cotizacion_usada: cotizacion,
    })),
  )

  // El historial es auditoría: si falla, los precios ya son válidos, así que se
  // deja constancia en los logs y la corrida sigue.
  if (errorHistorial) {
    console.error('actualizar-precios-planes: no se pudo escribir el historial', errorHistorial)
  }

  return null
}

/**
 * Lleva el precio nuevo a una suscripción de Mercado Pago y registra el evento.
 * Devuelve null si salió bien, o el detalle del error para el reporte final.
 * Nunca tira: un error acá no debe cortar el resto de las suscripciones.
 */
async function actualizarSuscripcion(
  admin: SupabaseClient,
  suscripcion: Suscripcion,
  precioPorPlan: Map<Plan, number>,
  mpAccessToken: string,
): Promise<ErrorSuscripcion | null> {
  const precio = suscripcion.plan ? precioPorPlan.get(suscripcion.plan) : undefined

  if (precio === undefined) {
    return await registrarError(
      admin,
      suscripcion,
      null,
      `la inmobiliaria no tiene un plan con precio conocido (plan: ${suscripcion.plan ?? 'null'})`,
    )
  }

  try {
    const url = `${MP_PREAPPROVAL_URL}/${encodeURIComponent(suscripcion.mp_preapproval_id)}`
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${mpAccessToken}`,
        'Content-Type': 'application/json',
      },
      // Mercado Pago puede rechazar el cambio si el monto nuevo excede lo que
      // el pagador autorizó; en ese caso llega un 4xx y queda registrado.
      body: JSON.stringify({
        auto_recurring: { transaction_amount: precio, currency_id: 'ARS' },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MP_MS),
    })

    if (!res.ok) {
      const cuerpo = (await res.text()).slice(0, 500)
      return await registrarError(
        admin,
        suscripcion,
        precio,
        `Mercado Pago respondió ${res.status}: ${cuerpo}`,
      )
    }
  } catch (err) {
    return await registrarError(admin, suscripcion, precio, mensajeDeError(err))
  }

  const { error } = await admin.from('eventos_facturacion').insert({
    inmobiliaria_id: suscripcion.id,
    tipo: TIPO_EVENTO_OK,
    monto: precio,
    moneda: 'ARS',
  })

  // El monto en Mercado Pago ya quedó actualizado: si falla el log, la
  // suscripción igual cuenta como actualizada y el fallo va a los logs.
  if (error) {
    console.error(
      `actualizar-precios-planes: no se pudo registrar el evento OK de ${suscripcion.id}`,
      error,
    )
  }

  return null
}

/**
 * Registra el evento de error y devuelve la entrada para el reporte final.
 *
 * El motivo queda en `eventos_facturacion.detalle` —el status y el cuerpo de
 * error de Mercado Pago, o el mensaje de la excepción— además de ir a los logs
 * de la función y a la respuesta HTTP. Así, revisando la tabla más adelante, se
 * sabe por qué esa inmobiliaria no se pudo reajustar sin tener que cruzar con
 * los logs, que rotan.
 */
async function registrarError(
  admin: SupabaseClient,
  suscripcion: Suscripcion,
  precio: number | null,
  motivo: string,
): Promise<ErrorSuscripcion> {
  console.error(
    `actualizar-precios-planes: falló la suscripción ${suscripcion.mp_preapproval_id} de ` +
      `${suscripcion.nombre} (${suscripcion.id}): ${motivo}`,
  )

  const { error } = await admin.from('eventos_facturacion').insert({
    inmobiliaria_id: suscripcion.id,
    tipo: TIPO_EVENTO_ERROR,
    monto: precio,
    moneda: 'ARS',
    detalle: motivo,
  })

  if (error) {
    console.error(
      `actualizar-precios-planes: no se pudo registrar el evento de error de ${suscripcion.id}`,
      error,
    )
  }

  return {
    inmobiliaria_id: suscripcion.id,
    nombre: suscripcion.nombre,
    plan: suscripcion.plan,
    mp_preapproval_id: suscripcion.mp_preapproval_id,
    motivo,
  }
}

/** Parte una lista en tandas de `tamano`, para acotar la concurrencia contra MP. */
function enTandas<T>(items: T[], tamano: number): T[][] {
  const tandas: T[][] = []
  for (let i = 0; i < items.length; i += tamano) {
    tandas.push(items.slice(i, i + tamano))
  }
  return tandas
}

function mensajeDeError(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`
  return String(err)
}
