/**
 * cancelar-suscripcion
 *
 * Da de baja la suscripción en Mercado Pago sin cortarle el acceso al usuario.
 *
 * La baja es "al final del período": se cancela el cobro recurrente en Mercado
 * Pago y se marca `cancelacion_solicitada`, pero `estado_suscripcion` NO se
 * toca. La inmobiliaria sigue ACTIVA —con acceso normal— hasta que pase
 * `fecha_proximo_cobro`; recién ahí el cron `procesar_transiciones_suscripcion`
 * la mueve a CANCELADA. El usuario ya pagó ese mes: cortarle el acceso el día
 * que cancela sería quedarse con plata a cambio de nada.
 *
 * Requiere sesión de usuario (no service role) y que el caller sea DUENO: la
 * suscripción es de la inmobiliaria entera.
 */
import { preflight } from '../_shared/cors.ts'
import { errorResponse, jsonResponse } from '../_shared/http.ts'
import { adminClient, bearerToken, type PerfilBasico } from '../_shared/supabase.ts'

const MP_PREAPPROVAL_URL = 'https://api.mercadopago.com/preapproval'
const TIMEOUT_MP_MS = 15_000

interface InmobiliariaSuscripcion {
  id: string
  estado_suscripcion: string
  mp_preapproval_id: string | null
  cancelacion_solicitada: boolean
  fecha_proximo_cobro: string | null
}

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

    // --- 2. Sólo el dueño da de baja --------------------------------------
    const { data: perfil, error: perfilError } = await admin
      .from('profiles')
      .select('id, rol, inmobiliaria_id')
      .eq('id', userData.user.id)
      .single<PerfilBasico>()

    if (perfilError || !perfil) {
      return errorResponse(req, 'No se encontró tu perfil de agente', 403, 'PERFIL_NO_ENCONTRADO')
    }

    if (perfil.rol !== 'DUENO') {
      return errorResponse(
        req,
        'Sólo el dueño de la inmobiliaria puede cancelar la suscripción',
        403,
        'SIN_PERMISO',
      )
    }

    // --- 3. Config --------------------------------------------------------
    const mpAccessToken = Deno.env.get('MP_ACCESS_TOKEN')
    if (!mpAccessToken) {
      return errorResponse(
        req,
        'Falta el secreto MP_ACCESS_TOKEN. Configuralo con `supabase secrets set MP_ACCESS_TOKEN=...` ' +
          'antes de cancelar una suscripción.',
        500,
        'CONFIG_FALTANTE',
      )
    }

    // --- 4. ¿Hay algo que cancelar? ---------------------------------------
    const { data: inmobiliaria, error: errorInmo } = await admin
      .from('inmobiliarias')
      .select('id, estado_suscripcion, mp_preapproval_id, cancelacion_solicitada, fecha_proximo_cobro')
      .eq('id', perfil.inmobiliaria_id)
      .single<InmobiliariaSuscripcion>()

    if (errorInmo || !inmobiliaria) {
      console.error('cancelar-suscripcion: no se encontró la inmobiliaria', errorInmo)
      return errorResponse(req, 'No se encontró tu inmobiliaria', 500, 'ERROR_INTERNO')
    }

    if (!inmobiliaria.mp_preapproval_id || inmobiliaria.estado_suscripcion !== 'ACTIVA') {
      return errorResponse(
        req,
        'No tenés una suscripción activa para cancelar',
        400,
        'SIN_SUSCRIPCION_ACTIVA',
      )
    }

    // Cancelar dos veces no es un error del usuario: la primera ya hizo el
    // trabajo. Se contesta con el mismo cuerpo que la cancelación exitosa, sin
    // volver a pegarle a Mercado Pago.
    if (inmobiliaria.cancelacion_solicitada) {
      return jsonResponse(req, {
        cancelacion_solicitada: true,
        acceso_hasta: inmobiliaria.fecha_proximo_cobro,
        ya_estaba_cancelada: true,
      })
    }

    // --- 5. Cancelar en Mercado Pago --------------------------------------
    // Primero MP y después la base: si se marcara la baja acá y Mercado Pago
    // fallara, la suscripción seguiría cobrando con el usuario convencido de
    // que la dio de baja. Al revés el peor caso es una baja hecha en MP que no
    // quedó registrada, y ahí el webhook de `cancelled` la reconcilia.
    let respuestaMp: Response
    try {
      respuestaMp = await fetch(
        `${MP_PREAPPROVAL_URL}/${encodeURIComponent(inmobiliaria.mp_preapproval_id)}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${mpAccessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status: 'cancelled' }),
          signal: AbortSignal.timeout(TIMEOUT_MP_MS),
        },
      )
    } catch (err) {
      console.error('cancelar-suscripcion: no se pudo llamar a Mercado Pago', err)
      return errorResponse(
        req,
        'No pudimos contactar a Mercado Pago. Probá de nuevo en unos minutos.',
        502,
        'MP_NO_DISPONIBLE',
      )
    }

    if (!respuestaMp.ok) {
      const detalle = (await respuestaMp.text()).slice(0, 500)
      console.error(
        `cancelar-suscripcion: Mercado Pago respondió ${respuestaMp.status} para la inmobiliaria ${inmobiliaria.id}: ${detalle}`,
      )
      return errorResponse(
        req,
        'Mercado Pago no pudo cancelar la suscripción. Probá de nuevo o escribinos.',
        502,
        'MP_RECHAZO',
      )
    }

    // --- 6. Marcar la baja, sin tocar el estado ---------------------------
    const { error: errorGuardado } = await admin
      .from('inmobiliarias')
      .update({ cancelacion_solicitada: true })
      .eq('id', inmobiliaria.id)

    if (errorGuardado) {
      // La suscripción ya está cancelada en Mercado Pago, así que no se le va a
      // cobrar más: el error es de registro, no de plata. Se avisa fuerte para
      // poder repararlo a mano, pero no se le dice al usuario que falló algo
      // que en realidad salió bien.
      console.error(
        `cancelar-suscripcion: preapproval ${inmobiliaria.mp_preapproval_id} cancelado en Mercado Pago ` +
          `pero no se pudo marcar en la inmobiliaria ${inmobiliaria.id}`,
        errorGuardado,
      )
    }

    const { error: errorEvento } = await admin.from('eventos_facturacion').insert({
      inmobiliaria_id: inmobiliaria.id,
      tipo: 'cancelacion_solicitada',
      detalle:
        `El dueño canceló la suscripción ${inmobiliaria.mp_preapproval_id}. ` +
        `Mantiene acceso hasta ${inmobiliaria.fecha_proximo_cobro ?? 'el fin del período en curso'}.`,
      moneda: 'ARS',
    })

    if (errorEvento) {
      console.error('cancelar-suscripcion: no se pudo registrar el evento', errorEvento)
    }

    return jsonResponse(req, {
      cancelacion_solicitada: true,
      acceso_hasta: inmobiliaria.fecha_proximo_cobro,
      registrado: !errorGuardado,
    })
  } catch (err) {
    console.error('cancelar-suscripcion: error inesperado', err)
    return errorResponse(req, 'Error interno del servidor', 500, 'ERROR_INTERNO')
  }
})
