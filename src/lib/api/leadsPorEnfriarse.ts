import { supabase } from '../supabase'
import { interpretarErrorSupabase } from '../errores'
import type { EstadoLead } from '../etiquetasLead'
import type { Database } from '../../types/database'

/** Días sin contacto real a partir de los cuales un lead se avisa. */
export const DIAS_AVISO_ENFRIARSE = 21

/** Cuántos leads trae Mi día; el resto se cuenta en `total`. */
export const LIMITE_POR_ENFRIARSE = 20

type FilaRpc = Database['public']['Functions']['leads_por_enfriarse']['Returns'][number]

/** Un lead que está por enfriarse, con la nulabilidad real de la base. */
export interface LeadPorEnfriarse extends Omit<FilaRpc, 'apellido' | 'estado' | 'total'> {
  apellido: string | null
  estado: EstadoLead | null
}

export interface PorEnfriarse {
  leads: LeadPorEnfriarse[]
  /** Todos los que cumplen la regla, no solo los que vinieron en `leads`. */
  total: number
}

/**
 * El único punto donde se corrige el tipo de la RPC: el generador no expresa la
 * nulabilidad de las columnas de retorno de una función.
 */
export function aPorEnfriarse(filas: FilaRpc[]): PorEnfriarse {
  const leads = filas.map(({ total: _total, ...lead }) => lead as LeadPorEnfriarse)
  // `total` es un count(*) over () y repite el mismo valor en cada fila.
  return { leads, total: Number(filas[0]?.total ?? 0) }
}

/**
 * Leads sin contacto real desde hace `DIAS_AVISO_ENFRIARSE` días o más.
 *
 * No filtra por `asignado_a`: RLS decide qué ve cada rol, y un asistente ve
 * los del agente al que asiste, estén asignados a él o no. Por eso no se manda
 * `p_asignado_a`, que la RPC deja en null.
 */
export async function obtenerLeadsPorEnfriarse(): Promise<PorEnfriarse> {
  const { data, error } = await supabase.rpc('leads_por_enfriarse', {
    p_dias_aviso: DIAS_AVISO_ENFRIARSE,
    p_limite: LIMITE_POR_ENFRIARSE,
  })
  if (error) {
    throw new Error(interpretarErrorSupabase(error, 'No se pudieron cargar los leads por enfriarse.'))
  }
  return aPorEnfriarse(data ?? [])
}
