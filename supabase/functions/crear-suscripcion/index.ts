/**
 * crear-suscripcion
 *
 * Crea la suscripción (preapproval) en Mercado Pago para el plan que eligió el
 * dueño de la inmobiliaria y devuelve el `init_point`: la URL del checkout a la
 * que el frontend manda el navegador.
 *
 * La suscripción se crea en `status: "pending"`. Queda así hasta que el pagador
 * la autoriza en el checkout; quien pasa la inmobiliaria a ACTIVA es el webhook
 * de Mercado Pago, no esta función.
 *
 * Requiere sesión de usuario (no service role) y que el caller sea DUENO: el
 * plan y la facturación son de la inmobiliaria entera.
 *
 * Secretos/env: MP_ACCESS_TOKEN (obligatorio) y APP_BASE_URL (opcional, para
 * armar el back_url; por defecto el dominio de producción).
 */
import { preflight } from '../_shared/cors.ts'
import { errorResponse, jsonResponse } from '../_shared/http.ts'
import { adminClient, bearerToken, type PerfilBasico } from '../_shared/supabase.ts'

const MP_PREAPPROVAL_URL = 'https://api.mercadopago.com/preapproval'
const TIMEOUT_MP_MS = 15_000

/** Igual que en crear-invitacion: producción salvo que se configure otra cosa. */
const APP_BASE_URL_POR_DEFECTO = 'https://app.leadera.com.ar'

type Plan = 'SOLO' | 'AGENCIA_CHICA' | 'AGENCIA_GRANDE'

/** Cómo se llama cada plan de cara al usuario. Va en el `reason` del cobro. */
const NOMBRE_PLAN: Record<Plan, string> = {
  SOLO: 'Solo',
  AGENCIA_CHICA: 'Agencia Chica',
  AGENCIA_GRANDE: 'Agencia Grande',
}

const PLANES = Object.keys(NOMBRE_PLAN) as Plan[]

interface CrearSuscripcionInput {
  plan?: unknown
}

interface InmobiliariaSuscripcion {
  id: string
  estado_suscripcion: string
  mp_preapproval_id: string | null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(req)
  if (req.method !== 'POST') {
    return errorResponse(req, 'Método no permitido', 405, 'METODO_NO_PERMITIDO')
  }

  try {
    const admin = adminClient()

    // --- 1. Autenticación -----------------------------------------------
    const token = bearerToken(req)
    if (!token) {
      return errorResponse(req, 'Falta el token de autenticación', 401, 'NO_AUTENTICADO')
    }

    const { data: userData, error: userError } = await admin.auth.getUser(token)
    if (userError || !userData?.user) {
      return errorResponse(req, 'Sesión inválida o expirada', 401, 'NO_AUTENTICADO')
    }
    const caller = userData.user

    // --- 2. Sólo el dueño contrata --------------------------------------
    const { data: perfil, error: perfilError } = await admin
      .from('profiles')
      .select('id, rol, inmobiliaria_id')
      .eq('id', caller.id)
      .single<PerfilBasico>()

    if (perfilError || !perfil) {
      return errorResponse(req, 'No se encontró tu perfil de agente', 403, 'PERFIL_NO_ENCONTRADO')
    }

    if (perfil.rol !== 'DUENO') {
      return errorResponse(
        req,
        'Sólo el dueño de la inmobiliaria puede contratar o cambiar el plan',
        403,
        'SIN_PERMISO',
      )
    }

    // El email del checkout sale de Auth, no del input: si viniera del cliente,
    // cualquiera podría facturarle a otra persona.
    const payerEmail = caller.email
    if (!payerEmail) {
      return errorResponse(
        req,
        'Tu cuenta no tiene un email asociado, así que no se puede crear la suscripción',
        400,
        'INPUT_INVALIDO',
      )
    }

    // --- 3. Input ---------------------------------------------------------
    let body: CrearSuscripcionInput
    try {
      body = await req.json()
    } catch {
      return errorResponse(req, 'El cuerpo del request no es JSON válido', 400, 'JSON_INVALIDO')
    }

    if (typeof body.plan !== 'string' || !PLANES.includes(body.plan as Plan)) {
      return errorResponse(
        req,
        `El plan tiene que ser uno de: ${PLANES.join(', ')}`,
        400,
        'INPUT_INVALIDO',
      )
    }
    const plan = body.plan as Plan

    // --- 4. Config --------------------------------------------------------
    const mpAccessToken = Deno.env.get('MP_ACCESS_TOKEN')
    if (!mpAccessToken) {
      return errorResponse(
        req,
        'Falta el secreto MP_ACCESS_TOKEN. Configuralo con `supabase secrets set MP_ACCESS_TOKEN=...` ' +
          'antes de contratar un plan.',
        500,
        'CONFIG_FALTANTE',
      )
    }

    // --- 5. Estado actual de la inmobiliaria ------------------------------
    const { data: inmobiliaria, error: errorInmo } = await admin
      .from('inmobiliarias')
      .select('id, estado_suscripcion, mp_preapproval_id')
      .eq('id', perfil.inmobiliaria_id)
      .single<InmobiliariaSuscripcion>()

    if (errorInmo || !inmobiliaria) {
      console.error('crear-suscripcion: no se encontró la inmobiliaria', errorInmo)
      return errorResponse(req, 'No se encontró tu inmobiliaria', 500, 'ERROR_INTERNO')
    }

    // Con una suscripción ya autorizada, crear otra dejaría dos preapprovals
    // vivos cobrándole al mismo dueño. El cambio de plan sobre una suscripción
    // activa es otro flujo (un PUT sobre la que ya existe) y todavía no está.
    if (inmobiliaria.estado_suscripcion === 'ACTIVA' && inmobiliaria.mp_preapproval_id) {
      return errorResponse(
        req,
        'Ya tenés una suscripción activa. Escribinos para cambiar de plan.',
        409,
        'SUSCRIPCION_YA_ACTIVA',
      )
    }

    // --- 6. Precio del plan -----------------------------------------------
    const { data: filaPrecio, error: errorPrecio } = await admin
      .from('planes_precio')
      .select('precio_ars_actual')
      .eq('plan', plan)
      .single<{ precio_ars_actual: number | null }>()

    if (errorPrecio || !filaPrecio) {
      console.error(`crear-suscripcion: no se pudo leer el precio del plan ${plan}`, errorPrecio)
      return errorResponse(req, 'No se pudo leer el precio del plan', 500, 'ERROR_INTERNO')
    }

    const precioArs = Number(filaPrecio.precio_ars_actual)
    if (!Number.isFinite(precioArs) || precioArs <= 0) {
      // Pasa si `actualizar-precios-planes` todavía no corrió nunca.
      console.error(`crear-suscripcion: el plan ${plan} no tiene precio en ARS`, filaPrecio)
      return errorResponse(
        req,
        'El plan todavía no tiene un precio en pesos cargado. Probá de nuevo en unos minutos.',
        503,
        'PRECIO_NO_DISPONIBLE',
      )
    }

    // --- 7. Crear el preapproval en Mercado Pago --------------------------
    const backUrl = `${(Deno.env.get('APP_BASE_URL') ?? APP_BASE_URL_POR_DEFECTO).replace(/\/+$/, '')}/suscripcion`

    let respuestaMp: Response
    try {
      respuestaMp = await fetch(MP_PREAPPROVAL_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${mpAccessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: `LeadEra - Plan ${NOMBRE_PLAN[plan]}`,
          // El webhook identifica la inmobiliaria por acá, sin depender de que
          // el mp_preapproval_id haya llegado a guardarse.
          external_reference: inmobiliaria.id,
          payer_email: payerEmail,
          back_url: backUrl,
          auto_recurring: {
            frequency: 1,
            frequency_type: 'months',
            transaction_amount: precioArs,
            currency_id: 'ARS',
          },
          status: 'pending',
        }),
        signal: AbortSignal.timeout(TIMEOUT_MP_MS),
      })
    } catch (err) {
      console.error('crear-suscripcion: no se pudo llamar a Mercado Pago', err)
      return errorResponse(
        req,
        'No pudimos contactar a Mercado Pago. Probá de nuevo en unos minutos.',
        502,
        'MP_NO_DISPONIBLE',
      )
    }

    if (!respuestaMp.ok) {
      // El cuerpo de MP puede traer datos del comercio: va al log, no al cliente.
      const detalle = (await respuestaMp.text()).slice(0, 500)
      console.error(
        `crear-suscripcion: Mercado Pago respondió ${respuestaMp.status} para la inmobiliaria ${inmobiliaria.id}: ${detalle}`,
      )
      return errorResponse(
        req,
        'Mercado Pago rechazó la creación de la suscripción. Probá de nuevo o escribinos.',
        502,
        'MP_RECHAZO',
      )
    }

    const preapproval = await respuestaMp.json()
    const preapprovalId = typeof preapproval?.id === 'string' ? preapproval.id : null
    const initPoint =
      typeof preapproval?.init_point === 'string' ? preapproval.init_point : null

    if (!preapprovalId || !initPoint) {
      console.error('crear-suscripcion: respuesta de Mercado Pago sin id o init_point', preapproval)
      return errorResponse(
        req,
        'Mercado Pago no devolvió el link de pago. Probá de nuevo.',
        502,
        'MP_RECHAZO',
      )
    }

    // --- 8. Guardar la referencia -----------------------------------------
    // El estado NO se toca: la suscripción todavía no está autorizada y quien
    // la pasa a ACTIVA es el webhook.
    const { error: errorGuardado } = await admin
      .from('inmobiliarias')
      .update({ mp_preapproval_id: preapprovalId, plan })
      .eq('id', inmobiliaria.id)

    // Si esto falla, el preapproval igual existe en Mercado Pago y el webhook
    // puede reconciliarlo por `external_reference`. Cortar acá sería peor:
    // dejaría al dueño sin poder pagar por un problema nuestro.
    if (errorGuardado) {
      console.error(
        `crear-suscripcion: preapproval ${preapprovalId} creado pero no se pudo guardar en la inmobiliaria ${inmobiliaria.id}`,
        errorGuardado,
      )
    }

    return jsonResponse(req, {
      init_point: initPoint,
      preapproval_id: preapprovalId,
      plan,
      precio_ars: precioArs,
      status: typeof preapproval?.status === 'string' ? preapproval.status : null,
      guardado: !errorGuardado,
    })
  } catch (err) {
    console.error('crear-suscripcion: error inesperado', err)
    return errorResponse(req, 'Error interno del servidor', 500, 'ERROR_INTERNO')
  }
})
