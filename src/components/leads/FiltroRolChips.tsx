import type { FiltroRol } from '../../lib/api/rolLead'

interface Opcion {
  /** `undefined` = "Todos": sin filtro de rol. */
  valor: FiltroRol | undefined
  label: string
}

const OPCIONES: Opcion[] = [
  { valor: undefined, label: 'Todos' },
  { valor: 'compradores', label: 'Compradores' },
  { valor: 'vendedores', label: 'Vendedores' },
]

interface FiltroRolChipsProps {
  valor: FiltroRol | undefined
  onCambiar: (valor: FiltroRol | undefined) => void
}

/**
 * Segundo eje del listado: qué hace el lead, no qué tan caliente está.
 *
 * Se combina con los chips de temperatura (Calientes + Compradores = los
 * compradores calientes), así que se dibuja como un control segmentado aparte
 * y no como más chips en la misma fila: en una sola fila parecería que elegir
 * uno apaga al otro.
 */
export function FiltroRolChips({ valor, onCambiar }: FiltroRolChipsProps) {
  return (
    <div
      role="group"
      aria-label="Filtrar leads por rol"
      className="inline-flex shrink-0 rounded-full border border-border bg-surface p-0.5"
    >
      {OPCIONES.map((opcion) => {
        const activo = opcion.valor === valor
        return (
          <button
            key={opcion.label}
            type="button"
            aria-pressed={activo}
            onClick={() => onCambiar(opcion.valor)}
            className={[
              'rounded-full px-3.5 py-[5px] text-[0.82rem] font-semibold whitespace-nowrap',
              'transition-colors motion-reduce:transition-none',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
              activo ? 'bg-ink text-white' : 'text-ink-3 hover:bg-background hover:text-ink',
            ].join(' ')}
          >
            {opcion.label}
          </button>
        )
      })}
    </div>
  )
}
