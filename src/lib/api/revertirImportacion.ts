import { supabase } from '../supabase'
import { interpretarErrorSupabase } from '../errores'
import type { Json } from '../../types/database'

/**
 * Deshacer una importación de leads (RPC `revertir_importacion`).
 *
 * La RPC corre con permisos propios y decide todo: quién puede, la ventana de
 * 7 días y qué leads se conservan (los que ya tienen interacciones, tareas,
 * operaciones, etc.). Acá solo se llama y se traduce la respuesta.
 *
 * Los errores que levanta la RPC ("No tenés permiso para revertir esta
 * importación.", "Tu usuario está desactivado.", …) son un `raise exception`
 * común: `interpretarErrorSupabase` los deja pasar tal cual, que es lo que hay
 * que mostrar.
 */

/** Lo que devuelve la simulación: no se borró nada. */
export interface SimulacionDeReversion {
  /** Leads de la importación en la cuenta. 0 si no existe, está vacía o es de otra cuenta. */
  total: number
  /** Los que se eliminarían. */
  borrables: number
  /** Los que se conservan porque ya tienen actividad. */
  protegidos: number
  enVentana: boolean
  /** Resume permiso y ventana: false = no se puede confirmar. */
  puede: boolean
  /** Por qué no se puede, si no se puede. */
  motivo: string | null
}

/** Lo que devuelve la confirmación. */
export interface ResultadoDeReversion {
  borrados: number
  protegidos: number
  /** Solo si no se borró nada por un motivo (ventana vencida, lote vacío). */
  motivo: string | null
}

const ERROR_GENERICO = 'No se pudo deshacer la importación.'
const RESPUESTA_INESPERADA = 'La base devolvió una respuesta inesperada.'

type Objeto = { [clave: string]: Json | undefined }

function comoObjeto(data: Json | null): Objeto | null {
  return typeof data === 'object' && data !== null && !Array.isArray(data) ? data : null
}

function numero(valor: Json | undefined): number | null {
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : null
}

function motivoDe(valor: Json | undefined): string | null {
  return typeof valor === 'string' && valor.trim() !== '' ? valor : null
}

function leerSimulacion(data: Json | null): SimulacionDeReversion | null {
  const o = comoObjeto(data)
  if (!o) return null
  const total = numero(o.total)
  const borrables = numero(o.borrables)
  const protegidos = numero(o.protegidos)
  if (total === null || borrables === null || protegidos === null) return null
  if (typeof o.en_ventana !== 'boolean' || typeof o.puede !== 'boolean') return null
  return {
    total,
    borrables,
    protegidos,
    enVentana: o.en_ventana,
    puede: o.puede,
    motivo: motivoDe(o.motivo),
  }
}

function leerResultado(data: Json | null): ResultadoDeReversion | null {
  const o = comoObjeto(data)
  if (!o) return null
  const borrados = numero(o.borrados)
  const protegidos = numero(o.protegidos)
  if (borrados === null || protegidos === null) return null
  return { borrados, protegidos, motivo: motivoDe(o.motivo) }
}

/**
 * `confirmar` en false simula (no borra nada); en true borra los leads que no
 * tienen actividad. Siempre se manda explícito: nunca null.
 */
export async function revertirImportacion(importacionId: string, confirmar: false): Promise<SimulacionDeReversion>
export async function revertirImportacion(importacionId: string, confirmar: true): Promise<ResultadoDeReversion>
export async function revertirImportacion(
  importacionId: string,
  confirmar: boolean,
): Promise<SimulacionDeReversion | ResultadoDeReversion>
export async function revertirImportacion(
  importacionId: string,
  confirmar: boolean,
): Promise<SimulacionDeReversion | ResultadoDeReversion> {
  const { data, error } = await supabase.rpc('revertir_importacion', {
    p_importacion_id: importacionId,
    p_confirmar: confirmar,
  })

  if (error) throw new Error(interpretarErrorSupabase(error, ERROR_GENERICO))

  const leido = confirmar ? leerResultado(data) : leerSimulacion(data)
  if (!leido) throw new Error(RESPUESTA_INESPERADA)
  return leido
}
