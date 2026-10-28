import { SeccionCard } from './SeccionCard'
import { BadgeEstadoOperacion } from '../operaciones/BadgeEstadoOperacion'
import { IconoCheck } from '../leads/Iconos'
import { useReservasDelMes } from '../../hooks/useOperaciones'
import { desdeClaveDia } from '../../lib/calendario'
import { mesDeFecha } from '../../lib/mes'
import { hoyEnArgentina } from '../../lib/ritmoSemanal'
import {
  etiquetaTipoOperacion,
  formatearMonto,
  type ReservaDelMes,
} from '../../lib/api/operaciones'

/** Cuántas reservas se listan debajo del número. */
const MOSTRADAS = 4

/** dd/mm de una fecha `yyyy-mm-dd`. Se parsea a mano: `new Date('2026-10-05')` es UTC y en GMT-3 da el día anterior. */
function diaYMes(fecha: string): string {
  return desdeClaveDia(fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
}

interface ListaReservasDelMesProps {
  onCargar: () => void
  className?: string
}

/**
 * Las reservas del mes en curso: la cantidad en grande y las últimas debajo.
 *
 * Como `ListaOperacionesEnCurso`, trae sus propios datos y se esconde si la query
 * falla: es contexto de la jornada, no la jornada. No suma montos: cada reserva
 * puede estar en una moneda distinta y un total mezclaría peras con manzanas.
 */
export function ListaReservasDelMes({ onCargar, className = '' }: ListaReservasDelMesProps) {
  const { data, isPending, isError } = useReservasDelMes(MOSTRADAS)

  if (isError) return null
  if (isPending || !data) return <SkeletonSeccion className={className} />

  const { data: reservas, count } = data

  return (
    <SeccionCard
      icono={<IconoCheck className="size-4" />}
      tono="tibio"
      titulo="Reservas del mes"
      subtitulo="Reservas con fecha de este mes, sin las canceladas"
      verTodos={
        count > 0
          ? {
              ruta: `/operaciones/reservas?mes=${mesDeFecha(hoyEnArgentina())}`,
              texto: `Ver todas (${count}) →`,
            }
          : undefined
      }
      className={className}
    >
      {count === 0 ? (
        <div className="rounded-[14px] border border-dashed border-border bg-surface-2 px-4 py-6 text-center">
          <p className="m-0 text-[0.88rem] text-ink-3">Todavía no cargaste reservas este mes</p>
          <button
            type="button"
            onClick={onCargar}
            className="mt-3 min-h-10 rounded-lg bg-primary px-4 py-2 text-[0.85rem] font-semibold text-primary-contrast transition-colors hover:bg-primary-dark motion-reduce:transition-none"
          >
            Cargar reserva
          </button>
        </div>
      ) : (
        <>
          <p className="m-0 mb-1 flex items-baseline gap-2">
            <span className="text-[2rem] leading-none font-bold text-ink tabular-nums">{count}</span>
            <span className="text-[0.85rem] text-ink-3">
              {count === 1 ? 'reserva este mes' : 'reservas este mes'}
            </span>
          </p>

          <ul className="divide-y divide-border">
            {reservas.map((reserva) => (
              <FilaReserva key={reserva.id} reserva={reserva} />
            ))}
          </ul>
        </>
      )}
    </SeccionCard>
  )
}

function FilaReserva({ reserva }: { reserva: ReservaDelMes }) {
  const tipo = etiquetaTipoOperacion(reserva.tipo)

  return (
    <li className="flex items-center gap-2.5 py-2">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.9rem] font-semibold text-ink">
          {reserva.titulo?.trim() || tipo}
        </span>
        <span className="mt-0.5 block truncate text-[0.74rem] text-ink-3">
          {reserva.fecha_reserva ? `${diaYMes(reserva.fecha_reserva)} · ${tipo}` : tipo}
        </span>
      </span>

      <span className="shrink-0 text-right">
        {reserva.monto != null && (
          <span className="block text-[0.82rem] font-semibold whitespace-nowrap text-ink tabular-nums">
            {formatearMonto(reserva.monto, reserva.moneda)}
          </span>
        )}
        <span className="mt-1 block">
          <BadgeEstadoOperacion tipo={reserva.tipo} estado={reserva.estado} />
        </span>
      </span>
    </li>
  )
}

function SkeletonSeccion({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden className={`mb-5 ${className}`.trim()}>
      <div className="mb-3 h-8 w-56 animate-pulse rounded bg-surface-2 motion-reduce:animate-none" />
      <div className="h-[193px] animate-pulse rounded-2xl bg-surface-2 motion-reduce:animate-none" />
    </div>
  )
}
