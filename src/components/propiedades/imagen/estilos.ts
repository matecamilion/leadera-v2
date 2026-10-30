import { elegirAtajo, normalizarHex, type EleccionColor } from './eleccionColor'
import { PALETAS } from './paletas'
import type { ClavePaleta } from './tipos'

export const MAX_ESTILOS = 6
export const MAX_NOMBRE_ESTILO = 24
const VERSION = 1

/**
 * Sólo la identidad de la marca. Título, subtítulo, datos, nota, precio y fotos
 * son de cada propiedad y no se guardan.
 */
export interface EstiloGuardado {
  id: string
  nombre: string
  predeterminado: boolean
  /** Id de la plantilla (`registro.ts`). */
  plantilla: string
  paleta: ClavePaleta
  /** Sólo con la paleta `personalizada`. */
  primario?: string
  secundario?: string
  encabezado: string
  agente: string
  firma: string
  conDireccion: boolean
}

/** Lo que cambia de un estilo a otro: `id`, nombre y predeterminado los pone la lista. */
export type ContenidoEstilo = Omit<EstiloGuardado, 'id' | 'nombre' | 'predeterminado'>

const CLAVES_VALIDAS: string[] = [...PALETAS.map((p) => p.clave), 'personalizada']

function esTexto(v: unknown): v is string {
  return typeof v === 'string'
}

/** Un estilo leído del storage, o null si le falta algo o algo no es del tipo esperado. */
function validarEstilo(crudo: unknown): EstiloGuardado | null {
  if (typeof crudo !== 'object' || crudo === null) return null
  const e = crudo as Record<string, unknown>
  if (!esTexto(e.id) || !e.id || !esTexto(e.nombre) || !e.nombre.trim()) return null
  if (!esTexto(e.plantilla) || !esTexto(e.paleta) || !CLAVES_VALIDAS.includes(e.paleta)) return null
  if (!esTexto(e.encabezado) || !esTexto(e.agente) || !esTexto(e.firma)) return null
  if (typeof e.conDireccion !== 'boolean') return null

  const base = {
    id: e.id,
    nombre: e.nombre.trim().slice(0, MAX_NOMBRE_ESTILO),
    predeterminado: e.predeterminado === true,
    plantilla: e.plantilla,
    paleta: e.paleta as ClavePaleta,
    encabezado: e.encabezado,
    agente: e.agente,
    firma: e.firma,
    conDireccion: e.conDireccion,
  }
  if (base.paleta !== 'personalizada') return base

  const primario = esTexto(e.primario) ? normalizarHex(e.primario) : null
  const secundario = esTexto(e.secundario) ? normalizarHex(e.secundario) : null
  return primario && secundario ? { ...base, primario, secundario } : null
}

/**
 * Los estilos guardados. Si el texto no existe, no es JSON o es de otra versión,
 * devuelve una lista vacía; una entrada rota se descarta sin llevarse a las demás.
 * Nunca tira.
 */
export function leerEstilos(texto: string | null): EstiloGuardado[] {
  if (!texto) return []
  let crudo: unknown
  try {
    crudo = JSON.parse(texto)
  } catch {
    return []
  }
  if (typeof crudo !== 'object' || crudo === null) return []
  const { version, estilos } = crudo as { version?: unknown; estilos?: unknown }
  if (version !== VERSION || !Array.isArray(estilos)) return []

  const vistos = new Set<string>()
  const lista: EstiloGuardado[] = []
  for (const crudoEstilo of estilos) {
    const estilo = validarEstilo(crudoEstilo)
    if (!estilo || vistos.has(estilo.id)) continue
    vistos.add(estilo.id)
    // Un solo predeterminado: el primero que lo pide.
    lista.push({ ...estilo, predeterminado: estilo.predeterminado && !lista.some((s) => s.predeterminado) })
  }
  return lista.slice(0, MAX_ESTILOS)
}

export function serializarEstilos(estilos: EstiloGuardado[]): string {
  return JSON.stringify({ version: VERSION, estilos })
}

/** El nombre sin espacios de más, o null si queda vacío. */
export function limpiarNombre(nombre: string): string | null {
  const limpio = nombre.trim().replace(/\s+/g, ' ').slice(0, MAX_NOMBRE_ESTILO)
  return limpio || null
}

/** Suma un estilo al final; null si ya hay `MAX_ESTILOS` o el nombre queda vacío. */
export function agregarEstilo(
  lista: EstiloGuardado[],
  id: string,
  nombre: string,
  contenido: ContenidoEstilo,
): EstiloGuardado[] | null {
  const limpio = limpiarNombre(nombre)
  if (!limpio || lista.length >= MAX_ESTILOS) return null
  return [...lista, { ...contenido, id, nombre: limpio, predeterminado: false }]
}

/** Con un nombre vacío, la lista queda igual. */
export function renombrarEstilo(lista: EstiloGuardado[], id: string, nombre: string): EstiloGuardado[] {
  const limpio = limpiarNombre(nombre)
  if (!limpio) return lista
  return lista.map((e) => (e.id === id ? { ...e, nombre: limpio } : e))
}

export function borrarEstilo(lista: EstiloGuardado[], id: string): EstiloGuardado[] {
  return lista.filter((e) => e.id !== id)
}

/** Marca uno como predeterminado y desmarca los demás; si ya lo era, lo desmarca. */
export function alternarPredeterminado(lista: EstiloGuardado[], id: string): EstiloGuardado[] {
  const yaEra = lista.some((e) => e.id === id && e.predeterminado)
  return lista.map((e) => ({ ...e, predeterminado: !yaEra && e.id === id }))
}

export function estiloPredeterminado(lista: EstiloGuardado[]): EstiloGuardado | undefined {
  return lista.find((e) => e.predeterminado)
}

/** Los dos selectores de color tal como los dejó el estilo. */
export function eleccionDeEstilo(e: EstiloGuardado): EleccionColor {
  if (e.paleta === 'personalizada' && e.primario && e.secundario) {
    return { clave: 'personalizada', primario: e.primario, secundario: e.secundario }
  }
  return elegirAtajo(e.paleta)
}

interface DatosPlantilla {
  id: string
  nombre: string
  fotos: number
}

/**
 * Qué plantilla aplicar. Un estilo puede pedir una que necesita más fotos de las
 * que tiene la propiedad: entonces no se cambia (igual que el selector, que la
 * deshabilita) y se devuelve el motivo para avisar.
 */
export function plantillaParaEstilo(
  estilo: EstiloGuardado,
  plantillas: DatosPlantilla[],
  cantidadFotos: number,
): { plantillaId: string | null; aviso: string | null } {
  const p = plantillas.find((q) => q.id === estilo.plantilla)
  if (!p) {
    return { plantillaId: null, aviso: `La plantilla de "${estilo.nombre}" ya no existe. Se mantiene la actual.` }
  }
  if (cantidadFotos < p.fotos) {
    return {
      plantillaId: null,
      aviso: `"${estilo.nombre}" usa la plantilla ${p.nombre}, que necesita ${p.fotos} fotos, y esta propiedad tiene ${cantidadFotos}. Se mantiene la plantilla actual.`,
    }
  }
  return { plantillaId: p.id, aviso: null }
}
