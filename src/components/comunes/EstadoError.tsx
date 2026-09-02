import type { ReactNode } from 'react'
import { IconoAlerta } from '../leads/Iconos'

interface EstadoErrorProps {
  /**
   * Ya traducido y en español.
   *
   * Acá no entra el texto del servidor: para eso están `mensajeDeListado` y
   * `mensajeDeError`. Si llega un "Requested range not satisfiable" a esta
   * prop, el bug está en quien la llenó.
   */
  mensaje: string
  /** Encabezado. El default sirve para cualquier pantalla que no cargó. */
  titulo?: string
  /**
   * Qué ofrecerle al usuario para salir. Sin acción el bloque es informativo,
   * que es lo correcto cuando no hay nada que el usuario pueda hacer.
   */
  accion?: ReactNode
}

/**
 * El estado de "esto no cargó".
 *
 * Hermano de los estados vacíos que ya usa la app —mismo esqueleto: ícono,
 * título, detalle y una acción opcional— pero en la paleta de `peligro` y con
 * borde sólido. El punteado de los vacíos dice "todavía no hay nada"; esto dice
 * "algo se rompió", que no es lo mismo y no debería verse igual.
 *
 * Lleva `role="alert"` porque aparece reemplazando contenido que el usuario
 * estaba esperando: un lector de pantalla tiene que anunciarlo solo, sin que
 * haya que ir a buscarlo.
 */
export function EstadoError({
  mensaje,
  titulo = 'No pudimos mostrar esto',
  accion,
}: EstadoErrorProps) {
  return (
    <div
      role="alert"
      className="rounded-[16px] border border-peligro-borde bg-peligro-soft px-5 py-10 text-center"
    >
      <div className="mb-3 flex justify-center">
        <span
          aria-hidden
          className="grid size-11 place-items-center rounded-full bg-surface text-peligro-ink"
        >
          <IconoAlerta className="size-6" />
        </span>
      </div>

      <h3 className="m-0 text-[0.95rem] font-bold text-peligro-ink">{titulo}</h3>

      {/* El `max-w` en ch corta el renglón donde se lee cómodo: sin esto, en
          desktop el mensaje se estira los 1200px del listado. */}
      <p className="mx-auto mt-1.5 max-w-[48ch] text-[0.9rem] text-peligro-ink">
        {mensaje}
      </p>

      {accion && <div className="mt-5 flex justify-center">{accion}</div>}
    </div>
  )
}

interface BotonErrorProps {
  children: ReactNode
  onClick: () => void
}

/**
 * El botón del bloque de error.
 *
 * Vive acá y no suelto en cada página para que todas las salidas se vean igual:
 * antes Propiedades y Leads tenían el mismo botón con dos paletas distintas.
 */
export function BotonError({ children, onClick }: BotonErrorProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center rounded-lg border border-peligro-ink bg-surface px-4 py-2.5 text-[0.85rem] font-semibold text-peligro-ink transition-colors hover:bg-peligro-borde focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-peligro-ink motion-reduce:transition-none"
    >
      {children}
    </button>
  )
}
