/**
 * Qué hacer con la cuenta cuando Mercado Pago avisa que la suscripción quedó
 * `cancelled`.
 *
 * Está separado de `index.ts`, sin imports de Deno ni de Supabase, para que la
 * decisión se pueda probar sola.
 *
 * La regla: el aviso de baja nunca le saca a la cuenta un acceso que todavía
 * tiene ganado. Mercado Pago avisa en el momento en que se da de baja el cobro
 * recurrente, no cuando se termina el mes que ya se pagó; si el aviso cortara
 * el acceso, el dueño lo perdería el mismo día que cancela.
 *
 *   - ACTIVA con fecha de corte futura → `diferir`: sigue ACTIVA, se marca la
 *     baja y el cron `procesar_transiciones_suscripcion` la pasa a CANCELADA
 *     cuando esa fecha pasa.
 *   - TRIAL → `mantener_trial`: no pagó nada que se pueda cancelar; la prueba
 *     sigue hasta `fecha_fin_trial` y el mismo cron la vence.
 *   - Todo lo demás → `cortar`: GRACIA (el último cobro no entró, no queda
 *     período pago), VENCIDA, CANCELADA, o ACTIVA sin ninguna fecha de corte
 *     futura conocida, donde no hay nada que respetar.
 */

export type DecisionCancelacion =
  | { accion: 'diferir'; accesoHasta: string }
  | { accion: 'mantener_trial' }
  | { accion: 'cortar' }

export interface CuentaAlCancelar {
  estado_suscripcion: string
  fecha_proximo_cobro: string | null
}

/**
 * @param proximoCobroMp `next_payment_date` del preapproval. Sólo se usa si la
 *   base no tiene fecha: la de la base la escribió el último cobro aprobado y es
 *   la que marca hasta dónde está pago.
 */
export function decidirCancelacion(
  cuenta: CuentaAlCancelar,
  proximoCobroMp: string | null,
  ahora: Date,
): DecisionCancelacion {
  if (cuenta.estado_suscripcion === 'TRIAL') return { accion: 'mantener_trial' }

  if (cuenta.estado_suscripcion === 'ACTIVA') {
    const fechaDeCorte = cuenta.fecha_proximo_cobro ?? proximoCobroMp
    const corte = fechaDeCorte ? new Date(fechaDeCorte) : null

    if (corte && !Number.isNaN(corte.getTime()) && corte.getTime() > ahora.getTime()) {
      return { accion: 'diferir', accesoHasta: fechaDeCorte! }
    }
  }

  return { accion: 'cortar' }
}
