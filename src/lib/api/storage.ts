import { supabase } from '../supabase'

export const BUCKET_FOTOS = 'propiedades-fotos'
export const MAX_FOTOS = 10
export const MAX_BYTES = 5 * 1024 * 1024 // 5 MB

/**
 * Error de configuración del bucket, separado de los errores de subida.
 *
 * Si el bucket no existe, Storage responde "Bucket not found" y sin traducirlo
 * el usuario ve un mensaje en inglés que no le dice qué hacer.
 */
export class ErrorStorage extends Error {
  readonly esFaltaBucket: boolean

  constructor(mensaje: string, esFaltaBucket = false) {
    super(mensaje)
    this.name = 'ErrorStorage'
    this.esFaltaBucket = esFaltaBucket
  }
}

function traducirError(mensaje: string): ErrorStorage {
  if (/bucket not found/i.test(mensaje)) {
    return new ErrorStorage(
      `Falta crear el bucket "${BUCKET_FOTOS}" en Supabase Storage. El resto de la ficha funciona igual.`,
      true,
    )
  }
  if (/row-level security|not authorized|permission/i.test(mensaje)) {
    return new ErrorStorage(
      `El bucket "${BUCKET_FOTOS}" existe pero no tenés permiso para subir. Faltan las políticas de Storage.`,
      true,
    )
  }
  return new ErrorStorage(`No se pudo subir la foto: ${mensaje}`)
}

/** Valida un archivo antes de tocar la red. Devuelve el motivo o null. */
export function validarArchivo(file: File): string | null {
  if (!file.type.startsWith('image/')) return `El archivo "${file.name}" no es una imagen.`
  if (file.size > MAX_BYTES) return `"${file.name}" supera el máximo de 5 MB.`
  return null
}

/** Nombre seguro para la key: sin espacios ni acentos. */
function sanearNombre(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .slice(-80)
}

async function leerFotos(propiedadId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('propiedades')
    .select('fotos_urls')
    .eq('id', propiedadId)
    .maybeSingle()

  if (error) throw new ErrorStorage(`No se pudieron leer las fotos: ${error.message}`)
  if (!data) throw new ErrorStorage('La propiedad no existe o no tenés permiso.')
  return data.fotos_urls ?? []
}

async function escribirFotos(propiedadId: string, urls: string[]): Promise<void> {
  const { data, error } = await supabase
    .from('propiedades')
    .update({ fotos_urls: urls })
    .eq('id', propiedadId)
    .select('id')
    .maybeSingle()

  if (error) throw new ErrorStorage(`No se pudo guardar la foto: ${error.message}`)
  if (!data) throw new ErrorStorage('No tenés permiso para editar esta propiedad.')
}

/**
 * Sube una foto y la agrega a `propiedades.fotos_urls`.
 *
 * El append es lectura + escritura, sin transacción: con un agente subiendo
 * a la vez alcanza. Las subidas de un mismo batch se hacen en serie desde el
 * hook justamente para no pisarse entre sí.
 */
export async function subirFotoPropiedad(
  propiedadId: string,
  file: File,
): Promise<string> {
  const motivo = validarArchivo(file)
  if (motivo) throw new ErrorStorage(motivo)

  const actuales = await leerFotos(propiedadId)
  if (actuales.length >= MAX_FOTOS) {
    throw new ErrorStorage(`Llegaste al máximo de ${MAX_FOTOS} fotos.`)
  }

  const key = `${propiedadId}/${Date.now()}-${sanearNombre(file.name)}`

  const { error: errorSubida } = await supabase.storage
    .from(BUCKET_FOTOS)
    .upload(key, file, { cacheControl: '3600', upsert: false })

  if (errorSubida) throw traducirError(errorSubida.message)

  const { data: publica } = supabase.storage.from(BUCKET_FOTOS).getPublicUrl(key)
  const url = publica.publicUrl

  await escribirFotos(propiedadId, [...actuales, url])
  return url
}

/**
 * Saca la URL del array.
 *
 * PENDIENTE: no borra el archivo físico del bucket. Para esta fase alcanza —
 * la foto desaparece de la ficha— pero el objeto sigue ocupando Storage. Si
 * el espacio empieza a importar, hay que derivar la key desde la URL y llamar
 * a `storage.remove([key])` acá mismo.
 */
export async function eliminarFotoPropiedad(
  propiedadId: string,
  url: string,
): Promise<void> {
  const actuales = await leerFotos(propiedadId)
  await escribirFotos(
    propiedadId,
    actuales.filter((u) => u !== url),
  )
}
