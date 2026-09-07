import { ModalConfirmarEliminar } from '../comunes/ModalConfirmarEliminar'
import type { EstadoTerminal } from '../../lib/api/operaciones'

/**
 * Qué se pregunta para cada estado.
 *
 * Quién es terminal lo decide `esBloqueada`, que sale de la misma lista que
 * mira el trigger `operaciones_proteger_cerrada`: con un criterio propio acá,
 * agregar un estado terminal dejaría de pedir confirmación sin que nadie lo note.
 */
const COPY: Record<EstadoTerminal, {
  titulo: string
  descripcion: string
  confirmar: string
  confirmando: string
}> = {
  CERRADA_GANADA: {
    titulo: '¿Cerrar esta operación como ganada?',
    descripcion:
      'El monto y los datos principales quedan bloqueados para editar después de esto.',
    confirmar: 'Sí, cerrar como ganada',
    confirmando: 'Cerrando…',
  },
  CANCELADA: {
    titulo: '¿Cancelar esta operación?',
    descripcion: 'Los datos quedan bloqueados para editar después de esto.',
    confirmar: 'Sí, cancelar la operación',
    confirmando: 'Cancelando…',
  },
}

interface ModalConfirmarCierreProps {
  /** El estado al que se quiere pasar, o null si no hay nada que confirmar. */
  estado: EstadoTerminal | null
  procesando: boolean
  error?: string | null
  onCancelar: () => void
  onConfirmar: () => void
}

/**
 * Confirmación para cerrar o cancelar una operación.
 *
 * Estos dos estados no son un paso más del tablero: estampan `fecha_cierre` y
 * dejan la operación fuera de edición —lo hace cumplir un trigger—, así que
 * llegar por accidente cuesta una reapertura. Las transiciones entre estados
 * abiertos no pasan por acá.
 */
export function ModalConfirmarCierre({
  estado,
  procesando,
  error,
  onCancelar,
  onConfirmar,
}: ModalConfirmarCierreProps) {
  // El copy se congela mientras el diálogo está abierto; con `estado` en null
  // no hay nada que dibujar.
  if (!estado) return null

  const copy = COPY[estado]

  return (
    <ModalConfirmarEliminar
      abierto
      titulo={copy.titulo}
      descripcion={copy.descripcion}
      eliminando={procesando}
      error={error}
      onCancelar={onCancelar}
      onConfirmar={onConfirmar}
      textoConfirmar={copy.confirmar}
      textoConfirmando={copy.confirmando}
      // "Cancelar" tendría dos sentidos opuestos en el diálogo que justamente
      // pregunta si cancelar la operación.
      textoCancelar="No, volver"
    />
  )
}
