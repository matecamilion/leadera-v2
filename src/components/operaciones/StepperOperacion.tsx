import { Fragment } from 'react'
import type { EstadoOperacion } from '../../lib/api/operaciones'
import { IconoAlerta, IconoCheck } from '../leads/Iconos'

/** Los 4 pasos del pipeline, en orden. CANCELADA queda fuera a propósito. */
const PASOS: { estado: EstadoOperacion; label: string }[] = [
  { estado: 'PUBLICADA', label: 'Publicada' },
  { estado: 'RESERVADA', label: 'Reservada' },
  { estado: 'EN_NEGOCIACION', label: 'Negociación' },
  { estado: 'CERRADA_GANADA', label: 'Cerrada' },
]

const ORDEN = PASOS.map((p) => p.estado)

type EstadoPaso = 'completado' | 'activo' | 'pendiente'

function estadoDelPaso(paso: EstadoOperacion, actual: EstadoOperacion): EstadoPaso {
  if (paso === actual) return 'activo'
  const iActual = ORDEN.indexOf(actual)
  const iPaso = ORDEN.indexOf(paso)
  // Si el estado actual no está en el pipeline —CANCELADA no es un paso, es
  // salirse— nada queda "completado": no sabríamos hasta dónde avanzó.
  if (iActual < 0 || iPaso < 0) return 'pendiente'
  return iActual > iPaso ? 'completado' : 'pendiente'
}

const PUNTO: Record<EstadoPaso, string> = {
  completado: 'border-primary bg-primary text-white',
  activo: 'border-tibio bg-tibio text-white',
  pendiente: 'border-border bg-surface text-ink-4',
}

const ETIQUETA: Record<EstadoPaso, string> = {
  completado: 'text-primary',
  activo: 'text-tibio',
  pendiente: 'text-ink-4',
}

export function StepperOperacion({ estado }: { estado: EstadoOperacion }) {
  // Una operación cancelada no tiene progreso que mostrar: el stepper daría
  // a entender que sigue viva en algún punto del pipeline.
  if (estado === 'CANCELADA') {
    return (
      <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-peligro-borde bg-peligro-soft px-5 py-3.5 text-[0.9rem] font-semibold text-caliente">
        <IconoAlerta className="size-5 shrink-0" />
        Esta operación fue cancelada.
      </div>
    )
  }

  return (
    <div className="mb-4 rounded-[14px] border border-border bg-surface px-6 py-5">
      <p className="mb-4 text-xs font-bold tracking-[0.04em] text-ink-3 uppercase">
        Progreso de la operación
      </p>

      <ol className="flex items-start">
        {PASOS.map((paso, i) => {
          const situacion = estadoDelPaso(paso.estado, estado)
          const anterior = i > 0 ? estadoDelPaso(PASOS[i - 1].estado, estado) : null
          return (
            <Fragment key={paso.estado}>
              {i > 0 && (
                <li
                  aria-hidden
                  className={`mt-3.5 h-0.5 flex-1 ${
                    anterior === 'completado' ? 'bg-primary' : 'bg-border'
                  }`}
                />
              )}
              <li className="flex w-16 shrink-0 flex-col items-center gap-1.5">
                <span
                  aria-hidden
                  className={`flex size-7 items-center justify-center rounded-full border-2 text-xs font-bold ${PUNTO[situacion]}`}
                >
                  {situacion === 'completado' ? (
                    <IconoCheck className="size-4" />
                  ) : (
                    i + 1
                  )}
                </span>
                <span
                  className={`text-center text-[0.65rem] leading-tight font-semibold ${ETIQUETA[situacion]}`}
                >
                  {paso.label}
                  {situacion === 'activo' && <span className="sr-only"> (actual)</span>}
                </span>
              </li>
            </Fragment>
          )
        })}
      </ol>
    </div>
  )
}
