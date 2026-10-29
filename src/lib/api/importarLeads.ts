import { supabase } from '../supabase'
import { interpretarErrorSupabase } from '../errores'
import type { Json } from '../../types/database'
import type { FilaConDuplicado } from '../importarLeads/duplicadosEnArchivo'
import type { EstadoImportado, FilaNormalizada } from '../importarLeads/normalizarFilas'
import { esOrigenImportable, type OrigenImportable } from '../importarLeads/origenes'
import { mensajeDeFuncion } from './equipo'

/**
 * Importar leads: verificar duplicados contra la base e insertar.
 *
 * Todo con el JWT del usuario. La atribución (`agente_id`, `asignado_a`,
 * `inmobiliaria_id`) la decide la RPC con `auth.uid()`: acá nunca viaja.
 */

/** Filas por llamada a la RPC. Un lote que falla pierde a lo sumo estas filas. */
export const TAMANO_LOTE = 200

// ---------------------------------------------------------------------------
// Verificar duplicados contra la base (Edge Function)
// ---------------------------------------------------------------------------

export type DuplicadoEnBase = 'telefono' | 'email'

/** Cuántos leads usa la cuenta y cuántos admite su plan (null = sin tope). */
export interface CupoDeLeads {
  limite: number | null
  usados: number
}

export interface VerificacionDeDuplicados {
  duplicados: Map<number, DuplicadoEnBase | null>
  cupo: CupoDeLeads
}

export interface FilaAVerificar {
  fila: number
  telefono: string | null
  email: string | null
}

/** Lo que la función necesita de cada fila: nada más que teléfono y email. */
export function armarPedidoDeVerificacion(filas: FilaNormalizada[]): FilaAVerificar[] {
  return filas.map(({ fila, telefono, email }) => ({ fila, telefono, email }))
}

/**
 * Qué filas ya existen en los leads de la cuenta (de cualquier agente).
 *
 * Devuelve `duplicados`, un mapa fila → cómo coincidió (o null si no existe), y
 * el `cupo` de leads de la cuenta. La función no dice de quién es el lead:
 * solo si hay uno con ese teléfono o ese email.
 *
 * Se llama también sin filas: el cupo se necesita igual.
 */
export async function verificarDuplicados(filas: FilaAVerificar[]): Promise<VerificacionDeDuplicados> {
  const { data, error } = await supabase.functions.invoke<{
    resultados?: { fila: number; duplicado: DuplicadoEnBase | null }[]
    cupo?: { limite?: unknown; usados?: unknown }
  }>('verificar-duplicados-importacion', { body: { filas } })

  if (error) {
    throw new Error(await mensajeDeFuncion(error, 'No se pudo verificar si los leads ya existen.'))
  }
  const cupo = data?.cupo
  if (
    !data ||
    !Array.isArray(data.resultados) ||
    typeof cupo?.usados !== 'number' ||
    (cupo.limite !== null && typeof cupo.limite !== 'number')
  ) {
    throw new Error('No se pudo verificar si los leads ya existen.')
  }

  const duplicados = new Map<number, DuplicadoEnBase | null>()
  for (const r of data.resultados) {
    duplicados.set(r.fila, r.duplicado === 'telefono' || r.duplicado === 'email' ? r.duplicado : null)
  }
  return { duplicados, cupo: { limite: cupo.limite, usados: cupo.usados } }
}

// ---------------------------------------------------------------------------
// Armar el payload de la RPC
// ---------------------------------------------------------------------------

/**
 * Un elemento de `p_filas`. Sin `agente_id`, `asignado_a` ni `inmobiliaria_id`, y
 * sin el id de la importación: ese viaja una vez por llamada (`p_importacion_id`).
 */
export interface FilaParaImportar {
  fila: number
  nombre: string
  apellido?: string
  /** Como lo tipeó la persona, no el normalizado: es lo que se guarda. */
  telefono?: string
  email?: string
  descripcion_inicial?: string
  estado?: EstadoImportado
  /** Solo si el archivo traía origen. Sin él la base usa IMPORTACION. Nunca MANUAL, REFERIDO ni LINK_CONSULTA. */
  origen?: OrigenImportable
  /** ISO. Si el archivo no traía fecha se omite y la base usa la de hoy. */
  fecha_ingreso?: string
  /**
   * ISO, con la misma convención que `fecha_ingreso`. Contacto real cargado desde
   * "Respondido el". Si solo una sirve la base toma esa para las dos; una que no
   * sirve (futura, anterior a la fecha de ingreso) se descarta sin fallar la fila.
   */
  fecha_primer_contacto_real?: string
  fecha_ultimo_contacto_real?: string
}

/**
 * De las filas normalizadas al formato de la RPC.
 *
 * Los campos vacíos se omiten: para la RPC ausente y null son lo mismo. No
 * filtra nada —qué filas se importan lo decide `clasificarFilas`—.
 */
export function armarPayload(filas: FilaNormalizada[]): FilaParaImportar[] {
  return filas.map((f) => {
    const fila: FilaParaImportar = { fila: f.fila, nombre: f.nombre }
    if (f.apellido) fila.apellido = f.apellido
    if (f.telefono) fila.telefono = f.telefono
    if (f.email) fila.email = f.email
    if (f.descripcion) fila.descripcion_inicial = f.descripcion
    if (f.estado) fila.estado = f.estado
    // La RPC rechaza los orígenes vedados fila por fila: acá ni se mandan.
    if (f.origen && esOrigenImportable(f.origen)) fila.origen = f.origen
    if (f.fechaIngreso) fila.fecha_ingreso = f.fechaIngreso.toISOString()
    if (f.primerContacto) fila.fecha_primer_contacto_real = f.primerContacto.toISOString()
    if (f.ultimoContacto) fila.fecha_ultimo_contacto_real = f.ultimoContacto.toISOString()
    return fila
  })
}

// ---------------------------------------------------------------------------
// Qué se importa y qué se omite
// ---------------------------------------------------------------------------

export interface ClasificacionDeFilas {
  aImportar: FilaConDuplicado[]
  /** Repiten teléfono o email de una fila anterior del mismo archivo. */
  duplicadasEnArchivo: FilaConDuplicado[]
  /** Ya existen en la base (de cualquier agente de la cuenta). */
  duplicadasEnBase: { porTelefono: FilaConDuplicado[]; porEmail: FilaConDuplicado[] }
  /** Con un error bloqueante (hoy, sin nombre). */
  conError: FilaConDuplicado[]
  conteos: {
    total: number
    aImportar: number
    duplicadasEnArchivo: number
    duplicadasEnBasePorTelefono: number
    duplicadasEnBasePorEmail: number
    conError: number
  }
}

/**
 * Reparte las filas para la pantalla de confirmación. Cada fila cae en una sola
 * categoría, con este orden de prioridad: error, duplicada en el archivo,
 * duplicada en la base.
 *
 * Una fila que no está en `duplicadosEnBase` (la función no la evaluó) se
 * trata como no duplicada.
 */
export function clasificarFilas(
  filas: FilaConDuplicado[],
  duplicadosEnBase: Map<number, DuplicadoEnBase | null>,
): ClasificacionDeFilas {
  const resultado: ClasificacionDeFilas = {
    aImportar: [],
    duplicadasEnArchivo: [],
    duplicadasEnBase: { porTelefono: [], porEmail: [] },
    conError: [],
    conteos: {
      total: filas.length,
      aImportar: 0,
      duplicadasEnArchivo: 0,
      duplicadasEnBasePorTelefono: 0,
      duplicadasEnBasePorEmail: 0,
      conError: 0,
    },
  }

  for (const fila of filas) {
    const enBase = duplicadosEnBase.get(fila.fila) ?? null

    if (fila.errores.length > 0) resultado.conError.push(fila)
    else if (fila.duplicadoEnArchivo) resultado.duplicadasEnArchivo.push(fila)
    else if (enBase === 'telefono') resultado.duplicadasEnBase.porTelefono.push(fila)
    else if (enBase === 'email') resultado.duplicadasEnBase.porEmail.push(fila)
    else resultado.aImportar.push(fila)
  }

  resultado.conteos.aImportar = resultado.aImportar.length
  resultado.conteos.duplicadasEnArchivo = resultado.duplicadasEnArchivo.length
  resultado.conteos.duplicadasEnBasePorTelefono = resultado.duplicadasEnBase.porTelefono.length
  resultado.conteos.duplicadasEnBasePorEmail = resultado.duplicadasEnBase.porEmail.length
  resultado.conteos.conError = resultado.conError.length

  return resultado
}

// ---------------------------------------------------------------------------
// Importar (RPC importar_leads, por lotes)
// ---------------------------------------------------------------------------

export type ResultadoDeFila = 'OK' | 'EMAIL_DUPLICADO' | 'LIMITE_ALCANZADO' | 'ERROR'

export interface ResultadoImportacionDeFila {
  fila: number
  resultado: ResultadoDeFila
  mensaje?: string
}

export interface CorteDeImportacion {
  mensaje: string
  /**
   * Números de fila que no se procesaron: el lote que falló y todos los que
   * seguían. De las del lote que falló no se sabe: si el error fue de red, el
   * servidor pudo haberlas guardado antes de que se perdiera la respuesta.
   */
  filasSinProcesar: number[]
}

export interface ResultadoDeImportacion {
  insertados: number
  resultados: ResultadoImportacionDeFila[]
  /** null si se procesó todo. Un corte no lanza: lo que entró se informa igual. */
  corte: CorteDeImportacion | null
  /** El id con el que quedaron marcados los leads de esta importación (`leads.importacion_id`). */
  importacionId?: string
}

export interface OpcionesDeImportacion {
  /** Se llama después de cada lote, con las filas ya resueltas y el total. */
  onProgreso?: (procesadas: number, total: number) => void
  /**
   * El id de la importación. Si no viene se genera uno acá: una sola vez por
   * llamada a `importarLeads`, el mismo para todos los lotes. Reintentar una
   * importación cortada es otra importación, con otro id.
   */
  importacionId?: string
}

const RESULTADOS_VALIDOS: ResultadoDeFila[] = ['OK', 'EMAIL_DUPLICADO', 'LIMITE_ALCANZADO', 'ERROR']

/** Lo que devolvió la RPC, o null si no tiene la forma del contrato. */
function leerRespuestaDeLote(data: Json | null): ResultadoImportacionDeFila[] | null {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null
  const resultados = data.resultados
  if (!Array.isArray(resultados)) return null

  const salida: ResultadoImportacionDeFila[] = []
  for (const r of resultados) {
    if (typeof r !== 'object' || r === null || Array.isArray(r)) return null
    const { fila, resultado, mensaje } = r
    if (typeof fila !== 'number') return null
    if (!RESULTADOS_VALIDOS.includes(resultado as ResultadoDeFila)) return null
    salida.push({
      fila,
      resultado: resultado as ResultadoDeFila,
      ...(typeof mensaje === 'string' ? { mensaje } : {}),
    })
  }
  return salida
}

async function importarLote(
  lote: FilaParaImportar[],
  importacionId: string,
): Promise<ResultadoImportacionDeFila[]> {
  // `FilaParaImportar` es una interfaz sin firma de índice: no encaja en `Json`.
  const { data, error } = await supabase.rpc('importar_leads', {
    p_filas: lote as unknown as Json,
    p_importacion_id: importacionId,
  })

  if (error) throw new Error(interpretarErrorSupabase(error, 'No se pudo importar el lote.'))

  const resultados = leerRespuestaDeLote(data)
  if (!resultados) throw new Error('La importación devolvió una respuesta inesperada.')
  return resultados
}

/**
 * Importa en lotes de `TAMANO_LOTE`, en secuencia.
 *
 * - Si un lote informa `LIMITE_ALCANZADO`, no se mandan los siguientes: sus
 *   filas se marcan `LIMITE_ALCANZADO` acá, sin llamar a la base.
 * - Si una llamada falla (red, servidor, sesión), se corta y se devuelve lo
 *   acumulado con el `corte`. No lanza: la pantalla tiene que poder mostrar lo
 *   que sí entró.
 */
export async function importarLeads(
  filas: FilaParaImportar[],
  { onProgreso, importacionId = globalThis.crypto.randomUUID() }: OpcionesDeImportacion = {},
): Promise<ResultadoDeImportacion> {
  const total = filas.length
  const resultados: ResultadoImportacionDeFila[] = []
  let insertados = 0
  let procesadas = 0

  for (let desde = 0; desde < total; desde += TAMANO_LOTE) {
    const lote = filas.slice(desde, desde + TAMANO_LOTE)

    let delLote: ResultadoImportacionDeFila[]
    try {
      delLote = await importarLote(lote, importacionId)
    } catch (e) {
      const motivo = e instanceof Error ? e.message : 'No se pudo importar el lote.'
      return {
        insertados,
        resultados,
        corte: {
          mensaje: `${motivo} Se interrumpió la importación.`,
          filasSinProcesar: filas.slice(desde).map((f) => f.fila),
        },
        importacionId,
      }
    }

    // Una fila sin respuesta no se da por buena: se avisa como error suya.
    const respondidas = new Set(delLote.map((r) => r.fila))
    for (const f of lote) {
      if (!respondidas.has(f.fila)) {
        delLote.push({ fila: f.fila, resultado: 'ERROR', mensaje: 'No recibimos respuesta para esta fila.' })
      }
    }

    resultados.push(...delLote)
    insertados += delLote.filter((r) => r.resultado === 'OK').length
    procesadas += lote.length
    onProgreso?.(procesadas, total)

    if (delLote.some((r) => r.resultado === 'LIMITE_ALCANZADO')) {
      const restantes = filas.slice(desde + TAMANO_LOTE)
      for (const f of restantes) resultados.push({ fila: f.fila, resultado: 'LIMITE_ALCANZADO' })
      if (restantes.length > 0) onProgreso?.(total, total)
      break
    }
  }

  return { insertados, resultados, corte: null, importacionId }
}
