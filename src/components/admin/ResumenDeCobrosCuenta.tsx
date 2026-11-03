import { CardKpi } from '../comunes/CardKpi'
import {
  formatearArs,
  formatearFechaAR,
  haceCuantoAR,
  type ResumenDeCobros,
} from '../../lib/api/admin'
import type { EstadoSuscripcion } from '../../lib/api/suscripcion'

/**
 * Qué pagó la cuenta en toda su vida. Si nunca pagó, una sola tarjeta que lo
 * dice: cinco tarjetas en cero no informan nada.
 */
export function ResumenDeCobrosCuenta({
  resumen,
  estado,
  ahora,
}: {
  resumen: ResumenDeCobros
  estado: EstadoSuscripcion
  ahora: Date
}) {
  if (resumen.cantidad === 0) {
    return (
      <section aria-label="Resumen de cobros" className="grid">
        <CardKpi
          label="Pagos"
          valor="Todavía no pagó"
          contexto={estado === 'TRIAL' ? 'Está en período de prueba.' : 'No hay pagos registrados.'}
        />
      </section>
    )
  }

  const { diasHastaPrimerPago } = resumen

  return (
    <section aria-label="Resumen de cobros" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <CardKpi
        label="Total cobrado"
        valor={formatearArs(resumen.total)}
        contexto={
          resumen.enOtraMoneda > 0
            ? `+ ${resumen.enOtraMoneda} ${resumen.enOtraMoneda === 1 ? 'pago' : 'pagos'} en otra moneda, sin sumar`
            : 'Sin contar pagos anulados'
        }
      />
      <CardKpi label="Pagos realizados" valor={String(resumen.cantidad)} />
      <CardKpi
        label="Ticket promedio"
        valor={resumen.ticketPromedio === null ? '—' : formatearArs(resumen.ticketPromedio)}
      />
      <CardKpi
        label="Último pago"
        valor={formatearFechaAR(resumen.ultimoPago)}
        contexto={resumen.ultimoPago ? haceCuantoAR(resumen.ultimoPago, ahora) : undefined}
      />
      {diasHastaPrimerPago !== null && (
        <CardKpi
          label="Días hasta el primer pago"
          valor={
            diasHastaPrimerPago === 0
              ? 'El mismo día'
              : diasHastaPrimerPago === 1
                ? '1 día'
                : `${diasHastaPrimerPago} días`
          }
          contexto="Desde el alta de la cuenta"
        />
      )}
    </section>
  )
}
