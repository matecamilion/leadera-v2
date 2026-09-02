import type { Database } from '../types/database'

export type EstadoLead = Database['public']['Enums']['estado_lead']
export type OrigenLead = Database['public']['Enums']['origen_lead']

/**
 * Etiquetas legibles de estado y origen.
 *
 * Viven acá y no en `api/leads.ts` para que quien sólo necesite traducir un
 * valor no arrastre el cliente de Supabase: `exportarExcel` se carga por
 * import dinámico, y si de paso trajera `api/leads` el bundler terminaría
 * metiendo supabase en el chunk principal. `api/leads` las re-exporta, así
 * que el resto de la app las sigue importando de donde siempre.
 */
export const ORIGENES_LEAD: { valor: OrigenLead; label: string }[] = [
  { valor: 'MANUAL', label: 'Carga manual' },
  { valor: 'REFERIDO', label: 'Referido' },
  { valor: 'WHATSAPP', label: 'WhatsApp' },
  { valor: 'FORMULARIO_WEB', label: 'Formulario web' },
  { valor: 'META_ADS', label: 'Meta Ads' },
  { valor: 'INSTAGRAM', label: 'Instagram' },
  { valor: 'FACEBOOK', label: 'Facebook' },
  { valor: 'LANDING', label: 'Landing' },
  { valor: 'OTRO', label: 'Otro' },
]

export function etiquetaOrigen(origen: OrigenLead | null): string {
  if (!origen) return '—'
  return ORIGENES_LEAD.find((o) => o.valor === origen)?.label ?? origen
}

const ESTADOS_LEAD: Record<EstadoLead, string> = {
  CALIENTE: 'Caliente',
  TIBIO: 'Tibio',
  FRIO: 'Frío',
  GANADO: 'Ganado',
  INACTIVO: 'Inactivo',
}

/** `null` es "Nuevo": el lead existe pero todavía nadie lo clasificó. */
export function etiquetaEstado(estado: EstadoLead | null): string {
  if (!estado) return 'Nuevo'
  return ESTADOS_LEAD[estado] ?? estado
}
