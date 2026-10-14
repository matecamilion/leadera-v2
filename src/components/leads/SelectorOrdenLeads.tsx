import type { OrdenLeads } from '../../lib/api/leads'

/** El orden en que se ofrecen, y cómo se nombran en pantalla. */
export const OPCIONES_ORDEN: { valor: OrdenLeads; label: string }[] = [
  { valor: 'prioridad', label: 'Prioridad' },
  { valor: 'ingreso_desc', label: 'Más recientes' },
  { valor: 'ingreso_asc', label: 'Más antiguos' },
]

interface SelectorOrdenLeadsProps {
  valor: OrdenLeads
  onCambiar: (valor: OrdenLeads) => void
}

/**
 * Un `<select>` nativo y no otro control segmentado: al lado de los chips de
 * rol, un tercer grupo de botones se leería como un filtro más, y ordenar no
 * saca a nadie de la lista.
 */
export function SelectorOrdenLeads({ valor, onCambiar }: SelectorOrdenLeadsProps) {
  return (
    <label className="inline-flex shrink-0 items-center gap-2 text-[0.82rem] text-ink-3">
      Ordenar:
      <select
        value={valor}
        onChange={(e) => onCambiar(e.target.value as OrdenLeads)}
        className="rounded-full border border-border bg-surface px-3 py-[5px] text-[0.82rem] font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {OPCIONES_ORDEN.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
