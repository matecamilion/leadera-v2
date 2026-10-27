import { FILTROS_ROL, etiquetaFiltroRol, type FiltroRol } from '../../lib/api/rolLead'
import { SelectorFiltro, type OpcionFiltro } from './SelectorFiltro'

/** El select nativo no tiene `undefined`: "sin filtro" es la cadena vacía. */
const TODOS = ''

const OPCIONES_TIPO: OpcionFiltro<FiltroRol | typeof TODOS>[] = [
  { valor: TODOS, label: 'Todos los tipos' },
  ...FILTROS_ROL.map((f) => ({ valor: f, label: etiquetaFiltroRol(f) })),
]

interface SelectorTipoLeadsProps {
  /** `undefined` = sin filtro de tipo. */
  valor: FiltroRol | undefined
  onCambiar: (valor: FiltroRol | undefined) => void
  className?: string
}

/**
 * Segundo eje del listado: qué hace el lead, no qué tan caliente está. Se suma
 * a la temperatura (Calientes + Compradores = los compradores calientes). Con un
 * tipo elegido el desplegable se destaca, para que se note que hay un filtro.
 */
export function SelectorTipoLeads({ valor, onCambiar, className }: SelectorTipoLeadsProps) {
  return (
    <SelectorFiltro
      etiqueta="Tipo"
      valor={valor ?? TODOS}
      opciones={OPCIONES_TIPO}
      onCambiar={(v) => onCambiar(v === TODOS ? undefined : v)}
      destacado={valor !== undefined}
      className={className}
    />
  )
}
