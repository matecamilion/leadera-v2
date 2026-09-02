import { etiquetaTipoOperacion, type TipoOperacion } from '../../lib/api/operaciones'

/** Colores exactos de `.badge-tipo-operacion` del Angular. */
const ESTILOS: Record<TipoOperacion, string> = {
  VENTA: 'bg-badge-ganado-bg text-primary',
  COMPRA: 'bg-badge-frio-bg text-frio',
  ALQUILER: 'bg-badge-tibio-bg text-badge-tibio-ink',
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
