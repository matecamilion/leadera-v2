import type { OrdenLeads } from '../../lib/api/leads'
import { SelectorFiltro } from './SelectorFiltro'

/** El orden en que se ofrecen, y cómo se nombran en pantalla. */
export const OPCIONES_ORDEN: { valor: OrdenLeads; label: string }[] = [
  { valor: 'prioridad', label: 'Prioridad' },
  { valor: 'ingreso_desc', label: 'Más recientes' },
  { valor: 'ingreso_asc', label: 'Más antiguos' },
]

interface SelectorOrdenLeadsProps {
  valor: OrdenLeads
  onCambiar: (valor: OrdenLeads) => void
  className?: string
}

/** Ordenar no saca a nadie de la lista: es un desplegable más, sin destacar. */
export function SelectorOrdenLeads({ valor, onCambiar, className }: SelectorOrdenLeadsProps) {
  return (
    <SelectorFiltro
      etiqueta="Ordenar"
      valor={valor}
      opciones={OPCIONES_ORDEN}
      onCambiar={onCambiar}
      className={className}
    />
  )
}
