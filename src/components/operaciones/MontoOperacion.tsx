import { formatearMonto } from '../../lib/api/operaciones'
import { montoVigenteOperacion, type MontosDeOperacion } from '../../lib/montoOperacion'

/**
 * El monto que representa a la operación: el de cierre si está cerrada con
 * valor, y si no el publicado. En una cerrada anterior al valor de cierre, el
 * publicado es un respaldo y se marca como tal.
 */
export function MontoOperacion({ operacion }: { operacion: MontosDeOperacion }) {
  const { valor, moneda, esPublicadoDeCerrada } = montoVigenteOperacion(operacion)
  return (
    <>
      {formatearMonto(valor, moneda)}
      {esPublicadoDeCerrada && (
        <span className="ml-1.5 text-[0.7rem] font-normal text-ink-4">publicado</span>
      )}
    </>
  )
}
