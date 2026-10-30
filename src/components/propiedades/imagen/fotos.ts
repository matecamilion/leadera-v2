/**
 * Las fotos de una plantilla que pide `cantidad`: se conservan las ya elegidas,
 * en su orden, y se completa con las primeras de la propiedad que falten.
 */
export function fotosParaPlantilla(actuales: string[], todas: string[], cantidad: number): string[] {
  const conservadas = actuales.slice(0, cantidad)
  const faltan = todas.filter((u) => !conservadas.includes(u))
  return [...conservadas, ...faltan].slice(0, cantidad)
}
