import { supabase } from '../supabase'
import type { Database } from '../../types/database'
import { mensajeDeFuncion } from './equipo'

export type Plan = Database['public']['Enums']['plan_leadera']
export type EstadoSuscripcion = Database['public']['Enums']['estado_suscripcion']

/** Orden en el que se muestran los planes: del más chico al más grande. */
export const PLANES: Plan[] = ['SOLO', 'AGENCIA_CHICA', 'AGENCIA_GRANDE']

interface DetallePlan {
  nombre: string
  bajada: string
  /** Lo que incluye, en viñetas. */
  incluye: string[]
  /**
   * El plan que se muestra destacado.
   *
   * Vive acá y no en la pantalla porque es una decisión comercial, del mismo
   * orden que la bajada o las viñetas: cambia cuando cambia lo que queremos
   * empujar, no cuando cambia el diseño.
   */
  destacado?: boolean
}

/**
 * El texto comercial de cada plan.
 *
 * Vive en el front y no en la base porque `planes_precio` guarda plata, no
 * copy: cambiar una viñeta no debería ser un update en producción.
 *
 * Los números de usuarios de acá tienen que coincidir con el
 * `inmobiliarias.limite_usuarios` que hace cumplir `hayCupo`: si la tarjeta
 * promete más de lo que el backend deja invitar, el dueño paga y después choca
 * contra el tope.
 */
export const DETALLE_PLAN: Record<Plan, DetallePlan> = {
  SOLO: {
    nombre: 'Solo',
    bajada: 'Para el agente que trabaja por su cuenta.',
    incluye: ['1 usuario', 'Leads, propiedades y operaciones', 'Agenda y tareas'],
  },
  AGENCIA_CHICA: {
    nombre: 'Agencia Chica',
    bajada: 'Para el equipo que recién arranca.',
    incluye: ['Hasta 5 usuarios', 'Todo lo del plan Solo', 'Estadísticas del equipo'],
    destacado: true,
  },
  AGENCIA_GRANDE: {
    nombre: 'Agencia Grande',
    bajada: 'Para la inmobiliaria con varios agentes.',
    incluye: [
      'Usuarios ilimitados',
      'Todo lo del plan Agencia Chica',
      'Soporte prioritario',
    ],
  },
}

export interface PrecioPlan {
  plan: Plan
  precio_usd: number
  /** Precio en pesos que se le cobra hoy. null si todavía no se calculó nunca. */
  precio_ars: number | null
  /** Cuándo se recalculó por última vez contra el dólar MEP. */
  actualizado_at: string | null
}

/**
 * Los precios de los tres planes.
 *
 * `planes_precio` es lectura pública: son los precios de lista, y la pantalla
 * tiene que poder mostrarlos sin depender de a qué inmobiliaria pertenece quien
 * mira. Los actualiza semanalmente la Edge Function `actualizar-precios-planes`.
 */
export async function listarPreciosPlanes(): Promise<PrecioPlan[]> {
  const { data, error } = await supabase
    .from('planes_precio')
    .select('plan, precio_usd, precio_ars_actual, actualizado_at')

  if (error) throw new Error(`No se pudieron cargar los precios: ${error.message}`)

  const porPlan = new Map(
    (data ?? []).map((fila) => [
      fila.plan,
      {
        plan: fila.plan,
        precio_usd: Number(fila.precio_usd),
        precio_ars: fila.precio_ars_actual === null ? null : Number(fila.precio_ars_actual),
        actualizado_at: fila.actualizado_at,
      },
    ]),
  )

  // Se devuelven en el orden de PLANES y no en el que vino la query, para que
  // las tarjetas no se reordenen entre cargas.
  return PLANES.map((plan) => porPlan.get(plan)).filter((p): p is PrecioPlan => !!p)
}

export interface EstadoDeMiSuscripcion {
  plan: Plan | null
  estado: EstadoSuscripcion
  tieneSuscripcionEnMp: boolean
  fecha_fin_trial: string | null
  fecha_proximo_cobro: string | null
}

/**
 * El estado de suscripción de mi inmobiliaria, o null si no se puede leer.
 *
 * Mismo caso que `obtenerCupo`: hoy `inmobiliarias` no tiene policy de SELECT
 * para usuarios autenticados, así que la fila vuelve vacía y esto devuelve
 * null. Se modela como "no sé" y no como "no tiene nada" a propósito —la
 * pantalla, ante la duda, muestra los planes, que es la salida útil—. Cuando se
 * agregue la policy, esta función empieza a devolver datos sin tocar el código.
 */
export async function obtenerEstadoSuscripcion(): Promise<EstadoDeMiSuscripcion | null> {
  const { data, error } = await supabase
    .from('inmobiliarias')
    .select('plan, estado_suscripcion, mp_preapproval_id, fecha_fin_trial, fecha_proximo_cobro')
    .maybeSingle()

  if (error) {
    console.error('No se pudo leer el estado de la suscripción', error)
    return null
  }
  if (!data) return null

  return {
    plan: data.plan,
    estado: data.estado_suscripcion,
    tieneSuscripcionEnMp: data.mp_preapproval_id !== null,
    fecha_fin_trial: data.fecha_fin_trial,
    fecha_proximo_cobro: data.fecha_proximo_cobro,
  }
}

export interface SuscripcionCreada {
  /** La URL del checkout de Mercado Pago. Ahí se manda el navegador. */
  init_point: string
  preapproval_id: string
  plan: Plan
  precio_ars: number
  status: string | null
}

/**
 * Crea la suscripción en Mercado Pago y devuelve el link de pago.
 *
 * El precio no viaja desde el cliente: lo resuelve la Edge Function leyendo
 * `planes_precio`, así que nadie puede contratar el plan grande al precio del
 * chico tocando el request.
 */
export async function crearSuscripcion(plan: Plan): Promise<SuscripcionCreada> {
  const { data, error } = await supabase.functions.invoke<SuscripcionCreada>(
    'crear-suscripcion',
    { body: { plan } },
  )

  if (error) {
    throw new Error(await mensajeDeFuncion(error, 'No se pudo iniciar la suscripción.'))
  }
  if (!data?.init_point) throw new Error('Mercado Pago no devolvió el link de pago.')

  return data
}

// ---------------------------------------------------------------------------
// La vuelta desde Mercado Pago
// ---------------------------------------------------------------------------

export type TonoVuelta = 'exito' | 'espera' | 'error'

export interface VueltaDeMercadoPago {
  tono: TonoVuelta
  titulo: string
  mensaje: string
}

/** Estados con los que Mercado Pago dice que la suscripción quedó autorizada. */
const ESTADOS_OK = ['authorized', 'approved']

/** Estados de "todavía no se sabe": el cobro se está procesando. */
const ESTADOS_PENDIENTES = ['pending', 'in_process', 'in_mediation']

/**
 * Interpreta los parámetros con los que Mercado Pago devuelve al `back_url`.
 *
 * La documentación de preapproval no publica la lista exacta de parámetros de
 * retorno, así que esto no se apoya en uno solo: mira `preapproval_id` y, para
 * el estado, `status` o `collection_status` —los dos nombres que usa Mercado
 * Pago según el flujo—. Si llega un parámetro que no conocemos, cae en el caso
 * neutro de "estamos confirmando" en vez de afirmar algo falso.
 *
 * Nada de esto es prueba de pago: la fuente de verdad es el webhook, que es
 * quien pasa la inmobiliaria a ACTIVA. Por eso ni el caso bueno dice "listo,
 * pagaste", sino que la autorización quedó tomada.
 *
 * Devuelve null si la URL no viene de una vuelta de Mercado Pago.
 */
export function interpretarVuelta(params: URLSearchParams): VueltaDeMercadoPago | null {
  const preapprovalId = params.get('preapproval_id')
  const estado = (params.get('status') ?? params.get('collection_status') ?? '')
    .trim()
    .toLowerCase()

  if (!preapprovalId && !estado) return null

  if (ESTADOS_OK.includes(estado)) {
    return {
      tono: 'exito',
      titulo: 'Autorizaste la suscripción',
      mensaje:
        'Mercado Pago ya tomó la autorización. En cuanto nos confirme el primer cobro, tu cuenta queda al día.',
    }
  }

  if (ESTADOS_PENDIENTES.includes(estado)) {
    return {
      tono: 'espera',
      titulo: 'Pago pendiente de confirmación',
      mensaje:
        'Mercado Pago todavía está procesando el pago. Puede tardar unos minutos; te avisamos cuando se acredite.',
    }
  }

  if (estado === 'rejected' || estado === 'cancelled' || estado === 'failure') {
    return {
      tono: 'error',
      titulo: 'No se pudo completar la suscripción',
      mensaje:
        'Mercado Pago rechazó la operación o la cancelaste. Podés volver a elegir un plan cuando quieras.',
    }
  }

  // Volvió del checkout pero sin un estado que sepamos leer.
  return {
    tono: 'espera',
    titulo: 'Estamos confirmando tu suscripción',
    mensaje:
      'Volviste de Mercado Pago. Apenas nos confirme el resultado, vas a ver tu plan activo acá.',
  }
}
