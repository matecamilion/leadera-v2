import { ALTO, ANCHO, FAMILIA_SERIF } from './constantes'

/** Alguna foto no cargó: no se exporta una pieza con huecos. */
export class ErrorFotos extends Error {}

/** Resuelve cuando la imagen ya cargó; rechaza si falló o tarda de más. */
function imagenCargada(img: HTMLImageElement): Promise<void> {
  if (img.complete) {
    return img.naturalWidth > 0 ? Promise.resolve() : Promise.reject(new ErrorFotos())
  }
  return new Promise((resolver, rechazar) => {
    const limite = window.setTimeout(() => rechazar(new ErrorFotos()), 15_000)
    img.addEventListener('load', () => {
      window.clearTimeout(limite)
      resolver()
    })
    img.addEventListener('error', () => {
      window.clearTimeout(limite)
      rechazar(new ErrorFotos())
    })
  })
}

/**
 * Baja el nodo como PNG de 1080×1350 con el nombre dado.
 *
 * Con la serif y la sans listas, y las fotos cargadas: si no, la imagen sale
 * con la tipografía de reemplazo o con huecos.
 */
export async function descargarPng(nodo: HTMLElement, nombre: string): Promise<void> {
  await Promise.all([
    document.fonts.load(`600 34px ${FAMILIA_SERIF}`),
    document.fonts.load(`700 50px ${FAMILIA_SERIF}`),
  ])
  await document.fonts.ready
  await Promise.all(Array.from(nodo.querySelectorAll('img')).map(imagenCargada))

  // Se carga el módulo recién ahora: html-to-image no viaja con el panel.
  const { toPng } = await import('html-to-image')
  const opciones = {
    width: ANCHO,
    height: ALTO,
    pixelRatio: 1,
    // Sin esto el navegador puede reusar la foto cacheada sin CORS de la
    // galería, y el fetch de la exportación falla.
    cacheBust: true,
    style: { transform: 'none' },
  }
  // Safari/iOS dibuja vacías las imágenes en la primera pasada.
  await toPng(nodo, opciones)
  const png = await toPng(nodo, opciones)

  const ancla = document.createElement('a')
  ancla.href = png
  ancla.download = `${nombre}.png`
  document.body.appendChild(ancla)
  ancla.click()
  ancla.remove()
}
