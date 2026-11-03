/**
 * Avisos que se repiten en los modales del panel. Viven juntos para que todos
 * digan lo mismo sobre quién puede leer una nota y sobre una cuenta suspendida.
 */

/**
 * La nota va a `eventos_facturacion.detalle`, que el dueño de la cuenta puede
 * leer en su historial de cobros.
 */
export const AVISO_NOTA_VISIBLE = 'Esta nota la puede ver el cliente en su historial de cobros.'

/** La nota se guarda en `bloqueos_cuenta`, que sólo lee el superadmin. */
export const AVISO_NOTA_INTERNA = 'Es interna: el cliente no la ve.'

/** Registrar un pago, mover una fecha o extender la prueba no levanta una suspensión. */
export const AVISO_CUENTA_SUSPENDIDA =
  'La cuenta está suspendida: esto no la reactiva. Usá Reactivar cuenta.'
