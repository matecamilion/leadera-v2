import { esMoneda, MONEDA_POR_DEFECTO, type Moneda } from './moneda'

/**
 * Los pasos del trámite entre el acuerdo y la escritura, en el orden en que se
 * van dando.
 *
 * Las claves son las del CHECK de `operacion_tramite_pasos.paso`: si se agrega o
 * se renombra una, cambian las dos puntas.
 */
export const PASOS_TRAMITE = [
  { clave: 'PRESUPUESTOS_PEDIDOS', etiqueta: 'Presupuestos de escribanías pedidos' },
  { clave: 'ESCRIBANIA_ELEGIDA', etiqueta: 'Escribanía elegida' },
  { clave: 'DOCUMENTACION_ENVIADA', etiqueta: 'Documentación enviada a la escribanía' },
  {
    clave: 'CERTIFICADOS_PEDIDOS',
    etiqueta: 'Certificados pedidos (dominio, inhibición, cédula catastral)',
  },
  { clave: 'CERTIFICADOS_RECIBIDOS', etiqueta: 'Certificados recibidos y vendedores aptos' },
  { clave: 'ESCRITURA', etiqueta: 'Escritura' },
] as const

export type PasoTramite = (typeof PASOS_TRAMITE)[number]['clave']

/**
 * Lo mínimo que estos helpers miran de una fila de `operacion_tramite_pasos`.
 *
 * Un paso sin fila es un paso pendiente: la tabla solo guarda los que alguien
 * tocó. `paso` viene como `string` porque así lo devuelve la base (es `text`).
 */
export interface FilaPasoTramite {
  paso: string
  fecha_completado: string | null
  no_aplica: boolean
}

/** Un paso está resuelto si se completó o si se marcó que no aplica. */
function estaResuelto(fila: FilaPasoTramite | undefined): boolean {
  return !!fila && (fila.fecha_completado !== null || fila.no_aplica)
}

function filaDe(filas: FilaPasoTramite[], paso: PasoTramite): FilaPasoTramite | undefined {
  return filas.find((f) => f.paso === paso)
}

/** Los pasos que todavía no se resolvieron, en el orden del trámite. */
export function pasosFaltantes(filas: FilaPasoTramite[]): PasoTramite[] {
  return PASOS_TRAMITE.filter((p) => !estaResuelto(filaDe(filas, p.clave))).map((p) => p.clave)
}

/** Cuántos pasos están resueltos, completados o no aplica. */
export function pasosResueltos(filas: FilaPasoTramite[]): number {
  return PASOS_TRAMITE.length - pasosFaltantes(filas).length
}

/** El primer paso sin resolver, o `null` si no queda ninguno. */
export function siguientePaso(filas: FilaPasoTramite[]): PasoTramite | null {
  return pasosFaltantes(filas)[0] ?? null
}

/**
 * ¿Ya se firmó la escritura?
 *
 * Pide la fecha y no alcanza con "resuelta": marcar la escritura como "no
 * aplica" no es haberla hecho, y de esto cuelgan las tareas de postventa.
 */
export function escrituraHecha(filas: FilaPasoTramite[]): boolean {
  return filaDe(filas, 'ESCRITURA')?.fecha_completado != null
}

/** `DD/MM` de una fecha `YYYY-MM-DD`, sin pasar por `Date` (que la correría por la zona). */
export function formatearDiaMes(fecha: string): string {
  const [, mes, dia] = fecha.split('-')
  return `${dia}/${mes}`
}

/**
 * La línea de estado del encabezado: lo que ya pasó con la escritura o, si no,
 * lo que viene. Si no queda nada por hacer y la escritura no se firmó (se marcó
 * "no aplica"), el trámite está completo igual.
 */
export function textoEstadoTramite(filas: FilaPasoTramite[]): string {
  const escritura = filaDe(filas, 'ESCRITURA')
  if (escritura?.fecha_completado) {
    return `Escritura realizada el ${formatearDiaMes(escritura.fecha_completado)}`
  }
  const siguiente = siguientePaso(filas)
  if (!siguiente) return 'Trámite completo'
  const etiqueta = PASOS_TRAMITE.find((p) => p.clave === siguiente)?.etiqueta
  return `Siguiente: ${etiqueta}`
}

/**
 * La fecha con la que arranca el diálogo de la escritura: la prevista si ya
 * llegó (es de hoy o anterior), y si no, hoy. Una prevista futura no sirve de
 * punto de partida, porque la escritura no puede marcarse en el futuro.
 */
export function fechaInicialEscritura(fechaPrevista: string | null, hoy: string): string {
  return fechaPrevista && fechaPrevista <= hoy ? fechaPrevista : hoy
}

// ---------------------------------------------------------------------------
// Escribanía elegida y su presupuesto
//
// Viven en la fila del paso ESCRIBANIA_ELEGIDA de `operacion_tramite_pasos`
// (columnas `escribania_nombre`, `presupuesto_monto`, `presupuesto_moneda`).
// Cargarlos NO completa el paso: la fila puede tener datos y
// `fecha_completado` nula, y `estaResuelto` solo mira la fecha y `no_aplica`.
// ---------------------------------------------------------------------------

/** Tope del nombre: el mismo CHECK de la base. */
export const MAX_NOMBRE_ESCRIBANIA = 200

/** Tope del monto: `numeric(14,2)` admite hasta 12 dígitos enteros. */
const TOPE_MONTO = 1_000_000_000_000

export const MENSAJE_FORMATO_MONTO =
  'Escribí el monto con punto para los miles y coma para los decimales (por ejemplo 1.500 o 1.500,50).'

/** Lo que se guarda de la escribanía. Las tres siempre presentes: `null` si no hay valor. */
export interface DatosEscribania {
  escribania_nombre: string | null
  presupuesto_monto: number | null
  presupuesto_moneda: Moneda | null
}

export interface EntradaEscribania {
  nombre: string | null | undefined
  /** Lo que escribió la persona (texto) o un monto ya guardado (número). */
  monto: string | number | null | undefined
  moneda: string | null | undefined
}

export type ResultadoEscribania =
  | { ok: true; datos: DatosEscribania }
  | { ok: false; errores: { nombre?: string; monto?: string; moneda?: string } }

type ResultadoMonto = { ok: true; monto: number | null } | { ok: false; error: string }

/**
 * Interpreta un monto escrito a la argentina: el punto separa los miles y la
 * coma los decimales ("1.500" es 1500, "1.500,50" es 1500,5).
 *
 * Un solo punto seguido de 1 o 2 dígitos ("1500.5") se rechaza en vez de
 * adivinarlo: se lee igual que un decimal anglosajón y que "mil quinientos", y
 * equivocarse en un presupuesto es peor que pedir que se reescriba.
 * Vacío es "sin monto" y no es un error.
 */
export function parsearMonto(texto: string): ResultadoMonto {
  const limpio = texto.replace(/\s+/g, '')
  if (limpio === '') return { ok: true, monto: null }
  if (limpio.startsWith('-')) return { ok: false, error: 'El monto no puede ser negativo.' }

  // Miles con punto (grupos de 3) o sin separar; decimales opcionales con coma.
  const valido = /^(\d{1,3}(\.\d{3})+|\d+)(,\d+)?$/.test(limpio)
  if (!valido) return { ok: false, error: MENSAJE_FORMATO_MONTO }

  const [enteros, decimales = ''] = limpio.split(',')
  if (decimales.length > 2) return { ok: false, error: 'El monto admite hasta 2 decimales.' }

  const monto = Number(`${enteros.replace(/\./g, '')}${decimales ? `.${decimales}` : ''}`)
  if (!Number.isFinite(monto) || monto >= TOPE_MONTO) {
    return { ok: false, error: 'El monto es demasiado grande.' }
  }
  return { ok: true, monto }
}

function interpretarMonto(monto: EntradaEscribania['monto']): ResultadoMonto {
  if (monto === null || monto === undefined) return { ok: true, monto: null }
  if (typeof monto === 'number') {
    if (!Number.isFinite(monto) || monto < 0) {
      return { ok: false, error: 'El monto tiene que ser un número de 0 o más.' }
    }
    return monto >= TOPE_MONTO
      ? { ok: false, error: 'El monto es demasiado grande.' }
      : { ok: true, monto }
  }
  return parsearMonto(monto)
}

/**
 * Deja los datos de la escribanía listos para guardar.
 *
 *  - Nombre: sin espacios de los costados; vacío es `null`; hasta 200 caracteres.
 *  - Monto: ver `parsearMonto`. Sin monto, la moneda es `null`.
 *  - Con monto, la moneda NUNCA es `null` ni `undefined` (la base lo rechaza):
 *    si no se eligió, USD. Una moneda que no sea USD ni ARS es un error.
 *
 * Las tres propiedades del resultado siempre existen y valen `null` cuando no
 * hay dato, para que borrar un campo sea mandar `null` y no omitirlo.
 */
export function normalizarDatosEscribania(entrada: EntradaEscribania): ResultadoEscribania {
  const errores: { nombre?: string; monto?: string; moneda?: string } = {}

  const nombreLimpio = (entrada.nombre ?? '').trim()
  if (nombreLimpio.length > MAX_NOMBRE_ESCRIBANIA) {
    errores.nombre = `El nombre admite hasta ${MAX_NOMBRE_ESCRIBANIA} caracteres.`
  }

  const monto = interpretarMonto(entrada.monto)
  if (!monto.ok) errores.monto = monto.error

  let moneda: Moneda = MONEDA_POR_DEFECTO
  if (entrada.moneda !== null && entrada.moneda !== undefined && entrada.moneda !== '') {
    if (esMoneda(entrada.moneda)) moneda = entrada.moneda
    else errores.moneda = 'La moneda tiene que ser USD o ARS.'
  }

  if (errores.nombre || errores.monto || errores.moneda || !monto.ok) {
    return { ok: false, errores }
  }

  return {
    ok: true,
    datos: {
      escribania_nombre: nombreLimpio === '' ? null : nombreLimpio,
      presupuesto_monto: monto.monto,
      presupuesto_moneda: monto.monto === null ? null : moneda,
    },
  }
}

/**
 * El monto para leerlo: "USD 1.500" o, si tiene centavos, "USD 1.500,50".
 *
 * Es el mismo formato de `formatearMonto`, con una diferencia: ese redondea a
 * 0 decimales, y acá un 1500,5 que se guarda tal cual no puede leerse "1.501".
 */
export function formatearPresupuesto(monto: number, moneda: string): string {
  const decimales = Number.isInteger(monto) ? 0 : 2
  const numero = new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(monto)
  return `${moneda} ${numero}`
}
