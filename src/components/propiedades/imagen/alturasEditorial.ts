export const ALTO_ENCABEZADO = 86
export const ALTO_SUBTITULO = 56
export const ALTO_DIRECCION = 56
export const ALTO_DATOS = 92
export const ALTO_MINIATURAS = 160
export const ALTO_NOTA = 62
export const ALTO_PIE = 50
export const MARGEN_INFERIOR = 24

/** Con nota y pie: el bloque inferior completo. */
const ALTO_INFERIOR_COMPLETO = ALTO_NOTA + ALTO_PIE

/** Cuánto crecen el titular y el precio como máximo con el alto que libera lo que falta. */
const EXTRA_TITULAR_MAX = 24
const EXTRA_PRECIO_MAX = 40

/** Alto base del titular, del precio y de la foto principal: el peor caso, con todo presente. */
const ALTO_TITULAR_BASE = 156
const ALTO_PRECIO_BASE = 120
const ALTO_FOTO_BASE = 468

/** Lo que de verdad se dibuja: cada uno que falta libera su alto. */
interface Presentes {
  subtitulo: boolean
  direccion: boolean
  nota: boolean
  pie: boolean
}

/**
 * Cómo se reparten los 1330 px de Editorial (los 20 que sobran de 1350 quedan
 * de aire entre bloques). Con subtítulo, dirección, nota y pie presentes:
 *
 *   encabezado 86 + titular 156 + subtítulo 56 + dirección 56 + foto 468
 *   + datos 92 + miniaturas 160 + precio 120 + nota y pie 112 + margen 24 = 1330
 *
 * Lo que no está no deja un hueco: su alto se suma al titular, hasta
 * `EXTRA_TITULAR_MAX`; después al precio, hasta `EXTRA_PRECIO_MAX`, y el resto
 * a la foto principal. Una nota sin pie
 * conserva los 112 del bloque inferior, como siempre.
 */
export function repartirAlto({ subtitulo, direccion, nota, pie }: Presentes) {
  const alturaInferior = nota ? ALTO_INFERIOR_COMPLETO : pie ? ALTO_PIE : 0
  const holgura =
    (subtitulo ? 0 : ALTO_SUBTITULO) +
    (direccion ? 0 : ALTO_DIRECCION) +
    (ALTO_INFERIOR_COMPLETO - alturaInferior)
  const extraTitular = Math.min(holgura, EXTRA_TITULAR_MAX)
  const extraPrecio = Math.min(holgura - extraTitular, EXTRA_PRECIO_MAX)
  const altoTitular = ALTO_TITULAR_BASE + extraTitular
  const altoPrecio = ALTO_PRECIO_BASE + extraPrecio
  const altoFoto = ALTO_FOTO_BASE + holgura - extraTitular - extraPrecio

  const total =
    ALTO_ENCABEZADO +
    altoTitular +
    (subtitulo ? ALTO_SUBTITULO : 0) +
    (direccion ? ALTO_DIRECCION : 0) +
    altoFoto +
    ALTO_DATOS +
    ALTO_MINIATURAS +
    altoPrecio +
    alturaInferior +
    MARGEN_INFERIOR

  return { alturaInferior, altoTitular, altoPrecio, altoFoto, total }
}
