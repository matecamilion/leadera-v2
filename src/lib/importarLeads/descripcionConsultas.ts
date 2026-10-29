/**
 * Arma `leads.descripcion_inicial` a partir de las consultas de una persona.
 *
 * Cada fila del archivo aporta un bloque:
 *
 *     Consulta del 05/03/2026 · ZonaProp
 *     Mensaje: Busco 2 ambientes
 *     Dirección: Colón 1234
 *
 * Una persona con varias filas (misma persona consultando varias propiedades)
 * termina con todos sus bloques ordenados por fecha, separados por `---`. Es
 * lógica pura: no sabe de columnas ni de la base.
 */

/** El tope de la RPC `importar_leads` para la descripción, en caracteres. */
export const MAX_DESCRIPCION = 2000

export const SEPARADOR_CONSULTAS = '\n---\n'

/** El bloque de texto de una fila y la fecha con la que se ordena (null = sin fecha). */
export interface Consulta {
  fecha: Date | null
  /** El bloque entero, con las líneas de la propiedad al final. */
  texto: string
  /**
   * Las líneas de las columnas de detalle (la propiedad), las mismas que cierran
   * `texto`. Sirven para no repetirlas cuando la consulta siguiente es por lo
   * mismo.
   */
  propiedad?: string[]
}

/** Va en lugar de las líneas de la propiedad cuando son idénticas a las de la consulta anterior. */
export const MISMA_PROPIEDAD = 'Misma propiedad que la consulta anterior'

export interface DatoExtra {
  encabezado: string
  valor: string
}

/** Largo en caracteres, como `char_length` de Postgres (un emoji cuenta 1, no 2). */
export function largo(texto: string): number {
  return Array.from(texto).length
}

export function recortar(texto: string, maximo: number): string {
  return Array.from(texto).slice(0, maximo).join('').trimEnd()
}

const dosDigitos = (n: number) => String(n).padStart(2, '0')

/** dd/mm/aaaa en hora local, como se parseó el archivo. */
export function formatearFechaConsulta(fecha: Date): string {
  return `${dosDigitos(fecha.getDate())}/${dosDigitos(fecha.getMonth() + 1)}/${fecha.getFullYear()}`
}

/**
 * El bloque de una fila, o null si no hay nada que guardar.
 *
 * Orden: línea de fecha y origen, "Mensaje: …", y los datos extra en el orden
 * del archivo. La línea de fecha y origen sale solo si hay fecha o hay origen
 * (sin fecha, se omite la fecha). Si lo único que hay es el mensaje, se guarda
 * tal cual, sin rótulo: así un archivo simple de notas queda como siempre.
 */
export function armarConsulta({
  fecha,
  origenOriginal,
  mensaje,
  extras,
}: {
  fecha: Date | null
  origenOriginal: string | null
  mensaje: string | null
  extras: DatoExtra[]
}): Consulta | null {
  const lineas: string[] = []

  if (fecha || origenOriginal) {
    const cabecera = fecha ? `Consulta del ${formatearFechaConsulta(fecha)}` : 'Consulta'
    lineas.push(origenOriginal ? `${cabecera} · ${origenOriginal}` : cabecera)
  }

  if (mensaje) lineas.push(lineas.length > 0 || extras.length > 0 ? `Mensaje: ${mensaje}` : mensaje)
  const propiedad = extras.map(({ encabezado, valor }) => `${encabezado}: ${valor}`)
  lineas.push(...propiedad)

  return lineas.length > 0 ? { fecha, texto: lineas.join('\n'), propiedad } : null
}

export interface DescripcionComponida {
  texto: string | null
  /** Consultas más antiguas que no entraron en los 2000 caracteres. */
  omitidas: number
  /** La consulta más reciente no entraba sola y se cortó al final. */
  recortada: boolean
}

/**
 * Por fecha ascendente; las que no tienen fecha van al final y a igual fecha
 * manda el orden del archivo (el orden de `elementos`).
 */
export function ordenarPorFecha<T>(elementos: T[], fechaDe: (elemento: T) => Date | null): T[] {
  return elementos
    .map((elemento, posicion) => ({ elemento, posicion }))
    .sort((a, b) => {
      const fa = fechaDe(a.elemento)?.getTime()
      const fb = fechaDe(b.elemento)?.getTime()
      if (fa !== undefined && fb !== undefined && fa !== fb) return fa - fb
      if (fa === undefined && fb !== undefined) return 1
      if (fa !== undefined && fb === undefined) return -1
      return a.posicion - b.posicion
    })
    .map(({ elemento }) => elemento)
}

function mismasLineas(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((linea, i) => linea === b[i])
}

/**
 * El texto de una consulta dado cuál es la anterior. Si las líneas de la
 * propiedad son idénticas a las de la anterior, se reemplazan por
 * `MISMA_PROPIEDAD`; si difieren aunque sea en una, o no hay anterior, va entero.
 */
function textoDe(consulta: Consulta, anterior: Consulta | null): string {
  const propiedad = consulta.propiedad ?? []
  if (propiedad.length === 0 || !anterior || !mismasLineas(propiedad, anterior.propiedad ?? [])) {
    return consulta.texto
  }

  // Se corta por el final del texto y no por líneas: un valor puede tener saltos.
  const bloque = propiedad.join('\n')
  if (!consulta.texto.endsWith(bloque)) return consulta.texto
  const base = consulta.texto.slice(0, consulta.texto.length - bloque.length).replace(/\n$/, '')
  return base ? `${base}\n${MISMA_PROPIEDAD}` : MISMA_PROPIEDAD
}

/**
 * Une las consultas ordenadas por fecha y respeta el tope. Una consulta por la
 * misma propiedad que la anterior no la repite. Si no entran todas, descarta las
 * más antiguas hasta que entren (las recientes se guardan completas). Si ni la
 * más reciente entra sola, se corta al final.
 */
export function componerDescripcion(consultas: Consulta[]): DescripcionComponida {
  const ordenadas = ordenarPorFecha(consultas, (c) => c.fecha)
  if (ordenadas.length === 0) return { texto: null, omitidas: 0, recortada: false }

  // La primera que queda lleva la propiedad completa aunque antes de descartar
  // las más antiguas fuera una referencia a otra: por eso se compone por tramo.
  const unirDesde = (desde: number) =>
    ordenadas
      .slice(desde)
      .map((c, i, tramo) => textoDe(c, i > 0 ? tramo[i - 1] : null))
      .join(SEPARADOR_CONSULTAS)

  let desde = 0
  while (desde < ordenadas.length - 1 && largo(unirDesde(desde)) > MAX_DESCRIPCION) desde++

  let texto = unirDesde(desde)
  let recortada = false
  if (largo(texto) > MAX_DESCRIPCION) {
    texto = recortar(texto, MAX_DESCRIPCION)
    recortada = true
  }
  return { texto: texto || null, omitidas: desde, recortada }
}

/** Los avisos por fila que corresponden al resultado de `componerDescripcion`. */
export function avisosDeDescripcion({ omitidas, recortada }: DescripcionComponida): string[] {
  const avisos: string[] = []
  if (omitidas > 0) {
    avisos.push(
      `${omitidas} ${omitidas === 1 ? 'consulta más antigua quedó afuera' : 'consultas más antiguas quedaron afuera'} del detalle: no entraban en ${MAX_DESCRIPCION} caracteres.`,
    )
  }
  if (recortada) {
    avisos.push(`La descripción es muy larga: se guardan los primeros ${MAX_DESCRIPCION} caracteres.`)
  }
  return avisos
}
