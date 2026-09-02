import type { EstadoLead } from '../../lib/api/leads'

/** `undefined` = "Todos": el listado sin filtro de estado. */
export type ValorFiltro = EstadoLead | undefined

interface Opcion {
  valor: ValorFiltro
  label: string
  /** Color del dot y, cuando está activo, del fondo sólido. */
  dot: string
  activo: string
}

const OPCIONES: Opcion[] = [
  {
    valor: undefined,
    label: 'Todos',
    dot: 'bg-primary',
    activo: 'border-primary bg-primary text-white',
  },
  {
    valor: 'CALIENTE',
    label: 'Calientes',
    dot: 'bg-caliente',
    activo: 'border-caliente bg-caliente text-white',
  },
  {
    valor: 'TIBIO',
    label: 'Tibios',
    dot: 'bg-tibio',
    activo: 'border-tibio bg-tibio text-white',
  },
  {
    valor: 'FRIO',
    label: 'Frios',
    dot: 'bg-frio',
    activo: 'border-frio bg-frio text-white',
  },
  {
    valor: 'INACTIVO',
    label: 'Inactivos',
    dot: 'bg-inactivo',
    activo: 'border-inactivo bg-inactivo text-white',
  },
]

interface FiltrosChipsProps {
  /**
   * `'nuevos'` no tiene chip propio: el listado queda filtrado pero ninguna
   * opción se marca activa, que es más honesto que encender "Todos".
   */
  valor: ValorFiltro | 'nuevos'
  onCambiar: (valor: ValorFiltro) => void
  /** Sólo el chip "Todos" muestra contador, como en el original. */
  total?: number
}

export function FiltrosChips({ valor, onCambiar, total }: FiltrosChipsProps) {
  return (
    <nav
      aria-label="Filtrar leads por temperatura"
      className="-mx-1 flex gap-2 overflow-x-auto px-1 py-0.5 whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
              'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-[7px]',
              'text-[0.85rem] font-semibold transition-colors motion-reduce:transition-none',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
              activo
                ? opcion.activo
                : 'border-border bg-surface text-ink hover:bg-background',
            ].join(' ')}
          >
            <span
              className={`size-2 shrink-0 rounded-full ${activo ? 'bg-white/70' : opcion.dot}`}
            />
            {opcion.label}
            {opcion.valor === undefined && total !== undefined && ` (${total})`}
          </button>
        )
      })}
    </nav>
  )
}
