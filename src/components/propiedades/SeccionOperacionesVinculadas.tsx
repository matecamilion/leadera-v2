import { ListaOperacionesCompacta } from '../operaciones/ListaOperacionesCompacta'
import { useOperacionesPorPropiedad } from '../../hooks/useOperacion'

/** Operaciones que apuntan a esta propiedad. */
export function SeccionOperacionesVinculadas({ propiedadId }: { propiedadId: string }) {
  const { data, isPending, error } = useOperacionesPorPropiedad(propiedadId)

  return (
    <ListaOperacionesCompacta
      operaciones={data ?? []}
      cargando={isPending}
      error={error instanceof Error ? error.message : null}
      textoVacio="Esta propiedad todavía no tiene operaciones vinculadas."
    />
  )
}
