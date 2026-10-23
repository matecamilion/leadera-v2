export const MAX_BYTES_ENTRADA = 25 * 1024 * 1024 // 25 MB
export const MAX_BYTES_SALIDA = 5 * 1024 * 1024 // 5 MB
const LADO_MAXIMO = 1920
const CALIDAD = 0.85
const CALIDAD_REINTENTO = 0.7

function aBlob(canvas: HTMLCanvasElement, calidad: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', calidad))
}

/**
 * Reduce una foto antes de subirla: lado máximo de 1920 px, JPEG.
 *
 * Al pasar por el canvas se pierden EXIF y GPS, a propósito: la ubicación de
 * donde se sacó la foto no tiene por qué publicarse con la ficha.
 *
 * Se llama de a una foto por vez; en paralelo, varios bitmaps decodificados
 * a la vez agotan la memoria de un celular.
 */
export async function prepararFoto(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) {
    throw new Error(`El archivo "${file.name}" no es una imagen.`)
  }
  if (file.size > MAX_BYTES_ENTRADA) {
    throw new Error(`"${file.name}" supera el máximo de 25 MB.`)
  }

  let bitmap: ImageBitmap
  try {
    // 'from-image' aplica la orientación EXIF antes de que se pierda.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new Error(`No pudimos leer "${file.name}". Probá con otra foto.`)
  }

  const canvas = document.createElement('canvas')
  try {
    const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height))
    canvas.width = Math.max(1, Math.round(bitmap.width * escala))
    canvas.height = Math.max(1, Math.round(bitmap.height * escala))

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error(`No pudimos procesar "${file.name}". Probá con otra foto.`)
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

    let blob = await aBlob(canvas, CALIDAD)
    if (blob && blob.size > MAX_BYTES_SALIDA) blob = await aBlob(canvas, CALIDAD_REINTENTO)
    if (!blob) throw new Error(`No pudimos procesar "${file.name}". Probá con otra foto.`)
    if (blob.size > MAX_BYTES_SALIDA) {
      throw new Error(`"${file.name}" sigue pesando más de 5 MB aun reducida. Probá con otra foto.`)
    }

    const nombre = file.name.replace(/\.[^.]+$/, '') || 'foto'
    return new File([blob], `${nombre}.jpg`, { type: 'image/jpeg' })
  } finally {
    bitmap.close()
    // Libera el buffer del canvas sin esperar al recolector.
    canvas.width = 0
    canvas.height = 0
  }
}
