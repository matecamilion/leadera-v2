/**
 * Lectura de un .xlsx o .csv a una grilla de texto.
 *
 * Solo lee: no sabe qué columna es qué (eso es `mapeoColumnas`) ni valida
 * nada. Devuelve cada celda como string trimmeado o null, así lo que sigue
 * trabaja con un solo tipo sin importar de dónde vino el archivo.
 */

export const MAX_BYTES_ARCHIVO = 5 * 1024 * 1024
export const MAX_FILAS_ARCHIVO = 2000

/** Error pensado para mostrarse tal cual al usuario. */
export class ErrorArchivoImportacion extends Error {
  constructor(mensaje: string) {
    super(mensaje)
    this.name = 'ErrorArchivoImportacion'
  }
}

/** Una fila con datos, con el número que tiene en la planilla. */
export interface FilaCruda {
  /** Número de fila tal como lo vería el usuario en Excel (1 = primera). */
  numeroFilaOriginal: number
  /** Por índice de columna (0 = primera). Las celdas vacías son null. */
  celdas: Record<number, string | null>
}

export interface ArchivoLeido {
  /** Nombre de la hoja usada; null en un CSV. */
  hoja: string | null
  /** Uno por columna, en orden. Un encabezado vacío queda como ''. */
  encabezados: string[]
  filas: FilaCruda[]
}

/** Lo que de un `File` hace falta para leerlo: facilita probar sin DOM. */
export interface ArchivoEntrada {
  name: string
  size: number
  arrayBuffer: () => Promise<ArrayBuffer>
}

export async function leerArchivo(archivo: ArchivoEntrada): Promise<ArchivoLeido> {
  validarTipoYTamano(archivo.name, archivo.size)
  return leerBytes(archivo.name, await archivo.arrayBuffer())
}

/** Igual que `leerArchivo` pero sobre los bytes ya leídos. */
export async function leerBytes(nombre: string, bytes: ArrayBuffer): Promise<ArchivoLeido> {
  const extension = validarTipoYTamano(nombre, bytes.byteLength)
  return extension === 'xlsx' ? leerXlsx(bytes) : leerCsv(bytes)
}

function validarTipoYTamano(nombre: string, tamano: number): 'xlsx' | 'csv' {
  const extension = nombre.toLowerCase().split('.').pop()
  if (extension === 'xls') {
    throw new ErrorArchivoImportacion('El formato .xls es muy viejo. Guardalo como .xlsx o .csv.')
  }
  if (extension !== 'xlsx' && extension !== 'csv') {
    throw new ErrorArchivoImportacion('El archivo tiene que ser un Excel (.xlsx) o un CSV (.csv).')
  }
  if (tamano === 0) throw new ErrorArchivoImportacion('El archivo está vacío.')
  if (tamano > MAX_BYTES_ARCHIVO) {
    throw new ErrorArchivoImportacion('El archivo pesa más de 5 MB. Dividilo en partes más chicas.')
  }
  return extension
}

// ---------------------------------------------------------------------------
// Celdas
// ---------------------------------------------------------------------------

function dosDigitos(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * Una fecha de Excel como texto `dd/mm/aaaa hh:mm`.
 *
 * ExcelJS arma el `Date` con la hora de pared de la celda en componentes UTC
 * (una celda de Excel no tiene zona), así que se lee en UTC para no correr la
 * hora. `normalizarFilas` lo parsea de vuelta como hora local.
 */
function fechaComoTexto(fecha: Date): string | null {
  if (Number.isNaN(fecha.getTime())) return null
  const dia = `${dosDigitos(fecha.getUTCDate())}/${dosDigitos(fecha.getUTCMonth() + 1)}/${fecha.getUTCFullYear()}`
  const horas = fecha.getUTCHours()
  const minutos = fecha.getUTCMinutes()
  return horas === 0 && minutos === 0 ? dia : `${dia} ${dosDigitos(horas)}:${dosDigitos(minutos)}`
}

/**
 * El valor de una celda de ExcelJS como string trimmeado, o null si no tiene
 * nada. Cubre lo que ExcelJS devuelve además de texto y números:
 * hipervínculos `{ text, hyperlink }`, texto con formato `{ richText }`,
 * fórmulas `{ formula, result }`, fechas y errores (`#N/A`).
 */
export function valorDeCelda(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null

  if (typeof valor === 'string') return valor.trim() || null

  if (typeof valor === 'number') {
    // Un teléfono guardado como número no puede salir con decimales ni en
    // notación científica; `toFixed` evita lo segundo.
    return Number.isInteger(valor) ? valor.toFixed(0) : String(valor)
  }

  if (typeof valor === 'boolean') return valor ? 'true' : 'false'

  if (valor instanceof Date) return fechaComoTexto(valor)

  if (typeof valor === 'object') {
    const objeto = valor as Record<string, unknown>

    if ('error' in objeto) return null

    if (Array.isArray(objeto.richText)) {
      const texto = objeto.richText
        .map((tramo) => (tramo as { text?: unknown }).text)
        .filter((t): t is string => typeof t === 'string')
        .join('')
      return texto.trim() || null
    }

    // Fórmula: interesa lo que muestra, no lo que calcula.
    if ('formula' in objeto || 'sharedFormula' in objeto) return valorDeCelda(objeto.result)

    if ('hyperlink' in objeto || 'text' in objeto) {
      const texto = valorDeCelda(objeto.text)
      if (texto) return texto
      const enlace = typeof objeto.hyperlink === 'string' ? objeto.hyperlink : ''
      return enlace.replace(/^mailto:/i, '').trim() || null
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// Grilla -> ArchivoLeido
// ---------------------------------------------------------------------------

interface FilaEnBruto {
  numero: number
  celdas: Map<number, string>
}

/**
 * La primera fila con datos son los encabezados; el resto, las filas. Las filas
 * sin una sola celda con contenido se ignoran.
 */
function armarArchivo(hoja: string | null, enBruto: FilaEnBruto[]): ArchivoLeido {
  const [filaEncabezados, ...datos] = enBruto
  if (!filaEncabezados) throw new ErrorArchivoImportacion('El archivo no tiene datos.')
  if (datos.length === 0) {
    throw new ErrorArchivoImportacion(
      'El archivo solo tiene la fila de encabezados: no hay leads para importar.',
    )
  }
  if (datos.length > MAX_FILAS_ARCHIVO) {
    throw new ErrorArchivoImportacion(
      `El archivo tiene ${datos.length.toLocaleString('es-AR')} filas y el máximo es ${MAX_FILAS_ARCHIVO.toLocaleString('es-AR')}. Dividilo en partes.`,
    )
  }

  let ancho = 0
  for (const fila of enBruto) for (const columna of fila.celdas.keys()) ancho = Math.max(ancho, columna + 1)

  const encabezados = Array.from({ length: ancho }, (_, i) => filaEncabezados.celdas.get(i) ?? '')

  const filas = datos.map<FilaCruda>((fila) => {
    const celdas: Record<number, string | null> = {}
    for (let i = 0; i < ancho; i++) celdas[i] = fila.celdas.get(i) ?? null
    return { numeroFilaOriginal: fila.numero, celdas }
  })

  return { hoja, encabezados, filas }
}

// ---------------------------------------------------------------------------
// .xlsx
// ---------------------------------------------------------------------------

async function leerXlsx(bytes: ArrayBuffer): Promise<ArchivoLeido> {
  // Dinámico por lo mismo que en `exportarExcel`: pesa mucho y casi nadie importa.
  const ExcelJS = await import('exceljs')
  const libro = new ExcelJS.Workbook()

  try {
    await libro.xlsx.load(bytes)
  } catch {
    throw new ErrorArchivoImportacion('No pudimos abrir el archivo. ¿Es un .xlsx válido?')
  }

  // Primera hoja con algún dato: una hoja de "Instrucciones" vacía no cuenta.
  for (const hoja of libro.worksheets) {
    const enBruto: FilaEnBruto[] = []

    hoja.eachRow({ includeEmpty: false }, (fila, numero) => {
      const celdas = new Map<number, string>()
      fila.eachCell({ includeEmpty: false }, (celda, columna) => {
        const texto = valorDeCelda(celda.value)
        if (texto !== null) celdas.set(columna - 1, texto)
      })
      if (celdas.size > 0) enBruto.push({ numero, celdas })
    })

    if (enBruto.length > 0) return armarArchivo(hoja.name, enBruto)
  }

  throw new ErrorArchivoImportacion('El archivo no tiene datos.')
}

// ---------------------------------------------------------------------------
// .csv
// ---------------------------------------------------------------------------

const DELIMITADORES = [',', ';', '\t'] as const
type Delimitador = (typeof DELIMITADORES)[number]

/**
 * UTF-8 si los bytes lo son; si no, Windows-1252, que es lo que guarda Excel
 * en Windows con "CSV (delimitado por comas)". Un texto en 1252 con tildes casi
 * nunca es UTF-8 válido, así que la prueba estricta separa bien los dos.
 */
export function decodificarCsv(bytes: ArrayBuffer): string {
  let texto: string
  try {
    texto = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    texto = new TextDecoder('windows-1252').decode(bytes)
  }
  return texto.replace(/^﻿/, '')
}

/** El delimitador que más aparece (fuera de comillas) en el primer registro. */
export function detectarDelimitador(texto: string): Delimitador {
  const cuentas: Record<Delimitador, number> = { ',': 0, ';': 0, '\t': 0 }
  let entreComillas = false

  for (const caracter of texto) {
    if (caracter === '"') entreComillas = !entreComillas
    else if (!entreComillas) {
      if (caracter === '\n' || caracter === '\r') {
        // Saltear líneas en blanco del principio.
        if (cuentas[',']+ cuentas[';'] + cuentas['\t'] > 0) break
      } else if (caracter in cuentas) {
        cuentas[caracter as Delimitador]++
      }
    }
  }

  // En empate gana la coma; con ninguno, una sola columna: da igual.
  return DELIMITADORES.reduce<Delimitador>(
    (mejor, d) => (cuentas[d] > cuentas[mejor] ? d : mejor),
    ',',
  )
}

/** CSV según RFC 4180: comillas dobles, `""` escapa, saltos dentro de comillas. */
export function parsearCsv(texto: string, delimitador: Delimitador): string[][] {
  const registros: string[][] = []
  let registro: string[] = []
  let campo = ''
  let entreComillas = false

  const cerrarCampo = () => {
    registro.push(campo)
    campo = ''
  }
  const cerrarRegistro = () => {
    cerrarCampo()
    registros.push(registro)
    registro = []
  }

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]

    if (entreComillas) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          campo += '"'
          i++
        } else {
          entreComillas = false
        }
      } else {
        campo += c
      }
    } else if (c === '"') {
      entreComillas = true
    } else if (c === delimitador) {
      cerrarCampo()
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++
      cerrarRegistro()
    } else {
      campo += c
    }
  }

  // Última línea sin salto final.
  if (campo !== '' || registro.length > 0) cerrarRegistro()

  return registros
}

function leerCsv(bytes: ArrayBuffer): ArchivoLeido {
  const texto = decodificarCsv(bytes)
  const registros = parsearCsv(texto, detectarDelimitador(texto))

  const enBruto: FilaEnBruto[] = []
  registros.forEach((celdasCrudas, indice) => {
    const celdas = new Map<number, string>()
    celdasCrudas.forEach((crudo, columna) => {
      const limpio = crudo.trim()
      if (limpio) celdas.set(columna, limpio)
    })
    // El número es el del registro, como lo mostraría Excel al abrir el CSV.
    if (celdas.size > 0) enBruto.push({ numero: indice + 1, celdas })
  })

  return armarArchivo(null, enBruto)
}
