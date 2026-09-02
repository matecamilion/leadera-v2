import { ESTADOS_PROPIEDAD, type EstadoPropiedad } from '../../lib/api/propiedades'

/** Mismos pares de color que BadgeEstadoPropiedad, en versión botón. */
const ESTILOS: Record<EstadoPropiedad, string> = {
  DISPONIBLE: 'bg-badge-ganado-bg text-primary',
  RESERVADA: 'bg-badge-tibio-bg text-badge-tibio-ink',
  VENDIDA: 'bg-surface-2 text-inactivo',
  ALQUILADA: 'bg-badge-frio-bg text-frio',
  PAUSADA: 'bg-hot-soft text-caliente',
}

interface GrupoEstadoPropiedadProps {
  actual: EstadoPropiedad
  guardando: boolean
  onCambiar: (estado: EstadoPropiedad) => void
}

export function GrupoEstadoPropiedad({
  actual,
  guardando,
  onCambiar,
}: GrupoEstadoPropiedadProps) {
  return (
    <div
      role="group"
      aria-label="Cambiar el estado de la propiedad"
      className="flex flex-wrap gap-1.5"
    >
      {ESTADOS_PROPIEDAD.map((estado) => {
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
              activo
                ? `${ESTILOS[estado.valor]} ring-2 ring-primary ring-offset-1 cursor-default`
                : `${ESTILOS[estado.valor]} opacity-55 hover:opacity-100 disabled:opacity-40`,
            ].join(' ')}
          >
            {estado.label}
          </button>
        )
      })}
    </div>
  )
}
