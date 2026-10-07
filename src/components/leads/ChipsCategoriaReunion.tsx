import { CATEGORIAS_REUNION, type CategoriaReunion } from '../../lib/api/interacciones'

interface ChipsCategoriaReunionProps {
  valor: CategoriaReunion | null
  onCambiar: (categoria: CategoriaReunion | null) => void
}

/**
 * "¿Qué tipo de reunión?" del modelo de gestión: chips de selección única.
 *
 * Tocar el chip activo lo apaga, porque la categoría es opcional y sin eso no
 * habría forma de volver a "ninguna". Lo montan el alta y la edición de
 * interacciones, sólo con tipo REUNION y el flag prendido.
 *
 * Mismo chip que `FiltrosChips`, sin el punto de color y un escalón más chico:
 * acá va adentro de un formulario, no encabezando un listado.
 */
export function ChipsCategoriaReunion({ valor, onCambiar }: ChipsCategoriaReunionProps) {
  return (
    <fieldset>
      <legend className="mb-2 text-[0.85rem] font-semibold text-ink-2">
        ¿Qué tipo de reunión? <span className="font-normal text-ink-3">(opcional)</span>
      </legend>
      <div className="flex flex-wrap gap-2">
        {CATEGORIAS_REUNION.map((c) => {
          const activo = c.valor === valor
          return (
            <button
              key={c.valor}
              type="button"
              aria-pressed={activo}
              onClick={() => onCambiar(activo ? null : c.valor)}
              className={[
                'rounded-full border px-3 py-1.5 text-[0.8rem] font-semibold',
                'transition-colors motion-reduce:transition-none',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                activo
                  ? 'border-primary bg-primary text-primary-contrast'
                  : 'border-border bg-surface text-ink hover:bg-background',
              ].join(' ')}
            >
              {c.label}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
