import {
  ESTADOS_OPERACION,
  TIPOS_OPERACION,
  type EstadoOperacion,
  type TipoOperacion,
} from '../../lib/api/operaciones'

interface FiltrosOperacionesProps {
  tipo: TipoOperacion | undefined
  onTipo: (v: TipoOperacion | undefined) => void
  estado: EstadoOperacion | undefined
  onEstado: (v: EstadoOperacion | undefined) => void
}

const CLASES =
  'rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[0.92rem] text-ink transition-colors focus:border-primary focus:outline-none motion-reduce:transition-none'

/** Dos selects, mismo patrón que FiltrosPropiedades y que el original. */
export function FiltrosOperaciones({
  tipo,
  onTipo,
  estado,
  onEstado,
}: FiltrosOperacionesProps) {
  return (
    <div className="flex flex-wrap gap-3">
      <select
        value={tipo ?? ''}
        onChange={(e) => onTipo((e.target.value || undefined) as TipoOperacion | undefined)}
        aria-label="Filtrar por tipo"
        className={CLASES}
      >
        <option value="">Todos los tipos</option>
        {TIPOS_OPERACION.map((t) => (
          <option key={t.valor} value={t.valor}>
            {t.label}
          </option>
        ))}
      </select>

      <select
        value={estado ?? ''}
        onChange={(e) =>
          onEstado((e.target.value || undefined) as EstadoOperacion | undefined)
        }
        aria-label="Filtrar por estado"
        className={CLASES}
      >
        <option value="">Todos los estados</option>
        {ESTADOS_OPERACION.map((e) => (
          <option key={e.valor} value={e.valor}>
            {e.label}
          </option>
        ))}
      </select>
    </div>
  )
}
