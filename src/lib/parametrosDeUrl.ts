/**
 * Parámetros de URL compartidos por los listados.
 *
 * Leads, Propiedades y Operaciones guardan su filtro, su búsqueda y su página
 * en la query string con la misma convención —`?estado=&q=&page=`, más un
 * `?tipo=` en Operaciones— para que el estado del listado sobreviva a entrar a
 * una ficha y volver, aguante un F5 y se pueda compartir tal cual se ve.
 *
 * Lo que cambia entre los tres son los valores válidos de cada filtro, y eso
 * se valida en cada página contra su propio catálogo (`ESTADOS_PROPIEDAD`,
 * `TIPOS_OPERACION`, …). Lo que no cambia es el saneo de la página: por eso es
 * lo único que vive acá.
 */

/**
 * `?page=` saneado.
 *
 * Viene de la URL, así que puede ser cualquier cosa: si no es un entero de 1
 * para arriba, se cae a la primera página.
 *
 * No se recorta contra el total porque todavía no se sabe —sale de la query
 * que estamos por lanzar—. Una página más allá del último resultado hace que
 * PostgREST conteste 416; de eso se ocupa `esPaginaFueraDeRango` y el botón
 * "Volver a la primera página" del `EstadoError`.
 */
export function leerPagina(valor: string | null): number {
  const n = Number(valor)
  return Number.isInteger(n) && n >= 1 ? n : 1
}

/**
 * Un filtro numérico de la URL, o `undefined` si no filtra.
 *
 * El piso es 1 y no 0 por la misma razón que en `lib/validaciones`: el precio y
 * los ambientes arrancan en 1 por constraint de la base, así que un 0 o un
 * negativo no acotarían nada. Lo que no sea un número usable se ignora en vez
 * de rechazarse —mismo criterio que el resto de los parámetros del listado—,
 * porque una URL tipeada a mano no debería dejar la lista vacía sin explicación.
 */
export function leerNumeroPositivo(valor: string | null): number | undefined {
  if (valor === null || valor.trim() === '') return undefined
  const n = Number(valor)
  return Number.isFinite(n) && n >= 1 ? n : undefined
}
