import { supabase } from '../supabase'
import { interpretarErrorSupabase } from '../errores'
import type { Database } from '../../types/database'

/**
 * Modelo de gestión: el flag por inmobiliaria y el resumen de la semana.
 *
 * Todo lo del modelo va detrás de `inmobiliarias.modelo_gestion_activo`, que
 * nace en false: ninguna cuenta ve nada hasta que se prende a mano.
 */

export type ResumenGestion =
  Database['public']['Functions']['resumen_gestion']['Returns'][number]

/**
 * Las ventanas que pide el front. La función SQL acepta además 'mes', que va a
 * ir en Estadísticas; `database.ts` tipa `p_periodo` como string suelto, así
 * que la unión se declara acá.
 */
export type PeriodoGestion = 'dia' | 'semana'

/**
 * Si la inmobiliaria tiene el modelo de gestión prendido.
 *
 * Filtra por id y no confía en que la RLS devuelva una sola fila: el
 * superadmin ve todas las inmobiliarias, y un `maybeSingle()` sin filtro le
 * daría error por filas de más.
 *
 * Nunca tira: ante un error o sin fila devuelve false. Es un flag de una
 * funcionalidad opcional, y que no se pueda leer no puede romper Mi día.
 */
export async function obtenerModeloGestionActivo(inmobiliariaId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('inmobiliarias')
    .select('modelo_gestion_activo')
    .eq('id', inmobiliariaId)
    .maybeSingle()

  if (error) {
    console.error('No se pudo leer el flag del modelo de gestión', error)
    return false
  }

  return data?.modelo_gestion_activo === true
}

/**
 * Las métricas del agente logueado en el día o la semana (miércoles a martes)
 * que contiene `referencia`, hora argentina. La ventana, `dia_actual` y los
 * conteos los arma la base; ver `20260930160000_detalle_gestion`.
 *
 * Sin `referencia` no se manda `p_referencia`: "hoy" lo decide el reloj de la
 * base, no el del navegador, que puede estar corrido.
 */
export async function obtenerResumenGestion(
  periodo: PeriodoGestion,
  referencia: string | null = null,
): Promise<ResumenGestion> {
  const mensaje =
    periodo === 'dia' ? 'No se pudo cargar el resumen del día.' : 'No se pudo cargar el resumen de la semana.'

  const { data, error } = await supabase.rpc('resumen_gestion', {
    p_periodo: periodo,
    ...(referencia ? { p_referencia: referencia } : {}),
  })

  if (error) throw new Error(interpretarErrorSupabase(error, mensaje))

  const fila = data?.[0]
  if (!fila) throw new Error(mensaje)

  return fila
}

/** Qué anillo se detalla: 'pre' junta prelistings y prebuyings, como el anillo. */
export type MetricaGestion = 'verdes' | 'pre' | 'nuevos'

/**
 * Una fila del detalle.
 *
 * Declarada acá y no derivada de `database.ts`: el generador tipa las columnas
 * de una función como no nulas, y acá casi todas pueden venir en null. Las de
 * lead y propiedad, además, llegan en null cuando la RLS no deja leerlas: la
 * fila igual cuenta en el anillo y se muestra igual.
 */
export interface FilaDetalleGestion {
  fuente: 'interaccion' | 'visita' | 'lead'
  id: string
  /** `YYYY-MM-DD` en hora argentina. Se parsea con `desdeClaveDia`. */
  dia: string
  /** Interacciones y leads. Null en visitas. */
  momento: string | null
  /** Sólo visitas, `HH:MM:SS`; puede faltar. */
  hora: string | null
  tipo: string | null
  categoria: string | null
  detalle: string | null
  lead_id: string | null
  lead_nombre: string | null
  lead_apellido: string | null
  lead_estado: string | null
  lead_origen: string | null
  propiedad_id: string | null
  propiedad_direccion: string | null
  propiedad_zona: string | null
}

export interface DetalleGestion {
  filas: FilaDetalleGestion[]
  /** El total antes del límite de 500: si es mayor que `filas.length`, se cortó. */
  total: number
}

/**
 * Lo que suma a una métrica en el período. Sale de la misma fuente de filas que
 * `resumen_gestion`, así que la lista coincide con el número del anillo.
 */
export async function obtenerDetalleGestion(
  metrica: MetricaGestion,
  periodo: PeriodoGestion,
  referencia: string | null = null,
): Promise<DetalleGestion> {
  const { data, error } = await supabase.rpc('detalle_gestion', {
    p_metrica: metrica,
    p_periodo: periodo,
    ...(referencia ? { p_referencia: referencia } : {}),
  })

  if (error) throw new Error(interpretarErrorSupabase(error, 'No se pudo cargar el detalle.'))

  const filas = (data ?? []).map(
    (f): FilaDetalleGestion => ({
      fuente: f.fuente as FilaDetalleGestion['fuente'],
      id: f.id,
      dia: f.dia,
      momento: f.momento,
      hora: f.hora,
      tipo: f.tipo,
      categoria: f.categoria,
      detalle: f.detalle,
      lead_id: f.lead_id,
      lead_nombre: f.lead_nombre,
      lead_apellido: f.lead_apellido,
      lead_estado: f.lead_estado,
      lead_origen: f.lead_origen,
      propiedad_id: f.propiedad_id,
      propiedad_direccion: f.propiedad_direccion,
      propiedad_zona: f.propiedad_zona,
    }),
  )

  return { filas, total: data?.[0]?.total_filas ?? 0 }
}
