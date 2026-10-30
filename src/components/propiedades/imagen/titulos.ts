/** Lo que entra en la pieza: el título se ajusta solo, el subtítulo es la línea más angosta (Impacto). */
export const MAX_TITULO = 30
export const MAX_SUBTITULO = 28

/** Minúsculas, sin tildes y con los espacios colapsados: para comparar, no para mostrar. */
function comparable(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Con qué arranca el título: la zona, o la dirección si no hay zona. Si no entra
 * en el máximo queda vacío, y el fallback de `tituloEfectivo` muestra lo mismo.
 */
export function tituloInicial(zona: string | null, direccion: string): string {
  const texto = zona?.trim() || direccion.trim()
  return texto.length <= MAX_TITULO ? texto : ''
}

/** Con qué arranca el subtítulo: el tipo de propiedad, salvo que repita el título. */
export function subtituloInicial(tipo: string, titulo: string): string {
  const texto = tipo.trim()
  if (comparable(texto) === comparable(titulo)) return ''
  return texto.length <= MAX_SUBTITULO ? texto : ''
}

/** El título que se dibuja: el escrito, y si está vacío la zona, y si no hay zona la dirección. */
export function tituloEfectivo(titulo: string, zona: string | null, direccion: string): string {
  return titulo.trim() || zona?.trim() || direccion.trim()
}
