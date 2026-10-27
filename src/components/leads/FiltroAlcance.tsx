interface FiltroAlcanceProps {
  mios: boolean
  onCambiar: (mios: boolean) => void
  className?: string
}

/**
 * "Míos / Todos" del asistente. Mismo alto, borde y radio que los desplegables
 * de la fila; son dos opciones excluyentes, así que va segmentado y no como un
 * tercer select. El de "Míos" no cambia respecto del chip anterior: sigue
 * siendo `aria-pressed` y escribe el mismo `?mios=`.
 */
export function FiltroAlcance({ mios, onCambiar, className = '' }: FiltroAlcanceProps) {
  return (
    <div
      role="group"
      aria-label="Alcance de los leads"
      className={`flex h-10 items-center rounded-lg border border-border bg-surface p-0.5 ${className}`}
    >
      {[
        { valor: true, label: 'Míos', titulo: 'Solo los leads asignados a vos' },
        { valor: false, label: 'Todos', titulo: 'Todos los leads que podés ver' },
      ].map((o) => {
        const activo = mios === o.valor
        return (
          <button
            key={o.label}
            type="button"
            aria-pressed={activo}
            title={o.titulo}
            onClick={() => onCambiar(o.valor)}
            className={[
              'h-full flex-1 rounded-md px-3.5 text-[0.85rem] font-semibold transition-colors motion-reduce:transition-none',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
              activo ? 'bg-ink text-surface' : 'text-ink-3 hover:bg-background hover:text-ink',
            ].join(' ')}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
