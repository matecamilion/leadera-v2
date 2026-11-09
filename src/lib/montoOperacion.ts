import type { EstadoOperacion, TipoOperacion } from './api/operaciones'

export interface MontosDeOperacion {
  estado: EstadoOperacion
  monto: number | null
  monto_cierre: number | null
  moneda: string
}

export interface MontoVigente {
  valor: number | null
  moneda: string
  /** El valor es el de cierre. Si no, es el publicado. */
  esDeCierre: boolean
  /**
   * Una cerrada anterior al valor de cierre: no tiene uno propio y se muestra
   * el publicado como respaldo, y hay que decirlo.
   */
  esPublicadoDeCerrada: boolean
}

/**
 * El monto que representa a la operación hoy.
 *
 * El de cierre solo vale mientras está CERRADA_GANADA: si se reabre se conserva
 * en la base pero no se muestra, y la operación vuelve a valer lo publicado.
 */
export function montoVigenteOperacion(op: MontosDeOperacion): MontoVigente {
  const cerrada = op.estado === 'CERRADA_GANADA'
  if (cerrada && op.monto_cierre != null) {
    return { valor: op.monto_cierre, moneda: op.moneda, esDeCierre: true, esPublicadoDeCerrada: false }
  }
  return {
    valor: op.monto,
    moneda: op.moneda,
    esDeCierre: false,
    esPublicadoDeCerrada: cerrada && op.monto != null,
  }
}

/** Cómo se llama lo que se pide al cerrar: un precio, o el canon mensual del alquiler. */
export function etiquetaValorDeCierre(tipo: TipoOperacion): string {
  return tipo === 'ALQUILER' || tipo === 'BUSQUEDA_ALQUILER' ? 'Canon mensual acordado' : 'Valor de cierre'
}
