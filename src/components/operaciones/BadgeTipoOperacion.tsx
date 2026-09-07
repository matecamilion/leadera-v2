import { etiquetaTipoOperacion, type TipoOperacion } from '../../lib/api/operaciones'

/** Colores exactos de `.badge-tipo-operacion` del Angular. */
const ESTILOS: Record<TipoOperacion, string> = {
  VENTA: 'bg-badge-ganado-bg text-primary',
  COMPRA: 'bg-badge-frio-bg text-frio',
  ALQUILER: 'bg-badge-tibio-bg text-badge-tibio-ink',
  // Del lado del que busca, como COMPRA: comparten familia de color para que la
  // grilla se lea por "quién ofrece" y "quién busca" antes que por el tipo exacto.
  BUSQUEDA_ALQUILER: 'bg-cool-soft text-info',
}

export function BadgeTipoOperacion({ tipo }: { tipo: TipoOperacion }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-1 text-[0.7rem] font-extrabold tracking-[0.03em] uppercase ${ESTILOS[tipo]}`}
    >
      {etiquetaTipoOperacion(tipo)}
    </span>
  )
}
