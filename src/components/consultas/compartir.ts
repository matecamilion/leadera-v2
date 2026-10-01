/**
 * Armar, copiar y compartir el link público de consultas.
 *
 * La URL sale del origin en el que corre la app (en producción,
 * `https://app.leadera.com.ar/c/…`): así un link copiado en local apunta a
 * local y nunca a producción por error.
 */

export function urlDelLink(slug: string): string {
  return `${window.location.origin}/c/${slug}`
}

/** "app.leadera.com.ar/c/a1b2c3d4e5f6": para mostrar, sin el protocolo. */
export function urlVisible(slug: string): string {
  return urlDelLink(slug).replace(/^https?:\/\//, '')
}

/** Copia al portapapeles. Con el Clipboard API, y si no está, a la vieja usanza. */
export async function copiarTexto(texto: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texto)
      return true
    }
  } catch {
    // Sin permiso (iframe, http): se cae al respaldo.
  }
  try {
    const area = document.createElement('textarea')
    area.value = texto
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    area.remove()
    return ok
  } catch {
    return false
  }
}

/** Web Share API: la hoja de compartir del teléfono (y de algunos desktop). */
export function puedeCompartir(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function'
}

export type ResultadoCompartir = 'compartido' | 'cancelado' | 'copiado' | 'fallo'

/**
 * Abre la hoja de compartir. Si el navegador no la tiene o falla, copia el
 * texto completo como respaldo. Cerrar la hoja sin elegir no es un error.
 */
export async function compartirLink(datos: { titulo: string; texto: string; url: string }): Promise<ResultadoCompartir> {
  if (puedeCompartir()) {
    try {
      await navigator.share({ title: datos.titulo, text: datos.texto, url: datos.url })
      return 'compartido'
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelado'
    }
  }
  return (await copiarTexto(`${datos.texto} ${datos.url}`)) ? 'copiado' : 'fallo'
}
