/**
 * Qué preguntas se hacen y qué se manda. Puro: depende solo de lo que devolvió
 * el GET y de lo que la persona contestó.
 *
 * Tiene que coincidir con `validarPost` de la edge function, que rechaza
 * cualquier clave que no corresponda al flujo.
 */
import { esPropietario } from '../../../supabase/functions/consulta-publica/encuesta.ts'
import type { DatosLink, DatosContacto, Operacion, PayloadConsulta, Respuestas } from './tipos'

export type IdPaso =
  | 'operacion'
  | 'tipo_propiedad'
  | 'zona'
  | 'presupuesto'
  | 'pago'
  | 'garantia'
  | 'publicada'
  | 'plazo'
  | 'visita'
  | 'vender'
  | 'contacto'

/** La operación fijada por la propiedad o la que eligió la persona. */
export function operacionDe(datos: DatosLink, r: Respuestas): Operacion | undefined {
  return datos.operacion_fija ?? r.operacion
}

export function armarPasos(datos: DatosLink, r: Respuestas): IdPaso[] {
  const off = new Set(datos.link.preguntas_off)
  // Antes de elegir operación, el lugar de pago/garantía lo ocupa "pago": el
  // total de pasos es el mismo y la barra de progreso no salta.
  const pagoOGarantia: IdPaso = operacionDe(datos, r) === 'ALQUILER' ? 'garantia' : 'pago'

  if (datos.flujo === 'GENERAL') {
    // Propietario: cuánto vale (o pretende) y si ya está publicada; ni pago,
    // ni garantía, ni "¿tenés una propiedad para vender?".
    const op = operacionDe(datos, r)
    if (op && esPropietario(op)) {
      return ['operacion', 'tipo_propiedad', 'zona', 'presupuesto', 'publicada', 'plazo', 'contacto']
    }
    return [
      'operacion',
      'tipo_propiedad',
      'zona',
      'presupuesto',
      pagoOGarantia,
      'plazo',
      ...(off.has('vender') ? [] : (['vender'] as IdPaso[])),
      'contacto',
    ]
  }

  return [
    ...(datos.operacion_fija ? [] : (['operacion'] as IdPaso[])),
    'presupuesto',
    pagoOGarantia,
    'plazo',
    ...(off.has('visita') ? [] : (['visita'] as IdPaso[])),
    'contacto',
  ]
}

/**
 * Al cambiar de operación se borra lo que ya no aplica: el rango (otra lista,
 * quizás otra moneda), pago, garantía, publicada y, para un propietario,
 * "vender". Así nunca se manda una clave que el servidor rechazaría.
 */
export function conOperacion(datos: DatosLink, r: Respuestas, operacion: Operacion): Respuestas {
  if (r.operacion === operacion) return r
  const siguiente: Respuestas = { ...r, operacion }
  delete siguiente.pago
  delete siguiente.garantia
  delete siguiente.publicada
  if (esPropietario(operacion)) delete siguiente.vender
  if (datos.flujo === 'GENERAL') delete siguiente.presupuesto
  return siguiente
}

/** Las respuestas que se mandan: solo las de los pasos de este flujo. */
export function respuestasParaEnviar(datos: DatosLink, r: Respuestas): Record<string, string | boolean> {
  const salida: Record<string, string | boolean> = {}
  for (const paso of armarPasos(datos, r)) {
    if (paso === 'contacto') continue
    if (paso === 'operacion' && datos.operacion_fija) continue
    const valor = r[paso]
    if (valor === undefined) continue
    if (paso === 'zona' && typeof valor === 'string' && !valor.trim()) continue
    salida[paso] = typeof valor === 'string' ? valor.trim() : valor
  }
  return salida
}

export function armarPayload(
  datos: DatosLink,
  token: string,
  r: Respuestas,
  contacto: DatosContacto,
  hp: string,
): PayloadConsulta {
  const pideEmail = !datos.link.preguntas_off.includes('email')
  return {
    token,
    hp,
    consentimiento: true,
    respuestas: respuestasParaEnviar(datos, r),
    contacto: {
      nombre: contacto.nombre.trim(),
      apellido: contacto.apellido.trim(),
      telefono: contacto.telefono.trim(),
      ...(pideEmail && contacto.email.trim() ? { email: contacto.email.trim() } : {}),
    },
  }
}
