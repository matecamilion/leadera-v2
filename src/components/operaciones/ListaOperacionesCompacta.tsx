import { Link } from 'react-router-dom'
import { formatearMonto, type OperacionListada } from '../../lib/api/operaciones'
import { diasSinMovimiento, esOperacionTrabada } from '../../lib/kanbanUtils'
import { formatearFecha } from '../../lib/formatoFecha'
import { IconoReloj } from '../leads/Iconos'
import { BadgeEstadoOperacion } from './BadgeEstadoOperacion'
import { BadgeTipoOperacion } from './BadgeTipoOperacion'
import { BARRA } from './barraTipoOperacion'

interface Props {
  operaciones: OperacionListada[]
  cargando: boolean
  error?: string | null
  /** Qué decir cuando no hay ninguna. */
  textoVacio: string
}

/**
 * Tarjetas compactas de operación.
 *
 * Comparte el lenguaje visual de OperacionesCards pero recortado: la usan la
 * tab del lead y la sección de la propiedad, donde ya se conoce el contexto y
 * repetir esas columnas sería ruido.
 */
export function ListaOperacionesCompacta({
  operaciones,
  cargando,
  error,
  textoVacio,
}: Props) {
  if (cargando) {
    return (
      <div aria-busy="true" aria-label="Cargando operaciones" className="space-y-3">
        {Array.from({ length: 2 }, (_, i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-[14px] bg-surface-2 motion-reduce:animate-none"
          />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <p
        role="alert"
        className="rounded-lg border border-peligro-borde bg-peligro-soft px-4 py-3 text-[0.9rem] text-peligro-ink"
      >
        {error}
      </p>
    )
  }

  if (operaciones.length === 0) {
    return (
      <div className="rounded-[16px] border border-dashed border-border bg-background px-5 py-8 text-center">
        <p className="text-[0.9rem] text-ink-3">{textoVacio}</p>
      </div>
    )
  }

  return (
    <ul className="space-y-3">
      {operaciones.map((op) => {
        const trabada = esOperacionTrabada(op.updated_at)
        return (
        <li key={op.id}>
          <Link
            to={`/operaciones/${op.id}`}
            // `relative` + `overflow-hidden` para que la barra lateral se
            // recorte contra el radio de la card en vez de pisarle la esquina.
            className="relative block overflow-hidden rounded-[14px] border border-border bg-surface p-4 pl-5 transition-colors hover:border-primary motion-reduce:transition-none"
          >
            {/* Misma barra por tipo que la card del kanban: de un vistazo se
                distingue una venta de un alquiler sin leer el badge. */}
            <span
              aria-hidden
              className={`absolute inset-y-0 left-0 w-1.5 ${BARRA[op.tipo]}`}
            />

            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5">
                <BadgeTipoOperacion tipo={op.tipo} />
                <BadgeEstadoOperacion estado={op.estado} />
              </div>
              <span className="text-[0.8rem] text-ink-3">
                {formatearFecha(op.created_at)}
              </span>
            </div>

            <p className="font-bold text-ink">{op.titulo || 'Sin título'}</p>

            <p className="mt-1 text-[0.85rem] text-ink-3">
              {op.monto != null ? formatearMonto(op.monto, op.moneda) : 'Sin monto'}
            </p>

            {/* Mismo aviso que en el kanban: una operación que hace días no se
                mueve es la que hay que empujar, y acá se ve sin ir al tablero. */}
            {trabada && (
              <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-warm-soft px-2 py-0.5 text-[0.68rem] font-bold text-badge-tibio-ink uppercase">
                <IconoReloj className="size-3" />
                {diasSinMovimiento(op.updated_at)} días sin mover
              </p>
            )}
          </Link>
        </li>
        )
      })}
    </ul>
  )
}
