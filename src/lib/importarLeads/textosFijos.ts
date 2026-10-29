/**
 * Texto fijo que los portales agregan a los mensajes de las consultas y que no
 * es de la persona: se saca antes de guardar el mensaje.
 *
 * Los patrones son datos y viven solo acá: sumar un portal es sumar una línea a
 * `PATRONES_TEXTO_FIJO`. Lo que no coincide con ningún patrón no se toca.
 */

export interface PatronTextoFijo {
  /** Para quien lea la lista: de qué portal es y qué saca. */
  nombre: string
  /** Lo que coincide se borra del mensaje. */
  patron: RegExp
}

export const PATRONES_TEXTO_FIJO: readonly PatronTextoFijo[] = [
  {
    // "...¡Luego de contactarlo, pide que te califiquen! ¡Envía el siguiente link
    // y tu buena atención se reflejará en tus avisos! https://…?utm_source=…".
    // Abierto a propósito: desde el marcador hasta el final, sin exigir el resto
    // de la frase, que el portal puede retocar.
    nombre: 'ZonaProp: pedido de calificación y link de feedback',
    patron: /\s*¡Luego de contactarlo, pide que te califiquen![\s\S]*$/,
  },
]

/** "Pregunta:" (ZonaProp rotula así lo que escribió la persona) sin nada detrás. */
const SOLO_EL_ROTULO = /^Pregunta:?\s*$/

/**
 * El mensaje sin el texto fijo de los portales, o null si no queda nada.
 *
 * Un mensaje que no coincide con ningún patrón queda intacto. El prefijo
 * "Pregunta: " se conserva cuando detrás hay algo; si solo queda el rótulo, el
 * mensaje es vacío.
 */
export function limpiarMensaje(mensaje: string | null): string | null {
  if (!mensaje) return null

  let texto = mensaje
  for (const { patron } of PATRONES_TEXTO_FIJO) texto = texto.replace(patron, '')
  texto = texto.trim()

  return texto === '' || SOLO_EL_ROTULO.test(texto) ? null : texto
}
