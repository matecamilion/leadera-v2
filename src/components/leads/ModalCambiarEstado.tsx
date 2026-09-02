import { useEffect, useRef } from 'react'
import type { EstadoLead } from '../../lib/api/leads'
import { IconoCalavera, IconoCopo, IconoFuego, IconoTermometro } from './Iconos'

interface Opcion {
  valor: EstadoLead
  label: string
  clases: string
  icono: React.ReactNode
}

/** Colores exactos de `.btn-opcion.*` del Angular. */
const OPCIONES: Opcion[] = [
  {
    valor: 'CALIENTE',
    label: 'CALIENTE',
    clases: 'bg-peligro-soft text-peligro-ink hover:brightness-95',
    icono: <IconoFuego className="size-5" />,
  },
  {
    valor: 'TIBIO',
    label: 'TIBIO',
    clases: 'bg-badge-tibio-bg text-badge-tibio-ink hover:brightness-95',
    icono: <IconoTermometro className="size-5" />,
  },
  {
    valor: 'FRIO',
    label: 'FRÍO',
    clases: 'bg-badge-frio-bg text-frio hover:brightness-95',
    icono: <IconoCopo className="size-5" />,
  },
  {
    valor: 'INACTIVO',
    label: 'INACTIVO',
    clases: 'bg-surface-2 text-ink-2 hover:brightness-95',
    icono: <IconoCalavera className="size-5" />,
  },
]

interface ModalCambiarEstadoProps {
  abierto: boolean
  nombreLead: string
  guardando: boolean
  error?: string | null
  onCerrar: () => void
  onElegir: (estado: EstadoLead) => void
}

export function ModalCambiarEstado({
  abierto,
  nombreLead,
  guardando,
  error,
  onCerrar,
  onElegir,
}: ModalCambiarEstadoProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (abierto && !dialog.open) dialog.showModal()
    if (!abierto && dialog.open) dialog.close()
  }, [abierto])

  return (
    <dialog
      ref={ref}
      aria-label="Actualizar estado del lead"
      onCancel={(e) => {
        e.preventDefault()
        if (!guardando) onCerrar()
      }}
      // `m-auto`: el preflight de Tailwind pone margin:0 y le saca al <dialog>
      // el centrado que trae por defecto.
      className="m-auto w-[350px] max-w-[90vw] rounded-[20px] border-none p-0 shadow-modal backdrop:bg-[rgba(15,23,42,0.6)] backdrop:backdrop-blur-[4px]"
    >
      <div className="box-border p-[30px] text-center">
        <h3 className="text-lg font-bold text-ink">Actualizar Estado</h3>
        <p className="mt-2 text-[0.9rem] text-ink-3">
          ¿En qué etapa se encuentra <strong className="text-ink">{nombreLead}</strong>?
        </p>

        <div className="my-6 flex flex-col gap-3">
          {OPCIONES.map((opcion) => (
            <button
              key={opcion.valor}
              type="button"
              disabled={guardando}
              onClick={() => onElegir(opcion.valor)}
              className={`flex items-center justify-center gap-2.5 rounded-xl border-none p-3.5 font-bold transition disabled:opacity-60 motion-reduce:transition-none ${opcion.clases}`}
            >
              {opcion.icono}
              {opcion.label}
            </button>
          ))}
        </div>

        {error && (
          <p
            role="alert"
            className="mb-4 rounded-sm border border-peligro-borde bg-peligro-soft px-3 py-2 text-[0.85rem] text-peligro-ink"
          >
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={onCerrar}
          disabled={guardando}
          className="rounded-lg border border-caliente bg-transparent px-4 py-2 font-semibold text-caliente transition-colors hover:bg-hot-soft disabled:opacity-60 motion-reduce:transition-none"
        >
          Cerrar
        </button>
      </div>
    </dialog>
  )
}
