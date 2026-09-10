/**
 * Saneamiento de la entrada del usuario antes de armar un filtro de PostgREST.
 *
 * `.or()` recibe un string con su propia gramática: las cláusulas se separan
 * con coma y los grupos con paréntesis. Si el texto que tipea el usuario entra
 * ahí sin limpiar, una coma alcanza para agregar una cláusula que nadie pidió
 * y ampliar el conjunto de filas que devuelve la query —dentro de lo que RLS
 * permita, pero más de lo que el buscador debería mostrar—.
 *
 * Es un control de seguridad, no una comodidad: vive en un solo lugar a
 * propósito. Estuvo copiado en `leads.ts`, `operaciones.ts` y `propiedades.ts`,
 * y tres copias de una defensa son tres lugares donde arreglar un bypass y dos
 * donde olvidarse.
 *
 * Se neutraliza reemplazando por espacio y no borrando: quien busca "Pérez,
 * Juan" quiere encontrar a Juan Pérez, y dejar "PérezJuan" no matchearía nada.
 *
 * No hace falta tocar `%` ni `*`: dentro de un `ilike` son comodines, así que
 * lo peor que hace un usuario que los tipea es una búsqueda más amplia sobre
 * las filas que ya tenía permitido ver. El `.` tampoco es un problema: PostgREST
 * parte `columna.operador.valor` en los dos primeros puntos y todo lo que sigue
 * es el valor.
 */
export function sanearBusqueda(texto: string): string {
  return texto.replace(/[,()\\]/g, ' ').trim()
}
