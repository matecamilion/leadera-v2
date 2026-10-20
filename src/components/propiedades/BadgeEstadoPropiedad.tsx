import { etiquetaEstado, type EstadoPropiedad } from '../../lib/api/propiedades'
import { ESTILOS_ESTADO_PROPIEDAD } from './estilosEstadoPropiedad'

export function BadgeEstadoPropiedad({ estado }: { estado: EstadoPropiedad }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-[3px] text-[0.72rem] font-bold uppercase ${ESTILOS_ESTADO_PROPIEDAD[estado]}`}
    >
      {etiquetaEstado(estado)}
    </span>
  )
}
