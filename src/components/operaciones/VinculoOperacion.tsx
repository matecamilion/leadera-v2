import { Link } from 'react-router-dom'
import type { OperacionListada } from '../../lib/api/operaciones'

/**
 * Qué está vinculado a la operación.
 *
 * VENTA/ALQUILER se apoyan en una propiedad y COMPRA en una búsqueda, pero
 * ninguno de los dos es obligatorio: mostramos lo que efectivamente haya,
 * en vez de deducirlo del tipo, para no mentir cuando el agente cargó la
 * operación primero y todavía no la vinculó.
 */
export function VinculoOperacion({ operacion }: { operacion: OperacionListada }) {
  if (operacion.propiedad) {
    return (
      <Link
        to={`/propiedades/${operacion.propiedad.id}`}
        className="font-medium text-primary hover:underline"
      >
        {operacion.propiedad.direccion}
      </Link>
    )
  }

  if (operacion.busqueda) {
    return (
      <span>
        Búsqueda{operacion.busqueda.zona ? ` en ${operacion.busqueda.zona}` : ''}
      </span>
    )
  }

  return <span className="text-ink-4">Sin vincular</span>
}
