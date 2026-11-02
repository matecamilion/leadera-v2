import { MAX_FOTOS } from './api/storage'

export const MENSAJE_FORMATO_NO_COMPATIBLE =
  'Formato no compatible: probá con una foto JPG o PNG'

/**
 * Muestra el motivo de una falla de subida. Los dos mensajes con que el
 * navegador o `prepararFoto` rechazan un formato que no pueden leer (un HEIC,
 * por ejemplo) no le dicen nada a quien sube: se cambian por uno que sí.
 */
export function motivoLegible(mensaje: string): string {
  if (/^No pudimos leer/i.test(mensaje) || /no es una imagen/i.test(mensaje)) {
    return MENSAJE_FORMATO_NO_COMPATIBLE
  }
  return mensaje
}

/** "Subí 1 foto más…" / "Subí 2 fotos más…". */
export function textoFaltanFotos(faltan: number): string {
  return `Subí ${faltan} ${faltan === 1 ? 'foto más' : 'fotos más'} para crear el flyer`
}

/**
 * De lo que se eligió, qué entra. El cupo es lo que queda hasta `MAX_FOTOS`:
 * se suben las primeras que caben y se cuentan las demás para avisarlo.
 */
export function planearLote<T>(
  archivos: T[],
  fotosActuales: number,
): { aSubir: T[]; descartadas: number } {
  const cupo = Math.max(0, MAX_FOTOS - fotosActuales)
  return {
    aSubir: archivos.slice(0, cupo),
    descartadas: Math.max(0, archivos.length - cupo),
  }
}

export interface FalloDeSubida {
  archivo: string
  motivo: string
}

export interface ResultadoLote {
  /** Cuántas quedaron guardadas. */
  subidas: number
  /** Cuántas se intentaron subir, o se iban a intentar: las que cupieron. */
  total: number
  /** Las que no entraban por el tope de fotos y ni se intentaron. */
  descartadas: number
  fallos: FalloDeSubida[]
  /** La carga se cortó por un error de permiso: no se probó con el resto. */
  cortadoPorPermiso: boolean
}

export interface MensajeDeLote {
  tipo: 'aviso' | 'error'
  texto: string
}

/**
 * Lo que se le dice a quien subió. Sin fallas ni descartes no hay nada que
 * decir: la tarjeta ya cambia sola. Con fallas es un error (`role="alert"`);
 * con descartes solos, un aviso.
 */
export function mensajeDeLote(r: ResultadoLote): MensajeDeLote | null {
  const tope = `el máximo es ${MAX_FOTOS} fotos por propiedad`

  if (r.fallos.length > 0) {
    const motivos = [...new Set(r.fallos.map((f) => motivoLegible(f.motivo)))].join('; ')
    const base = `Se subieron ${r.subidas} de ${r.total}. Falló: ${motivos}`
    const corte = r.cortadoPorPermiso ? '. Se detuvo la carga' : ''
    const descartes = r.descartadas > 0 ? `. Además, ${tope}` : ''
    return { tipo: 'error', texto: `${base}${corte}${descartes}` }
  }

  if (r.descartadas > 0) {
    return { tipo: 'aviso', texto: `Se subieron ${r.subidas}; ${tope}` }
  }

  return null
}
