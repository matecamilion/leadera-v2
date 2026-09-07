import { useState } from 'react'
import {
  esBloqueada,
  ESTADOS_OPERACION,
  type EstadoOperacion,
  type EstadoTerminal,
} from '../../lib/api/operaciones'
import { ModalConfirmarCierre } from './ModalConfirmarCierre'

/** Mismos pares de color que BadgeEstadoOperacion, en versión botón. */
const ESTILOS: Record<string, string> = {
  PUBLICADA: 'bg-badge-ganado-bg text-primary',
  RESERVADA: 'bg-badge-tibio-bg text-badge-tibio-ink',
  EN_NEGOCIACION: 'bg-badge-tibio-bg text-badge-tibio-ink',
  CERRADA_GANADA: 'bg-badge-ganado-bg text-primary-dark',
  CANCELADA: 'bg-badge-caliente-bg text-caliente',
}

interface GrupoEstadoOperacionProps {
  actual: EstadoOperacion
  guardando: boolean
  error?: string | null
  onCambiar: (estado: EstadoOperacion) => void
}

/**
 * Cambio de estado con un click, a cualquier estado.
 *
 * Sin restricción de transiciones, igual que el original: las reglas de
 * TRANSICIONES_PERMITIDAS aplican en el Kanban, no acá.
 *
 * Cerrar y cancelar son la excepción: pasan por una confirmación antes de
 * llamar a `onCambiar`, porque dejan la operación fuera de edición y volver
 * atrás cuesta reabrirla. Entre estados abiertos se sigue cambiando de un click.
 */
export function GrupoEstadoOperacion({
  actual,
  guardando,
  error,
  onCambiar,
}: GrupoEstadoOperacionProps) {
  const [aConfirmar, setAConfirmar] = useState<EstadoTerminal | null>(null)

  function pedirCambio(estado: EstadoOperacion) {
    if (esBloqueada(estado)) {
      setAConfirmar(estado)
      return
    }
    onCambiar(estado)
  }

  /**
   * El cierre que todavía hay que confirmar.
   *
   * El diálogo se queda abierto mientras se guarda y, si falla, para mostrar por
   * qué: cerrarlo al confirmar dejaba al usuario mirando la ficha sin enterarse
   * de que el cierre no llegó a pasar. Deja de estar pendiente cuando la
   * operación ya tiene el estado que se pidió, que es la señal de que la
   * escritura entró —y no depende de en qué orden se resuelvan `guardando` y
   * `error`—. Se deriva en vez de apagarse desde un efecto: es el mismo dato
   * mirado en el momento del render, no un estado aparte que sincronizar.
   */
  const pendiente = aConfirmar !== actual ? aConfirmar : null

  function confirmar() {
    if (pendiente) onCambiar(pendiente)
  }

  return (
    <div>
      <div
        role="group"
        aria-label="Cambiar el estado de la operación"
        className="flex flex-wrap gap-1.5"
      >
        {ESTADOS_OPERACION.map((estado) => {
          const activo = estado.valor === actual
          return (
            <button
              key={estado.valor}
              type="button"
              disabled={guardando || activo}
              aria-pressed={activo}
              onClick={() => pedirCambio(estado.valor)}
              className={[
                'rounded-lg px-3 py-1.5 text-[0.78rem] font-bold transition motion-reduce:transition-none',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                ESTILOS[estado.valor],
                activo
                  ? 'cursor-default ring-2 ring-primary ring-offset-1'
                  : 'opacity-55 hover:opacity-100 disabled:opacity-40',
              ].join(' ')}
            >
              {estado.label}
            </button>
          )
        })}
      </div>

      {guardando && (
        <p aria-live="polite" className="mt-1.5 text-[0.78rem] text-ink-3">
          Guardando…
        </p>
      )}

      {/* Con el diálogo abierto el error ya se lee ahí, encima de esta línea:
          repetirlo debajo de los chips lo muestra dos veces en la misma
          pantalla. Las transiciones que no pasan por confirmación lo siguen
          mostrando acá, que es su único lugar. */}
      {error && !pendiente && (
        <p role="alert" className="mt-1.5 text-[0.78rem] text-peligro-ink">
          {error}
        </p>
      )}

      <ModalConfirmarCierre
        estado={pendiente}
        procesando={guardando}
        // El error del intento se muestra acá adentro y no sólo abajo: quien
        // acaba de confirmar está mirando el diálogo, y el motivo del rechazo
        // —que puede ser un monto que falta— es lo que le dice qué hacer.
        error={error}
        onCancelar={() => setAConfirmar(null)}
        onConfirmar={confirmar}
      />
    </div>
  )
}
