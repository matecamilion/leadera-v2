import { ESTADOS_PROPIEDAD, etiquetaEstado, type EstadoPropiedad } from '../../lib/api/propiedades'
import { MenuDesplegable } from '../comunes/MenuDesplegable'
import { IconoCheck } from '../leads/Iconos'
import { ESTILOS_ESTADO_PROPIEDAD } from './estilosEstadoPropiedad'

interface Props {
  actual: EstadoPropiedad
  guardando: boolean
  onCambiar: (estado: EstadoPropiedad) => void
}

/** El estado de la propiedad como insignia que abre el menú con los cinco. */
export function MenuEstadoPropiedad({ actual, guardando, onCambiar }: Props) {
  return (
    <MenuDesplegable
      etiqueta={`Estado: ${etiquetaEstado(actual)}. Cambiar el estado de la propiedad`}
      claseBoton={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[0.8rem] font-bold uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:min-h-0 ${ESTILOS_ESTADO_PROPIEDAD[actual]} ${guardando ? 'opacity-60' : ''}`}
      boton={
        <>
          {etiquetaEstado(actual)}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m6 9 6 6 6-6" />
          </svg>
        </>
      }
      items={ESTADOS_PROPIEDAD.map((e) => ({
        label: e.label,
        icono:
          e.valor === actual ? (
            <IconoCheck className="size-4 text-primary" />
          ) : (
            <span aria-hidden className="size-4" />
          ),
        // Un estado a la vez, y el actual no se vuelve a guardar.
        onSelect: () => {
          if (!guardando && e.valor !== actual) onCambiar(e.valor)
        },
      }))}
    />
  )
}
