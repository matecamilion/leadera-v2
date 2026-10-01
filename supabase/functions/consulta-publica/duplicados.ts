/**
 * ¿La consulta es de alguien que ya es lead de la inmobiliaria?
 *
 * Primero por teléfono y, si no hay match, por email. Todo filtrado a mano por
 * `inmobiliaria_id`: esto corre con service role y la RLS no aplica.
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { normalizarTelefonoAR, soloDigitos } from '../_shared/telefono.ts'

/** Mismo ancla que `buscarLeadPorTelefono()` del front. */
const DIGITOS_DE_ANCLA = 4

/**
 * Tope de candidatos por ancla. Cuatro dígitos dentro de una sola
 * inmobiliaria dan pocos; si se llega al tope se avisa en el log, porque el
 * match pudo haber quedado afuera.
 */
const TOPE_CANDIDATOS = 500

export interface LeadExistente {
  id: string
  agente_id: string | null
  estado: string | null
  por: 'TELEFONO' | 'EMAIL'
}

interface FilaLead {
  id: string
  agente_id: string | null
  estado: string | null
  updated_at: string
  telefono?: string | null
}

/**
 * Si hay varios: gana el del agente del link y, entre iguales, el más
 * recientemente tocado.
 */
function elegir(filas: FilaLead[], agenteLink: string): FilaLead | null {
  if (filas.length === 0) return null
  return [...filas].sort((a, b) => {
    const propioA = a.agente_id === agenteLink ? 0 : 1
    const propioB = b.agente_id === agenteLink ? 0 : 1
    if (propioA !== propioB) return propioA - propioB
    return b.updated_at.localeCompare(a.updated_at)
  })[0]
}

/** `\`, `%` y `_` son especiales en LIKE; `%` y `*` ya los rechaza la validación. */
function escaparLike(texto: string): string {
  return texto.replace(/[\\%_]/g, (c) => `\\${c}`)
}

export async function buscarLeadExistente(
  admin: SupabaseClient,
  inmobiliariaId: string,
  agenteLink: string,
  telefono: string,
  telefonoNorm: string,
  email: string | null,
): Promise<LeadExistente | null> {
  // --- Teléfono ---------------------------------------------------------
  // `leads.telefono` está guardado como lo tipeó cada uno. Se prefiltra por
  // los últimos dígitos y se compara normalizando de este lado.
  const ancla = soloDigitos(telefono).slice(-DIGITOS_DE_ANCLA)
  if (ancla.length === DIGITOS_DE_ANCLA) {
    const { data, error } = await admin
      .from('leads')
      .select('id, agente_id, estado, updated_at, telefono')
      .eq('inmobiliaria_id', inmobiliariaId)
      .ilike('telefono', `%${ancla}%`)
      .limit(TOPE_CANDIDATOS)

    if (error) throw new Error(`duplicados por teléfono: ${error.message}`)

    const filas = (data ?? []) as FilaLead[]
    if (filas.length >= TOPE_CANDIDATOS) {
      console.warn(JSON.stringify({
        evento: 'duplicados_tope_candidatos',
        inmobiliaria_id: inmobiliariaId,
        tope: TOPE_CANDIDATOS,
      }))
    }

    const iguales = filas.filter((f) => normalizarTelefonoAR(f.telefono ?? '') === telefonoNorm)
    const elegido = elegir(iguales, agenteLink)
    if (elegido) {
      return { id: elegido.id, agente_id: elegido.agente_id, estado: elegido.estado, por: 'TELEFONO' }
    }
  }

  // --- Email --------------------------------------------------------------
  // `ilike` sin comodines = igualdad sin distinguir mayúsculas, el mismo
  // criterio que `leads_email_unico_por_inmobiliaria` (lower(email)).
  if (email) {
    const { data, error } = await admin
      .from('leads')
      .select('id, agente_id, estado, updated_at')
      .eq('inmobiliaria_id', inmobiliariaId)
      .ilike('email', escaparLike(email))
      .limit(10)

    if (error) throw new Error(`duplicados por email: ${error.message}`)

    const elegido = elegir((data ?? []) as FilaLead[], agenteLink)
    if (elegido) {
      return { id: elegido.id, agente_id: elegido.agente_id, estado: elegido.estado, por: 'EMAIL' }
    }
  }

  return null
}
