/**
 * Constantes de configuración del producto que no son secretos.
 *
 * Van en el código y no en variables de entorno a propósito: son datos
 * públicos —un número de contacto, que además viaja en el link de WhatsApp—,
 * y tenerlos acá evita que una build se rompa porque faltó una env var.
 */

/**
 * El WhatsApp al que escribe el cliente para renovar por transferencia.
 *
 * Formato de wa.me: sólo dígitos, con código de país y sin '+' ni espacios.
 * Para Argentina: 54 + 9 + área sin 0 + número sin 15. Ejemplo: 5493514123456.
 *
 * REEMPLAZAR antes de mostrarle esto a un cliente. Mientras tenga el valor de
 * placeholder, `linkDeCobros` devuelve null y los avisos no muestran el botón,
 * que es mejor que mandar a nadie a un chat con un número inventado.
 */
export const WHATSAPP_COBROS = '5492235827465'

/** true si `WHATSAPP_COBROS` ya tiene un número de verdad. */
export function hayWhatsAppDeCobros(): boolean {
  return /^\d{8,15}$/.test(WHATSAPP_COBROS)
}

/**
 * El link de WhatsApp con el mensaje ya escrito, o null si todavía no se
 * configuró el número.
 */
export function linkDeCobros(mensaje: string): string | null {
  if (!hayWhatsAppDeCobros()) return null
  return `https://wa.me/${WHATSAPP_COBROS}?text=${encodeURIComponent(mensaje)}`
}

/** El mensaje que el dueño manda para renovar. Incluye a quién representa. */
export function mensajeDeRenovacion(inmobiliaria: string | null, plan: string | null): string {
  const quien = inmobiliaria ? ` Soy de ${inmobiliaria}` : ''
  const cual = plan ? ` del plan ${plan}` : ''
  return `Hola! Quiero renovar mi suscripción a LeadEra${cual}.${quien}. ¿Me pasan los datos para la transferencia?`
}

/**
 * El mensaje de quien todavía no contrató y quiere pagar por transferencia.
 *
 * Separado de `mensajeDeRenovacion` porque no es lo mismo: el que renueva ya es
 * cliente y sabe qué plan tiene; éste está mirando las tarjetas y puede no
 * haber elegido todavía. No lleva el nombre de la inmobiliaria porque la
 * pantalla de planes se abre también sin cuenta armada.
 */
export function mensajeDeActivacion(): string {
  return 'Hola! Quiero contratar LeadEra y pagar por transferencia. ¿Me pasan los datos?'
}

// ---------------------------------------------------------------------------
// Datos de la cuenta bancaria, para el mensaje de cobro del panel /admin
// ---------------------------------------------------------------------------
// Viven acá y no en la base por la misma razón que el copy de los planes: son
// texto, no datos que cambien solos. Si algún día hay más de una cuenta para
// cobrar, esto se muda a una tabla.

export const ALIAS_TRANSFERENCIA = 'leadera'
export const TITULAR_TRANSFERENCIA = 'Mateo Camilion'

/**
 * El mensaje que el superadmin copia y le manda al dueño para cobrarle.
 *
 * Recibe todo ya formateado: quién decide cómo se ve una fecha o un monto es
 * la pantalla, que tiene los helpers, no este módulo.
 */
export function mensajeDeCobro(datos: {
  /** Nombre del dueño. Sin él, el saludo va sin nombre en vez de decir "null". */
  dueno: string | null
  plan: string
  /** Ya formateada, `DD/MM/AAAA`. */
  vencimiento: string
  /** Ya formateado, con símbolo. */
  monto: string
}): string {
  const saludo = datos.dueno ? `Hola ${datos.dueno}!` : 'Hola!'
  return (
    `${saludo} Te escribo por tu plan de LeadEra (${datos.plan}). ` +
    `Vence el ${datos.vencimiento} y el monto mensual es de ${datos.monto}. ` +
    `Podés transferir a:\n` +
    `Alias: ${ALIAS_TRANSFERENCIA}\n` +
    `Titular: ${TITULAR_TRANSFERENCIA}\n` +
    `Cuando la hagas, mandame el comprobante por acá y te lo activo. ¡Gracias!`
  )
}
