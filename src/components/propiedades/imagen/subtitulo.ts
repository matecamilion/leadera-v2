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
 * El título sin el "en {zona}" del final, para mostrarlo debajo de la zona sin
 * repetirla: "Departamento en Chauvín" con zona "Chauvin" queda "Departamento".
 *
 * Compara sin tildes ni mayúsculas, pero devuelve el texto como lo escribió el
 * agente. Si el título es sólo la zona, devuelve vacío. No toca nada más que el
 * final: "Depto en Chauvín, Mar del Plata" o "Casa cerca de Chauvín" quedan tal cual.
 */
export function subtituloSinZona(titulo: string, zona: string): string {
  const texto = titulo.trim()
  const buscada = comparable(zona)
  if (!buscada) return texto
  if ([buscada, `en ${buscada}`].includes(comparable(texto))) return ''

  for (let i = 1; i < texto.length; i++) {
    if (/\s/.test(texto[i]) && comparable(texto.slice(i)) === `en ${buscada}`) {
      return texto.slice(0, i).trim()
    }
  }
  return texto
}
