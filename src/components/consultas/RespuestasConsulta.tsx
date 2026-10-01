import { rangoPorCodigo } from '../../../supabase/functions/consulta-publica/encuesta.ts'
import {
  ETIQUETA_TIPO,
  OPCIONES_GARANTIA,
  OPCIONES_PAGO,
  OPCIONES_PLAZO,
  OPCIONES_PRESUPUESTO_PROPIEDAD,
  type Opcion,
} from '../consulta-publica/catalogo'
import type { Operacion, TipoPropiedad } from '../consulta-publica/tipos'

/**
 * Las respuestas de la encuesta, legibles.
 *
 * Mismas etiquetas que vio quien consultó (`consulta-publica/catalogo.ts`) y
 * los mismos rangos que mandó la edge function (`encuesta.ts`): el agente lee
 * lo mismo que se contestó, no una traducción aparte.
 */

type Respuestas = {
  flujo?: 'GENERAL' | 'PROPIEDAD'
  operacion?: Operacion
  tipo_propiedad?: TipoPropiedad | null
  zona?: string | null
  presupuesto?: string | null
  pago?: string | null
  garantia?: string | null
  plazo?: string
  visita?: boolean | null
  vender?: boolean | null
}

function etiqueta<T extends string>(opciones: Opcion<T>[], valor: string | null | undefined) {
  return opciones.find((o) => o.valor === valor)?.label ?? valor ?? null
}

function siNo(valor: boolean | null | undefined): string | null {
  if (valor === null || valor === undefined) return null
  return valor ? 'Sí' : 'No'
}

function filasRespuestas(crudo: unknown): { label: string; valor: string }[] {
  const r = (crudo ?? {}) as Respuestas
  const filas: { label: string; valor: string | null }[] = []

  // Mismas palabras que el resumen del lead ("Operación: Compra"), no las de
  // la encuesta ("Comprar"), que le hablan a quien consulta.
  if (r.operacion) filas.push({ label: 'Operación', valor: r.operacion === 'COMPRA' ? 'Compra' : 'Alquiler' })

  if (r.flujo !== 'PROPIEDAD' && r.tipo_propiedad) {
    filas.push({
      label: 'Propiedad',
      valor: `${ETIQUETA_TIPO[r.tipo_propiedad]}${r.zona ? ` en ${r.zona}` : ''}`,
    })
  }

  const presupuesto = !r.presupuesto
    ? 'No lo contestó'
    : r.flujo === 'PROPIEDAD'
      ? etiqueta(OPCIONES_PRESUPUESTO_PROPIEDAD, r.presupuesto)
      : (r.operacion && rangoPorCodigo(r.operacion, r.presupuesto)?.label) || r.presupuesto
  filas.push({ label: 'Presupuesto', valor: presupuesto })

  if (r.pago) filas.push({ label: 'Pago', valor: etiqueta(OPCIONES_PAGO, r.pago) })
  if (r.garantia) filas.push({ label: 'Garantía', valor: etiqueta(OPCIONES_GARANTIA, r.garantia) })
  if (r.plazo) filas.push({ label: 'Plazo', valor: etiqueta(OPCIONES_PLAZO, r.plazo) })
  filas.push({ label: 'Visita', valor: siNo(r.visita) })
  filas.push({ label: 'Para vender', valor: siNo(r.vender) })

  return filas.filter((f): f is { label: string; valor: string } => f.valor !== null)
}

export function RespuestasConsulta({ respuestas }: { respuestas: unknown }) {
  const filas = filasRespuestas(respuestas)
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[0.82rem]">
      {filas.map((f) => (
        <div key={f.label} className="contents">
          <dt className="text-ink-3">{f.label}</dt>
          <dd className="m-0 min-w-0 font-medium text-ink-2">{f.valor}</dd>
        </div>
      ))}
    </dl>
  )
}

const ESTILO_TEMPERATURA = {
  CALIENTE: 'bg-badge-caliente-bg text-caliente',
  TIBIO: 'bg-badge-tibio-bg text-badge-tibio-ink',
  FRIO: 'bg-badge-frio-bg text-frio',
} as const

const NOMBRE_TEMPERATURA = { CALIENTE: 'Caliente', TIBIO: 'Tibia', FRIO: 'Fría' } as const

/** "Caliente · 85 pts": la calificación de la encuesta, no el estado del lead. */
export function BadgeTemperatura({ temperatura, puntaje }: { temperatura: string; puntaje: number }) {
  const t = (temperatura in ESTILO_TEMPERATURA ? temperatura : 'FRIO') as keyof typeof ESTILO_TEMPERATURA
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[0.72rem] font-bold whitespace-nowrap ${ESTILO_TEMPERATURA[t]}`}
    >
      {NOMBRE_TEMPERATURA[t]} · {puntaje} pts
    </span>
  )
}

const ESTILO_CHIP = {
  volvio: 'bg-cool-soft text-info',
  captacion: 'bg-brand-soft text-primary-dark',
  duplicado: 'bg-warm-soft text-badge-tibio-ink',
  neutro: 'bg-surface-2 text-ink-3',
} as const

export function Chip({
  tono,
  titulo,
  children,
}: {
  tono: keyof typeof ESTILO_CHIP
  titulo?: string
  children: React.ReactNode
}) {
  return (
    <span
      title={titulo}
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.72rem] font-semibold whitespace-nowrap ${ESTILO_CHIP[tono]}`}
    >
      {children}
    </span>
  )
}
