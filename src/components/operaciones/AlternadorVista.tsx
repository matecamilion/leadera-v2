import { Link } from 'react-router-dom'

const BASE =
  'px-3 py-2 text-[0.85rem] font-semibold transition-colors motion-reduce:transition-none'
const ACTIVO = 'bg-primary text-white'
const INACTIVO = 'bg-surface text-ink-3 hover:text-ink'

/**
 * Toggle Lista / Tablero.
 *
 * El tablero no reemplaza al listado: el listado es el que busca, filtra y
 * pagina, y el tablero es para mover cosas de estado. Cada uno sirve para algo
 * distinto, así que conviven.
 */
export function AlternadorVista({ actual }: { actual: 'lista' | 'tablero' }) {
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-border">
      <Link
        to="/operaciones"
        aria-current={actual === 'lista' ? 'page' : undefined}
        className={`${BASE} ${actual === 'lista' ? ACTIVO : INACTIVO}`}
      >
        Lista
      </Link>
      <Link
        to="/operaciones/tablero"
        aria-current={actual === 'tablero' ? 'page' : undefined}
        className={`${BASE} border-l border-border ${actual === 'tablero' ? ACTIVO : INACTIVO}`}
      >
        Tablero
      </Link>
    </div>
  )
}
