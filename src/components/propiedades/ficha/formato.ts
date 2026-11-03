import { etiquetaDisposicion } from '../../../lib/api/propiedades'
import type { DatosFicha } from './datos'
import { M } from './diseno'

const NUMEROS = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 })

export interface DatoClave {
  etiqueta: string
  valor: string
}

/** Un número que informa: ni null ni cero ni negativo. */
function conValor(n: number | null | undefined): n is number {
  return n != null && Number.isFinite(n) && n > 0
}

/**
 * Los datos clave que la propiedad realmente tiene, en el orden de la ficha.
 * Lo que está vacío no aparece: ni guiones ni celdas en blanco. Tipo y zona
 * tampoco, porque ya van en el encabezado.
 *
 * Expensas: la columna no tiene moneda y en la práctica son pesos, así que se
 * asume ARS y se escribe "$ 85.000 /mes".
 */
export function datosClave(p: DatosFicha): DatoClave[] {
  const datos: DatoClave[] = []
  if (conValor(p.ambientes)) datos.push({ etiqueta: 'Ambientes', valor: NUMEROS.format(p.ambientes) })
  if (conValor(p.banos)) datos.push({ etiqueta: 'Baños', valor: NUMEROS.format(p.banos) })
  if (conValor(p.cocheras)) datos.push({ etiqueta: 'Cocheras', valor: NUMEROS.format(p.cocheras) })
  if (conValor(p.metros_cubiertos))
    datos.push({ etiqueta: 'Cubiertos', valor: `${NUMEROS.format(p.metros_cubiertos)} m²` })
  if (conValor(p.metros_cuadrados))
    datos.push({ etiqueta: 'Superficie total', valor: `${NUMEROS.format(p.metros_cuadrados)} m²` })
  if (conValor(p.expensas)) datos.push({ etiqueta: 'Expensas', valor: `$ ${NUMEROS.format(p.expensas)} /mes` })
  if (p.disposicion != null) {
    const texto = etiquetaDisposicion(p.disposicion)
    if (texto !== '—') datos.push({ etiqueta: 'Disposición', valor: texto })
  }
  return datos
}

/**
 * Reparte los datos clave en filas sin huérfanas: hasta `M.datosUnaFila` van en
 * una sola fila; con más, en dos, la primera con ceil(n/2) y la segunda con el
 * resto. Cada fila reparte su ancho en partes iguales.
 */
export function repartirDatos<T>(datos: T[]): T[][] {
  if (datos.length === 0) return []
  if (datos.length <= M.datosUnaFila) return [datos]
  const primera = Math.ceil(datos.length / 2)
  return [datos.slice(0, primera), datos.slice(primera)]
}

export interface RepartoFotos {
  portada: string | null
  /** Fotos 2 a 4: la tira de la página 1. */
  tira: string[]
  /** Desde la foto 5 hasta el tope: las páginas siguientes. */
  galeria: string[]
}

/** Qué foto va dónde, con el tope de `M.maxFotos` en total. */
export function repartirFotos(fotos: string[]): RepartoFotos {
  const dentroDelTope = fotos.slice(0, M.maxFotos)
  return {
    portada: dentroDelTope[0] ?? null,
    tira: dentroDelTope.slice(1, 4),
    galeria: dentroDelTope.slice(4),
  }
}

/**
 * La galería en filas de dos. Si la cantidad es impar, la última queda sola en
 * su fila (el documento la dibuja a ancho completo en 16:9).
 */
export function filasGaleria<T>(galeria: T[]): T[][] {
  return enFilas(galeria, 2)
}

/** Hasta acá la descripción viaja entera con su título (unas 6 líneas). */
const DESCRIPCION_CORTA = 600
const ARRANQUE_MIN = 140
const ARRANQUE_MAX = 320

export interface DescripcionPartida {
  /** Va pegado al título y nunca se separa de él. */
  inicio: string
  /** Lo que sigue; puede continuar en la página siguiente. */
  resto: string | null
}

/**
 * Parte la descripción para que el título "Descripción" nunca quede solo al
 * pie de una página con el texto en la siguiente. react-pdf no lo garantiza
 * (`minPresenceAhead` no lo cumple de forma confiable), así que el título y un
 * arranque corto van en un bloque que no se parte, y el resto fluye aparte.
 * El corte es al final de una oración si hay una a tiempo; si no, en un espacio.
 */
export function partirDescripcion(texto: string): DescripcionPartida {
  const limpio = texto.trim()
  if (limpio.length <= DESCRIPCION_CORTA) return { inicio: limpio, resto: null }

  const ventana = limpio.slice(0, ARRANQUE_MAX)
  const fin = /[.!?]\s/g
  let corte = -1
  for (let m = fin.exec(ventana); m; m = fin.exec(ventana)) {
    if (m.index + 1 >= ARRANQUE_MIN) {
      corte = m.index + 1
      break
    }
  }
  if (corte === -1) {
    const espacio = ventana.lastIndexOf(' ')
    corte = espacio >= ARRANQUE_MIN ? espacio : ARRANQUE_MAX
  }
  return { inicio: limpio.slice(0, corte).trim(), resto: limpio.slice(corte).trim() || null }
}

/** Parte en filas de N. */
export function enFilas<T>(items: T[], porFila: number): T[][] {
  const filas: T[][] = []
  for (let i = 0; i < items.length; i += porFila) filas.push(items.slice(i, i + porFila))
  return filas
}

export interface PrecioFicha {
  moneda: string
  cifra: string
}

/** null cuando no hay precio: la ficha escribe "Consultar precio". Sin moneda, solo la cifra. */
export function precioFicha(precio: number | null, moneda: string): PrecioFicha | null {
  if (!conValor(precio)) return null
  return { moneda: moneda.trim(), cifra: NUMEROS.format(precio) }
}

export function fechaGenerada(fecha: Date = new Date()): string {
  return fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
