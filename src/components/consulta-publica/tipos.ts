/**
 * Contrato con la edge function `consulta-publica`.
 *
 * Los códigos (operación, tipo, pago, garantía, plazo, presupuesto contra
 * propiedad) se importan del propio `encuesta.ts` de la función: es la única
 * fuente. Si allá se agrega un código, `catalogo.ts` deja de compilar hasta
 * que se le ponga etiqueta.
 */
import type {
  Flujo,
  Garantia,
  Operacion,
  Pago,
  Plazo,
  PreguntaOpcional,
  Publicacion,
  TipoPropiedad,
} from '../../../supabase/functions/consulta-publica/encuesta.ts'

export type { Flujo, Garantia, Operacion, Pago, Plazo, PreguntaOpcional, Publicacion, TipoPropiedad }

export interface RangoPresupuesto {
  codigo: string
  label: string
  /** null = no es un monto ("No sé, quiero una tasación"). */
  moneda: 'USD' | 'ARS' | null
}

export interface PropiedadDisponible {
  disponible: true
  tipo: TipoPropiedad
  finalidad: 'VENTA' | 'ALQUILER' | 'AMBAS' | null
  zona: string | null
  precio: number | null
  moneda: string
  ambientes: number | null
  metros_cuadrados: number | null
  fotos_urls: string[]
}

/** null = link general; `{ disponible: false }` = la propiedad ya no está. */
export type PropiedadDelLink = null | { disponible: false } | PropiedadDisponible

/** Respuesta 200 del GET. */
export interface DatosLink {
  token: string
  link: { slug: string; tipo: 'GENERAL' | 'PROPIEDAD'; preguntas_off: PreguntaOpcional[] }
  flujo: Flujo
  operacion_fija: Operacion | null
  asesor: { nombre: string; apellido: string }
  inmobiliaria: { nombre: string }
  propiedad: PropiedadDelLink
  rangos_presupuesto: Record<Operacion, RangoPresupuesto[]>
}

/** Lo que la persona va contestando. Todo opcional hasta que llega a ese paso. */
export interface Respuestas {
  operacion?: Operacion
  tipo_propiedad?: TipoPropiedad
  zona?: string
  presupuesto?: string
  pago?: Pago
  garantia?: Garantia
  /** Solo propietarios: si ya la tienen publicada. */
  publicada?: Publicacion
  plazo?: Plazo
  visita?: boolean
  vender?: boolean
}

export interface DatosContacto {
  nombre: string
  apellido: string
  telefono: string
  email: string
}

export interface PayloadConsulta {
  token: string
  hp: string
  consentimiento: true
  respuestas: Record<string, string | boolean>
  contacto: { nombre: string; apellido: string; telefono: string; email?: string }
}
