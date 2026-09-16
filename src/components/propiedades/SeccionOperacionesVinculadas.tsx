import { ListaOperacionesCompacta } from '../operaciones/ListaOperacionesCompacta'
import { useOperacionesPorPropiedad } from '../../hooks/useOperacion'

/** Operaciones que apuntan a esta propiedad. */
export function SeccionOperacionesVinculadas({ propiedadId }: { propiedadId: string }) {
  const { data, isPending, error } = useOperacionesPorPropiedad(propiedadId)

  return (
    <>
      {/* Visible y fija, no escondida en un tooltip: que una propiedad acumule
          varias operaciones y que los dos estados sean independientes es de las
          confusiones más caras del modelo, y quien no sabe que hay algo que
          entender nunca abre el "?". */}
      <p className="mb-3 text-[0.85rem] leading-relaxed text-ink-3">
        Una propiedad puede tener varias operaciones a lo largo del tiempo: cada
        una es un intento de venta o alquiler con un lead distinto. El estado de
        la propiedad (Disponible, Reservada, Vendida…) y el de cada operación se
        manejan por separado.
      </p>

      <ListaOperacionesCompacta
        operaciones={data ?? []}
        cargando={isPending}
        error={error instanceof Error ? error.message : null}
        textoVacio="Esta propiedad todavía no tiene operaciones vinculadas."
      />
    </>
  )
}
