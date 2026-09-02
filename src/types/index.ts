/**
 * Entidades del dominio de LeadEra.
 *
 * PLACEHOLDER — Fase 0. La forma definitiva sale del esquema de Supabase en
 * Fase 1; por ahora estos tipos sólo fijan el vocabulario del dominio para que
 * las páginas y hooks tengan a qué referirse.
 */

export type UUID = string
/** ISO 8601, siempre en UTC. */
export type ISODate = string

export type EstadoLead =
  | 'nuevo'
  | 'contactado'
  | 'calificado'
  | 'visita'
  | 'negociacion'
  | 'ganado'
  | 'perdido'

export interface Lead {
  id: UUID
  nombre: string
  email: string | null
  telefono: string | null
  estado: EstadoLead
  agenteId: UUID | null
  creadoEn: ISODate
}

export interface Agente {
  id: UUID
  /** FK a auth.users de Supabase. */
  userId: UUID
  nombre: string
  email: string
  activo: boolean
}

export type TipoPropiedad = 'casa' | 'departamento' | 'terreno' | 'local' | 'oficina'
export type EstadoPropiedad = 'disponible' | 'reservada' | 'vendida' | 'alquilada'

export interface Propiedad {
  id: UUID
  titulo: string
  tipo: TipoPropiedad
  estado: EstadoPropiedad
  direccion: string | null
  precio: number | null
  moneda: 'ARS' | 'USD'
  creadoEn: ISODate
}

export type TipoOperacion = 'venta' | 'alquiler'
export type EstadoOperacion = 'abierta' | 'cerrada' | 'cancelada'

export interface Operacion {
  id: UUID
  tipo: TipoOperacion
  estado: EstadoOperacion
  leadId: UUID | null
  propiedadId: UUID | null
  agenteId: UUID | null
  monto: number | null
  creadoEn: ISODate
}
