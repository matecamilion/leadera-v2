import { describe, expect, it } from 'vitest'
import { PATRONES_TEXTO_FIJO, limpiarMensaje } from './textosFijos'

const MARCADOR = '¡Luego de contactarlo, pide que te califiquen!'
const FRASE_ZONAPROP = `${MARCADOR} ¡Envía el siguiente link y tu buena atención se reflejará en tus avisos! https://www.zonaprop.com.ar/panel/feedback/1234567?utm_source=integracion&utm_medium=link`

describe('limpiarMensaje', () => {
  it('saca la frase de ZonaProp y el link de feedback, y deja lo que escribió la persona', () => {
    expect(limpiarMensaje(`Hola, es apto crédito? ${FRASE_ZONAPROP}`)).toBe('Hola, es apto crédito?')
  })

  it('conserva el prefijo "Pregunta: " cuando detrás hay algo', () => {
    expect(limpiarMensaje(`Pregunta: Hola, es apto crédito? ${FRASE_ZONAPROP}`)).toBe(
      'Pregunta: Hola, es apto crédito?',
    )
  })

  it('el patrón es abierto: una versión levemente cambiada del texto posterior al marcador igual se limpia', () => {
    const cambiada = `${MARCADOR} Mandá este enlace y tu atención se verá reflejada: https://ejemplo.invalid/feedback/99?utm_source=otra`
    expect(limpiarMensaje(`Pregunta: ¿Sigue disponible? ${cambiada}`)).toBe('Pregunta: ¿Sigue disponible?')
  })

  it('saca desde el marcador hasta el final, sin importar lo que siga', () => {
    expect(limpiarMensaje(`Hola ${MARCADOR} cualquier otra cosa`)).toBe('Hola')
  })

  it('con saltos de línea antes del marcador, no deja espacios de más', () => {
    expect(limpiarMensaje(`Hola\n\n${FRASE_ZONAPROP}`)).toBe('Hola')
  })

  it('un mensaje sin el marcador queda intacto', () => {
    expect(limpiarMensaje('Hola, quiero visitar el depto')).toBe('Hola, quiero visitar el depto')
    expect(limpiarMensaje('Pregunta: ¿Sigue disponible?')).toBe('Pregunta: ¿Sigue disponible?')
    // Parecido pero no es el marcador: no se toca.
    expect(limpiarMensaje('Luego de contactarlo pide que te califiquen')).toBe(
      'Luego de contactarlo pide que te califiquen',
    )
  })

  it('si tras limpiar no queda nada, es vacío', () => {
    expect(limpiarMensaje(FRASE_ZONAPROP)).toBeNull()
    expect(limpiarMensaje(`  ${FRASE_ZONAPROP}  `)).toBeNull()
  })

  it('si solo queda "Pregunta:" (o con espacios) también es vacío', () => {
    expect(limpiarMensaje(`Pregunta: ${FRASE_ZONAPROP}`)).toBeNull()
    expect(limpiarMensaje('Pregunta:   ')).toBeNull()
    expect(limpiarMensaje('Pregunta:')).toBeNull()
  })

  it('sin mensaje devuelve null', () => {
    expect(limpiarMensaje(null)).toBeNull()
    expect(limpiarMensaje('')).toBeNull()
  })

  it('los patrones son una lista de datos: nombre y expresión', () => {
    expect(PATRONES_TEXTO_FIJO.length).toBeGreaterThan(0)
    for (const { nombre, patron } of PATRONES_TEXTO_FIJO) {
      expect(nombre).toEqual(expect.any(String))
      expect(patron).toBeInstanceOf(RegExp)
    }
  })
})
