/**
 * Los pasos del trámite entre el acuerdo y la escritura, en el orden en que se
 * van dando.
 *
 * Las claves son las del CHECK de `operacion_tramite_pasos.paso`: si se agrega o
 * se renombra una, cambian las dos puntas.
 */
export const PASOS_TRAMITE = [
  { clave: 'PRESUPUESTOS_PEDIDOS', etiqueta: 'Presupuestos de escribanías pedidos' },
  { clave: 'ESCRIBANIA_ELEGIDA', etiqueta: 'Escribanía elegida' },
  { clave: 'DOCUMENTACION_ENVIADA', etiqueta: 'Documentación enviada a la escribanía' },
  {
    clave: 'CERTIFICADOS_PEDIDOS',
    etiqueta: 'Certificados pedidos (dominio, inhibición, cédula catastral)',
  },
  { clave: 'CERTIFICADOS_RECIBIDOS', etiqueta: 'Certificados recibidos y vendedores aptos' },
  { clave: 'ESCRITURA', etiqueta: 'Escritura' },
] as const

export type PasoTramite = (typeof PASOS_TRAMITE)[number]['clave']

/**
 * Lo mínimo que estos helpers miran de una fila de `operacion_tramite_pasos`.
 *
 * Un paso sin fila es un paso pendiente: la tabla solo guarda los que alguien
 * tocó. `paso` viene como `string` porque así lo devuelve la base (es `text`).
 */
export interface FilaPasoTramite {
  paso: string
  fecha_completado: string | null
  no_aplica: boolean
}

/** Un paso está resuelto si se completó o si se marcó que no aplica. */
function estaResuelto(fila: FilaPasoTramite | undefined): boolean {
  return !!fila && (fila.fecha_completado !== null || fila.no_aplica)
}

function filaDe(filas: FilaPasoTramite[], paso: PasoTramite): FilaPasoTramite | undefined {
  return filas.find((f) => f.paso === paso)
}

/** Los pasos que todavía no se resolvieron, en el orden del trámite. */
export function pasosFaltantes(filas: FilaPasoTramite[]): PasoTramite[] {
  return PASOS_TRAMITE.filter((p) => !estaResuelto(filaDe(filas, p.clave))).map((p) => p.clave)
}

/** Cuántos pasos están resueltos, completados o no aplica. */
export function pasosResueltos(filas: FilaPasoTramite[]): number {
  return PASOS_TRAMITE.length - pasosFaltantes(filas).length
}

/** El primer paso sin resolver, o `null` si no queda ninguno. */
export function siguientePaso(filas: FilaPasoTramite[]): PasoTramite | null {
  return pasosFaltantes(filas)[0] ?? null
}

/**
 * ¿Ya se firmó la escritura?
 *
 * Pide la fecha y no alcanza con "resuelta": marcar la escritura como "no
 * aplica" no es haberla hecho, y de esto cuelgan las tareas de postventa.
 */
export function escrituraHecha(filas: FilaPasoTramite[]): boolean {
  return filaDe(filas, 'ESCRITURA')?.fecha_completado != null
}
