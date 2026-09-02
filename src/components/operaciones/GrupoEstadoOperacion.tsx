import { ESTADOS_OPERACION, type EstadoOperacion } from '../../lib/api/operaciones'

/** Mismos pares de color que BadgeEstadoOperacion, en versión botón. */
const ESTILOS: Record<string, string> = {
  PUBLICADA: 'bg-badge-ganado-bg text-primary',
  RESERVADA: 'bg-badge-tibio-bg text-badge-tibio-ink',
  EN_NEGOCIACION: 'bg-badge-tibio-bg text-badge-tibio-ink',
  CERRADA_GANADA: 'bg-badge-ganado-bg text-primary-dark',
  CANCELADA: 'bg-badge-caliente-bg text-caliente',
}

interface GrupoEstadoOperacionProps {
  actual: EstadoOperacion
  guardando: boolean
  error?: string | null
  onCambiar: (estado: EstadoOperacion) => void
}

/**
 * Cambio de estado con un click, a cualquier estado.
 *
 * Sin restricción de transiciones, igual que el original: las reglas de
 * TRANSICIONES_PERMITIDAS aplican en el Kanban, no acá.
 */
export function GrupoEstadoOperacion({
  actual,
  guardando,
  error,
  onCambiar,
}: GrupoEstadoOperacionProps) {
  return (
    <div>
      <div
        role="group"
        aria-label="Cambiar el estado de la operación"
        className="flex flex-wrap gap-1.5"
      >
        {ESTADOS_OPERACION.map((estado) => {
          const activo = estado.valor === actual
          return (
            <button
              key={estado.valor}
              type="button"
              disabled={guardando || activo}
              aria-pressed={activo}
              onClick={() => onCambiar(estado.valor)}
              className={[
                'rounded-lg px-3 py-1.5 text-[0.78rem] font-bold transition motion-reduce:transition-none',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                ESTILOS[estado.valor],
                activo
                  ? 'cursor-default ring-2 ring-primary ring-offset-1'
                  : 'opacity-55 hover:opacity-100 disabled:opacity-40',
              ].join(' ')}
            >
              {estado.label}
            </button>
          )
        })}
      </div>

      {guardando && (
        <p aria-live="polite" className="mt-1.5 text-[0.78rem] text-ink-3">
          Guardando…
        </p>
      )}

      {error && (
        <p role="alert" className="mt-1.5 text-[0.78rem] text-peligro-ink">
          {error}
        </p>
      )}
    </div>
  )
}
