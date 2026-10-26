import { Link } from 'react-router-dom'
import { IconoUsuarios } from './Iconos'

const CLASES_BOTON =
  'mt-5 inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-[18px] py-2.5 text-[0.9rem] font-semibold whitespace-nowrap text-primary-contrast transition-colors hover:bg-primary-dark motion-reduce:transition-none'

interface EstadoSinAsignadosProps {
  /** Apaga "Míos" en el lugar (el listado). */
  onVerTodos?: () => void
  /** O lleva al listado sin "Míos" (Mi día). Gana `onVerTodos` si vienen los dos. */
  a?: string
}

/**
 * Quien trabaja por lo asignado y todavía no tiene nada: la cuenta no está
 * vacía, solo no le asignaron leads. Distinto de `EstadoSinLeads`, que invita a
 * cargar el primero.
 */
export function EstadoSinAsignados({ onVerTodos, a }: EstadoSinAsignadosProps) {
  return (
    <div className="mb-4 rounded-2xl border border-dashed border-border bg-surface px-6 py-10 text-center">
      <span
        aria-hidden
        className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-brand-soft text-primary"
      >
        <IconoUsuarios className="size-6" />
      </span>
      <h2 className="m-0 text-[1.05rem] font-bold text-ink">No tenés leads asignados todavía</h2>
      <p className="mt-1.5 text-[0.9rem] text-ink-3">
        Cuando te asignen uno, aparece acá. Mientras tanto podés ver todos los leads.
      </p>
      {onVerTodos ? (
        <button type="button" onClick={onVerTodos} className={CLASES_BOTON}>
          Ver todos los leads
        </button>
      ) : (
        <Link to={a ?? '/leads?mios=0'} className={CLASES_BOTON}>
          Ver todos los leads
        </Link>
      )}
    </div>
  )
}
