import { M } from './diseno'

/**
 * Prepara las fotos de la ficha antes de armar el PDF.
 *
 * Cada foto se baja con timeout, se reduce y se re-codifica a JPEG. Las que
 * fallan se descartan solas: una foto rota nunca cancela la exportación, y la
 * ficha se completa con las siguientes de la lista hasta juntar `M.maxFotos`.
 * Si fallan todas, la ficha sale en su versión "sin fotos".
 *
 * Es una variante propia y no `prepararFoto.ts`: aquella valida los topes de
 * subida (25 MB de entrada, 5 MB de salida) y devuelve un `File`; acá se
 * descarga y se necesita una URL de datos para react-pdf.
 */

const TIMEOUT_MS = 12_000
const CONCURRENCIA = 3
/** La portada ocupa todo el ancho; las demás, media columna o menos. */
const LADO_PRINCIPAL = 1400
const LADO_GALERIA = 900
const CALIDAD = 0.8
/** Cuántas fotos se intentan como máximo: las que entran más unas de repuesto. */
const MAX_INTENTOS = M.maxFotos + 6

function aDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader()
    lector.onload = () => resolve(String(lector.result))
    lector.onerror = () => reject(lector.error)
    lector.readAsDataURL(blob)
  })
}

async function bajar(url: string): Promise<Blob> {
  const control = new AbortController()
  const timer = setTimeout(() => control.abort(), TIMEOUT_MS)
  try {
    const respuesta = await fetch(url, { signal: control.signal })
    if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`)
    return await respuesta.blob()
  } finally {
    clearTimeout(timer)
  }
}

/** La foto reducida a `ladoMaximo` como URL de datos JPEG, o null si no se pudo. */
async function reducir(original: Blob, ladoMaximo: number): Promise<string | null> {
  try {
    // 'from-image' aplica la orientación EXIF antes de que el canvas la pierda.
    const bitmap = await createImageBitmap(original, { imageOrientation: 'from-image' })
    const canvas = document.createElement('canvas')
    try {
      const escala = Math.min(1, ladoMaximo / Math.max(bitmap.width, bitmap.height))
      canvas.width = Math.max(1, Math.round(bitmap.width * escala))
      canvas.height = Math.max(1, Math.round(bitmap.height * escala))
      const ctx = canvas.getContext('2d')
      if (!ctx) return null
      // JPEG no tiene transparencia: un PNG con alfa saldría negro.
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      const jpeg = await new Promise<Blob | null>((resolver) =>
        canvas.toBlob(resolver, 'image/jpeg', CALIDAD),
      )
      return jpeg ? await aDataUrl(jpeg) : null
    } finally {
      bitmap.close()
      canvas.width = 0
      canvas.height = 0
    }
  } catch {
    return null
  }
}

/** La foto reducida como URL de datos JPEG, o null si no se pudo bajar o decodificar. */
export async function prepararFotoFicha(url: string, ladoMaximo: number): Promise<string | null> {
  try {
    return await reducir(await bajar(url), ladoMaximo)
  } catch {
    return null
  }
}

/**
 * Hasta `M.maxFotos` fotos válidas, en el orden de la propiedad, con tres
 * descargas a la vez. Si alguna falla, sigue con las siguientes de la lista, sin
 * pasar de `MAX_INTENTOS` intentos para no bajar decenas de fotos si todas
 * fallan. Devuelve solo las que salieron bien.
 *
 * La portada es la primera que sobrevive y siempre sale a 1400 px. Como solo se
 * sabe cuál es cuando termina la tanda, cada foto se reduce directo a su tamaño
 * probable (la posición 0 a 1400, el resto a 900) y, únicamente si la 0 falló,
 * la portada se vuelve a reducir desde su archivo original.
 *
 * Memoria: nunca hay más de tres fotos descargándose o decodificándose a la vez
 * (un bitmap de celular son decenas de MB), y de las originales se conserva a
 * lo sumo UNA —la de menor posición que salió bien, candidata a portada—, que
 * es un Blob, no un bitmap decodificado. La re-reducción, cuando hace falta, es
 * una sola decodificación más, al final y sin nada más en vuelo.
 */
export async function prepararFotosFicha(urls: string[]): Promise<string[]> {
  const candidatas = urls.slice(0, MAX_INTENTOS)
  const resultados: (string | null)[] = new Array(candidatas.length).fill(null)
  let siguiente = 0
  let exitosas = 0
  let enCurso = 0
  // En un objeto y no en un `let`: TypeScript no ve las asignaciones de las funciones de abajo.
  const provisoria: { actual: { indice: number; original: Blob } | null } = { actual: null }

  async function intentar(indice: number) {
    enCurso++
    try {
      const original = await bajar(candidatas[indice])
      const foto = await reducir(original, indice === 0 ? LADO_PRINCIPAL : LADO_GALERIA)
      if (!foto) return
      resultados[indice] = foto
      exitosas++
      if (indice === 0) {
        // Ya está a 1400 px: no hace falta ningún original.
        provisoria.actual = null
      } else if (resultados[0] === null && (!provisoria.actual || indice < provisoria.actual.indice)) {
        provisoria.actual = { indice, original }
      }
    } catch {
      // Una foto rota o colgada se descarta; la tanda sigue.
    } finally {
      enCurso--
    }
  }

  async function trabajador() {
    // No se piden más fotos de las que faltan: las que están en vuelo cuentan.
    while (siguiente < candidatas.length && exitosas + enCurso < M.maxFotos) {
      await intentar(siguiente++)
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCIA, candidatas.length) }, trabajador))

  const indicePortada = resultados.findIndex((r) => r !== null)
  if (indicePortada > 0 && provisoria.actual?.indice === indicePortada) {
    const portada = await reducir(provisoria.actual.original, LADO_PRINCIPAL)
    // Si la segunda reducción fallara, queda la de 900 px: mejor eso que perder la foto.
    if (portada) resultados[indicePortada] = portada
  }

  return resultados.filter((r): r is string => r !== null)
}
