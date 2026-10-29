/**
 * De filas crudas (texto) a filas listas para validar e importar.
 *
 * Solo transforma y avisa: no consulta la base ni decide qué se importa. Cada
 * fila trae `errores` (bloquean: la fila no se puede importar) y `avisos`
 * (informan: la fila entra igual, pero con algo que el usuario debería saber).
 */
import { esTelefonoConfiable, normalizarTelefonoAR } from '../telefono'
import {
  armarConsulta,
  avisosDeDescripcion,
  componerDescripcion,
  largo,
  MAX_DESCRIPCION,
  type Consulta,
  type DatoExtra,
} from './descripcionConsultas'
import type { FilaCruda } from './leerArchivo'
import { columnasDetalle, type CampoDestino, type MapeoColumnas } from './mapeoColumnas'
import { traducirOrigen, type OrigenImportable } from './origenes'
import { limpiarMensaje } from './textosFijos'

/** Mismo criterio que el alta manual (`NuevoLead.tsx`). */
const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Los topes que valida la RPC `importar_leads` (en caracteres). Pasados, la base
 * devuelve ERROR para la fila: acá se detecta antes, para que no llegue.
 */
export const LIMITES_DE_CAMPO = {
  nombre: 100,
  apellido: 100,
  telefono: 50,
  email: 254,
  descripcion: MAX_DESCRIPCION,
} as const

/** Cuánto en el futuro puede estar la fecha de ingreso: el mismo margen que la RPC. */
const MS_TOLERANCIA_FUTURO = 86_400_000

export type EstadoImportado = 'CALIENTE' | 'TIBIO' | 'FRIO' | 'GANADO' | 'INACTIVO'

export interface FilaNormalizada {
  /** Número de fila en el archivo original. */
  fila: number
  nombre: string
  apellido: string | null
  /** Tal como lo tipeó la persona, recortado. Es lo que se guarda. */
  telefono: string | null
  /**
   * `normalizarTelefonoAR(telefono)`. Existe aunque `telefonoDudoso` sea true,
   * como dato informativo; para comparar, mirar antes el flag.
   */
  telefonoNorm: string | null
  /** Hay teléfono, pero la normalización no llegó a un celular argentino de verdad. */
  telefonoDudoso: boolean
  /** En minúsculas y con formato válido, o null. Nunca ''. */
  email: string | null
  estado: EstadoImportado | null
  /**
   * El origen del archivo traducido al enum. null si no hay columna de origen o
   * la celda está vacía: no se manda y la RPC usa IMPORTACION.
   */
  origen: OrigenImportable | null
  fechaIngreso: Date | null
  /** El detalle ya compuesto (consulta + datos extra), de hasta 2000 caracteres. */
  descripcion: string | null
  /** El bloque de esta fila, para recomponer el detalle si se fusiona con otras. */
  consulta: Consulta | null
  /** Los avisos de `avisos` que vienen de componer el detalle (para recalcularlos al fusionar). */
  avisosDescripcion: string[]
  /** Bloqueantes. Con alguno, la fila no se importa. */
  errores: string[]
  /** No bloquean. */
  avisos: string[]
}

// ---------------------------------------------------------------------------
// Teléfono
// ---------------------------------------------------------------------------

function analizarTelefono(texto: string | null): {
  telefono: string | null
  norm: string | null
  dudoso: boolean
} {
  if (!texto) return { telefono: null, norm: null, dudoso: false }

  const norm = normalizarTelefonoAR(texto)
  // Sin un solo dígito ("no tiene") no hay teléfono que guardar.
  if (!norm) return { telefono: null, norm: null, dudoso: false }

  return { telefono: texto, norm, dudoso: !esTelefonoConfiable(texto) }
}

// ---------------------------------------------------------------------------
// Estado
// ---------------------------------------------------------------------------

function sinTildes(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

const ESTADOS: Record<string, EstadoImportado> = {
  caliente: 'CALIENTE',
  tibio: 'TIBIO',
  tibia: 'TIBIO',
  frio: 'FRIO',
  fria: 'FRIO',
  ganado: 'GANADO',
  inactivo: 'INACTIVO',
}

export function parsearEstado(texto: string | null): EstadoImportado | null {
  if (!texto) return null
  return ESTADOS[sinTildes(texto)] ?? null
}

// ---------------------------------------------------------------------------
// Fecha
// ---------------------------------------------------------------------------

/** Excel cuenta días desde el 30/12/1899 (corrige el año bisiesto inexistente de 1900). */
const EPOCA_EXCEL_UTC = Date.UTC(1899, 11, 30)
const MS_POR_DIA = 86_400_000

/**
 * Rango de seriales que se toma como fecha: 1990 a 2100. Menos que eso es
 * casi seguro otro número (un "3", un monto) y no una fecha.
 */
const SERIAL_MINIMO = 32_874
const SERIAL_MAXIMO = 73_415

function fechaLocal(
  anio: number,
  mes: number,
  dia: number,
  horas = 0,
  minutos = 0,
  segundos = 0,
): Date | null {
  const fecha = new Date(anio, mes - 1, dia, horas, minutos, segundos)
  // `Date` corrige solo el 31/02 a marzo: si algo cambió, la fecha no existía.
  const coincide =
    fecha.getFullYear() === anio &&
    fecha.getMonth() === mes - 1 &&
    fecha.getDate() === dia &&
    horas < 24 &&
    minutos < 60 &&
    segundos < 60
  return coincide ? fecha : null
}

const DD_MM_AAAA = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
const AAAA_MM_DD = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
const NUMERO = /^\d+(?:[.,]\d+)?$/

/**
 * Una fecha de ingreso desde un `Date`, un serial de Excel o un texto
 * `dd/mm/aaaa` (con o sin hora; también `aaaa-mm-dd`). Lo que no se entiende,
 * null.
 *
 * Los textos y seriales se leen como hora local: una planilla no trae zona.
 * Un `Date` se toma como el instante que ya es.
 */
export function parsearFecha(valor: string | number | Date | null | undefined): Date | null {
  if (valor === null || valor === undefined) return null
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor

  if (typeof valor === 'number') return desdeSerial(valor)

  const texto = valor.trim()
  if (!texto) return null

  if (NUMERO.test(texto)) return desdeSerial(Number(texto.replace(',', '.')))

  const dmy = DD_MM_AAAA.exec(texto)
  if (dmy) {
    const [, d, m, a, h, mi, s] = dmy
    return fechaLocal(Number(a), Number(m), Number(d), Number(h ?? 0), Number(mi ?? 0), Number(s ?? 0))
  }

  const ymd = AAAA_MM_DD.exec(texto)
  if (ymd) {
    const [, a, m, d, h, mi, s] = ymd
    return fechaLocal(Number(a), Number(m), Number(d), Number(h ?? 0), Number(mi ?? 0), Number(s ?? 0))
  }

  return null
}

function desdeSerial(serial: number): Date | null {
  if (!Number.isFinite(serial) || serial < SERIAL_MINIMO || serial > SERIAL_MAXIMO) return null
  const utc = new Date(EPOCA_EXCEL_UTC + Math.round(serial * MS_POR_DIA))
  // El serial es hora de pared: se rearma con los componentes UTC como local.
  return fechaLocal(
    utc.getUTCFullYear(),
    utc.getUTCMonth() + 1,
    utc.getUTCDate(),
    utc.getUTCHours(),
    utc.getUTCMinutes(),
  )
}

// ---------------------------------------------------------------------------
// Nombre
// ---------------------------------------------------------------------------

function colapsar(texto: string): string {
  return texto.replace(/\s+/g, ' ').trim()
}

/** Primera palabra = nombre; el resto, apellido. */
export function partirNombreCompleto(completo: string): { nombre: string; apellido: string | null } {
  const [nombre = '', ...resto] = colapsar(completo).split(' ')
  return { nombre, apellido: resto.join(' ') || null }
}

// ---------------------------------------------------------------------------
// Fila
// ---------------------------------------------------------------------------

/**
 * `encabezados` rotula las columnas del detalle ("Dirección: …"); sin ellos
 * (la vista previa no los necesita) esas columnas salen como "Columna N".
 */
export function normalizarFilas(
  filas: FilaCruda[],
  mapeo: MapeoColumnas,
  encabezados: string[] = [],
): FilaNormalizada[] {
  return filas.map((cruda) => normalizarFila(cruda, mapeo, encabezados))
}

/** "juan.perez_lopez" -> "Juan Perez Lopez". */
function nombreDesdeEmail(local: string): string {
  return colapsar(local.replace(/[._-]+/g, ' '))
    .split(' ')
    .filter(Boolean)
    .map((palabra) => palabra.charAt(0).toUpperCase() + palabra.slice(1).toLowerCase())
    .join(' ')
}

function normalizarFila(cruda: FilaCruda, mapeo: MapeoColumnas, encabezados: string[]): FilaNormalizada {
  const errores: string[] = []
  const avisos: string[] = []

  const celda = (campo: CampoDestino): string | null => {
    const columna = mapeo[campo]
    if (columna === undefined) return null
    return cruda.celdas[columna]?.trim() || null
  }

  // Nombre. La columna "nombre" manda sobre "nombre completo" cuando las dos
  // están y la primera tiene dato; el apellido suelto, igual sobre el partido.
  const completo = celda('nombreCompleto')
  const partido = completo ? partirNombreCompleto(completo) : null
  const nombreSuelto = celda('nombre')
  let nombre = nombreSuelto ? colapsar(nombreSuelto) : (partido?.nombre ?? '')
  const apellidoSuelto = celda('apellido')
  const apellido = apellidoSuelto
    ? colapsar(apellidoSuelto)
    : nombreSuelto
      ? null
      : (partido?.apellido ?? null)

  // Un email en la columna Nombre (los CRM lo usan cuando no tienen el nombre) no
  // es un nombre: se usa lo de antes de la @ y, si el email no vino aparte, se
  // guarda como email. Un email que ya vino en su columna manda.
  const emailColumna = celda('email')?.replace(/^mailto:/i, '').trim().toLowerCase() ?? null
  const emailColumnaValido = emailColumna !== null && EMAIL_VALIDO.test(emailColumna)
  let emailDeNombre: string | null = null
  if (nombre.includes('@')) {
    const candidato = nombre.replace(/^mailto:/i, '').trim().toLowerCase()
    const nombreDelEmail = nombreDesdeEmail(nombre.replace(/^mailto:/i, '').split('@')[0])
    if (!emailColumnaValido && EMAIL_VALIDO.test(candidato)) {
      emailDeNombre = candidato
      avisos.push(`El nombre era un email: se usó "${nombreDelEmail}" como nombre y el email se guardó en su campo.`)
    } else {
      avisos.push(`El nombre era un email: se usó "${nombreDelEmail}" como nombre.`)
    }
    nombre = nombreDelEmail
  }

  if (!nombre) errores.push('Falta el nombre.')
  // Nombre y apellido no se recortan: quedarían mal. La fila no se importa.
  if (largo(nombre) > LIMITES_DE_CAMPO.nombre) {
    errores.push(`El nombre supera los ${LIMITES_DE_CAMPO.nombre} caracteres.`)
  }
  if (apellido && largo(apellido) > LIMITES_DE_CAMPO.apellido) {
    errores.push(`El apellido supera los ${LIMITES_DE_CAMPO.apellido} caracteres.`)
  }

  // Teléfono
  const tel = analizarTelefono(celda('telefono'))
  if (celda('telefono') && !tel.telefono) {
    avisos.push('El teléfono no tiene números: se ignora.')
  }
  if (tel.telefono && largo(tel.telefono) > LIMITES_DE_CAMPO.telefono) {
    errores.push(`El teléfono supera los ${LIMITES_DE_CAMPO.telefono} caracteres.`)
  }
  if (tel.dudoso) {
    avisos.push(
      'El teléfono no parece un celular argentino válido: se importa igual, pero no se usa para detectar duplicados.',
    )
  }

  // Email: vacío o inválido es null, nunca ''. El UNIQUE sobre lower(email)
  // chocaría contra la segunda fila con ''.
  const emailCrudo = celda('email')
  let email: string | null = null
  if (emailCrudo) {
    const candidato = emailCrudo.replace(/^mailto:/i, '').trim().toLowerCase()
    if (EMAIL_VALIDO.test(candidato)) {
      email = candidato
    } else {
      avisos.push('El email no tiene un formato válido: se ignora.')
    }
  }
  if (!email && emailDeNombre) email = emailDeNombre
  if (email && largo(email) > LIMITES_DE_CAMPO.email) {
    errores.push(`El email supera los ${LIMITES_DE_CAMPO.email} caracteres.`)
  }

  // Estado
  const estadoCrudo = celda('estado')
  const estado = parsearEstado(estadoCrudo)
  if (estadoCrudo && !estado) {
    avisos.push(`No reconocimos el estado "${estadoCrudo}": el lead entra como nuevo.`)
  }

  // Fecha de ingreso
  const fechaCruda = celda('fechaIngreso')
  let fechaIngreso = parsearFecha(fechaCruda)
  if (fechaCruda && !fechaIngreso) {
    avisos.push(`No entendimos la fecha "${fechaCruda}": se usa la de hoy.`)
  }
  // Mismo criterio que la RPC: a más de un día en el futuro, se usa la de hoy.
  if (fechaIngreso && fechaIngreso.getTime() > Date.now() + MS_TOLERANCIA_FUTURO) {
    fechaIngreso = null
    avisos.push('La fecha de ingreso es futura: se usa la de hoy.')
  }

  // Origen: el del archivo, traducido al enum. Sin columna o con la celda vacía no
  // se manda nada y la RPC pone IMPORTACION. El nombre original queda en el detalle.
  const origenOriginal = celda('origen')
  const origen = origenOriginal ? traducirOrigen(origenOriginal) : null

  // Detalle: la consulta de esta fila (fecha y origen, mensaje, columnas extra).
  // Lo que sobra del tope se recorta: es texto de más, no un dato mal.
  const extras: DatoExtra[] = []
  for (const columna of columnasDetalle(mapeo)) {
    const valor = cruda.celdas[columna]?.trim()
    if (!valor) continue
    extras.push({ encabezado: encabezados[columna]?.trim() || `Columna ${columna + 1}`, valor })
  }
  const consulta = armarConsulta({ fecha: fechaIngreso, origenOriginal, mensaje: limpiarMensaje(celda('descripcion')), extras })
  const compuesta = componerDescripcion(consulta ? [consulta] : [])
  const avisosDescripcion = avisosDeDescripcion(compuesta)
  avisos.push(...avisosDescripcion)

  if (!email && (!tel.telefono || tel.dudoso)) {
    avisos.push('Sin teléfono ni email válidos: no hay forma de detectar duplicados.')
  }

  return {
    fila: cruda.numeroFilaOriginal,
    nombre,
    apellido,
    telefono: tel.telefono,
    telefonoNorm: tel.norm,
    telefonoDudoso: tel.dudoso,
    email,
    estado,
    origen,
    fechaIngreso,
    descripcion: compuesta.texto,
    consulta,
    avisosDescripcion,
    errores,
    avisos,
  }
}
